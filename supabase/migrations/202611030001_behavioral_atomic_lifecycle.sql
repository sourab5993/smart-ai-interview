begin;

-- All child writes lock their parent first. This serializes direct owner-scoped
-- writes with report completion and prevents late answers changing a finished report.
create or replace function public.enforce_behavioral_session_in_progress()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_owner_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_session_id := old.behavioral_session_id;
    v_owner_id := old.owner_id;
  else
    v_session_id := new.behavioral_session_id;
    v_owner_id := new.owner_id;
  end if;

  if tg_op = 'DELETE' and auth.uid() is null then
    return old;
  end if;
  if auth.uid() is null or v_owner_id is distinct from auth.uid() then
    raise exception 'Behavioral record owner is not authorized' using errcode = '42501';
  end if;

  select s.status into v_status
  from public.behavioral_sessions s
  where s.id = v_session_id and s.owner_id = v_owner_id
  for update;
  if not found then
    if tg_op = 'DELETE' then return old; end if;
    raise exception 'Behavioral session is not available' using errcode = '42501';
  end if;
  if v_status <> 'in_progress' then
    raise exception 'Behavioral session is no longer accepting changes' using errcode = '55000';
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id or
       new.behavioral_session_id is distinct from old.behavioral_session_id or
       new.id is distinct from old.id then
      raise exception 'Behavioral record ownership and parent links are immutable' using errcode = '42501';
    end if;
    if tg_table_name <> 'behavioral_questions' and
       new.behavioral_question_id is distinct from old.behavioral_question_id then
      raise exception 'Behavioral question links are immutable' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists behavioral_questions_require_active_session on public.behavioral_questions;
create trigger behavioral_questions_require_active_session
before insert or update or delete on public.behavioral_questions
for each row execute function public.enforce_behavioral_session_in_progress();

drop trigger if exists behavioral_answers_require_active_session on public.behavioral_answers;
create trigger behavioral_answers_require_active_session
before insert or update or delete on public.behavioral_answers
for each row execute function public.enforce_behavioral_session_in_progress();

drop trigger if exists behavioral_observations_require_active_session on public.behavioral_observations;
create trigger behavioral_observations_require_active_session
before insert or update or delete on public.behavioral_observations
for each row execute function public.enforce_behavioral_session_in_progress();

-- Authenticated users may create only active sessions. Lifecycle changes are
-- performed by the owner-checked completion RPC below, not arbitrary PATCHes.
create or replace function public.guard_behavioral_session_initial_state()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or new.owner_id is distinct from auth.uid() then
    raise exception 'Behavioral session owner is not authorized' using errcode = '42501';
  end if;
  if new.status <> 'in_progress' or new.completed_at is not null or
     new.behavioral_score is not null or new.answer_quality_score is not null or
     new.combined_score is not null or new.summary <> '{}'::jsonb then
    raise exception 'New behavioral sessions must begin in progress without a report' using errcode = '55000';
  end if;
  return new;
end;
$$;
drop trigger if exists behavioral_sessions_initial_state on public.behavioral_sessions;
create trigger behavioral_sessions_initial_state
before insert on public.behavioral_sessions
for each row execute function public.guard_behavioral_session_initial_state();

drop policy if exists behavioral_sessions_owner_update on public.behavioral_sessions;
revoke update on table public.behavioral_sessions from authenticated;
revoke insert, update, delete on table public.behavioral_answers, public.behavioral_observations from authenticated;

-- Scores are calculated only from the bounded raw landmark frames stored for an answer.
-- The browser's category totals, coverage, reliability, and sample flags are never inputs.
create or replace function public.compute_behavioral_observation_summary(p_observations jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $function$
with frames as (
  select
    entry.ordinality,
    (value->>'observed_at_ms')::bigint as observed_at_ms,
    value->'payload' as payload,
    case when jsonb_typeof(value->'payload'->'faceCount') = 'number' then (value->'payload'->>'faceCount')::numeric end as face_count,
    (value->'payload'->>'trackingReliable' = 'true' and value->'payload'->>'faceVisible' = 'true') as reliable,
    value->'payload'->>'gaze' as gaze,
    case when jsonb_typeof(value->'payload'->'yaw') = 'number' then (value->'payload'->>'yaw')::numeric end as yaw,
    case when jsonb_typeof(value->'payload'->'pitch') = 'number' then (value->'payload'->>'pitch')::numeric end as pitch,
    case when jsonb_typeof(value->'payload'->'roll') = 'number' then (value->'payload'->>'roll')::numeric end as roll,
    (value->'payload'->>'poseVisible' = 'true') as pose_visible,
    case when jsonb_typeof(value->'payload'->'handsVisible') = 'number' then (value->'payload'->>'handsVisible')::numeric end as hands_visible,
    case when jsonb_typeof(value->'payload'->'handMovement') = 'number' then (value->'payload'->>'handMovement')::numeric end as hand_movement
  from jsonb_array_elements(coalesce(p_observations, '[]'::jsonb)) with ordinality as entry(value, ordinality)
  where value->>'observation_type' = 'frame'
), face_marked as (
  select observed_at_ms, ordinality, face_count > 1 as more_than_one,
    lag(face_count > 1, 1, false) over (order by observed_at_ms, ordinality) as previous_more
  from frames
), face_islands as (
  select *, sum(case when more_than_one and not previous_more then 1 else 0 end)
    over (order by observed_at_ms, ordinality) as island_id
  from face_marked
), face_event_groups as (
  select min(observed_at_ms) as start_ms, max(observed_at_ms) as end_ms
  from face_islands
  where more_than_one and island_id > 0
  group by island_id
), event_summary as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'type', 'additional_visible_face',
    'timestampMs', start_ms,
    'detail', 'More than one visible face was detected for approximately ' ||
      to_char(greatest(0::numeric, (end_ms - start_ms) / 1000.0), 'FM999999990.0') ||
      ' seconds. This is a factual camera event, not an identity or intent conclusion.'
  ) order by start_ms), '[]'::jsonb) as events
  from face_event_groups
), stats as (
  select
    count(*)::numeric as total_frames,
    count(*) filter (where reliable)::numeric as reliable_frames,
    min(observed_at_ms) filter (where reliable) as first_reliable_ms,
    max(observed_at_ms) filter (where reliable) as last_reliable_ms,
    count(*) filter (where reliable and gaze in ('camera','away'))::numeric as gaze_frames,
    count(*) filter (where reliable and gaze = 'camera')::numeric as camera_gaze_frames,
    count(*) filter (where reliable and (yaw is not null or pitch is not null or roll is not null))::numeric as head_frames,
    max(yaw) - min(yaw) as yaw_range,
    max(pitch) - min(pitch) as pitch_range,
    max(roll) - min(roll) as roll_range,
    count(*) filter (where pose_visible)::numeric as pose_frames,
    count(*) filter (where hands_visible > 0)::numeric as hand_frames,
    avg(hand_movement) as mean_hand_movement
  from frames
), measured as (
  select *,
    case when total_frames > 0 then least(100::numeric, greatest(0::numeric, 100 * reliable_frames / total_frames)) else 0 end as camera_coverage,
    case when total_frames > 0 then least(100::numeric, greatest(0::numeric, 100 * gaze_frames / total_frames)) else 0 end as gaze_coverage,
    case when total_frames > 0 then least(100::numeric, greatest(0::numeric, 100 * head_frames / total_frames)) else 0 end as head_coverage,
    case when total_frames > 0 then least(100::numeric, greatest(0::numeric, 100 * (pose_frames + hand_frames) / (2 * total_frames))) else 0 end as movement_coverage,
    case when first_reliable_ms is not null and last_reliable_ms is not null then greatest(0::numeric, (last_reliable_ms - first_reliable_ms) / 1000.0) else 0 end as sample_duration
  from stats
), adequacy as (
  select *, reliable_frames >= 8 and sample_duration >= 3.5 as sufficient,
    least(1::numeric, reliable_frames / 8.0, sample_duration / 3.5) as sample_factor,
    greatest(coalesce(yaw_range, 0), coalesce(pitch_range, 0), coalesce(roll_range, 0)) as head_noise
  from measured
), categories as (
  select category.ordinality, category.key, category.label, category.explanation,
    category.weight,
    case
      when category.key = 'gaze' and sufficient and gaze_coverage >= 20 and gaze_frames > 0
        then round(100 * camera_gaze_frames / gaze_frames)
      when category.key = 'head' and sufficient and head_coverage >= 20 and head_frames > 0
        then greatest(0::numeric, 100 - least(100::numeric, head_noise * 1.4))
      when category.key = 'movement' and sufficient and movement_coverage >= 20
        then greatest(0::numeric, 100 - least(100::numeric, coalesce(mean_hand_movement, 0) * 350))
      when category.key = 'camera' and sufficient and camera_coverage >= 20
        then camera_coverage
      else null
    end as score,
    case category.key
      when 'gaze' then gaze_coverage
      when 'head' then head_coverage
      when 'movement' then movement_coverage
      when 'camera' then camera_coverage
      else 0::numeric
    end as coverage,
    case category.key
      when 'gaze' then gaze_coverage * 0.85 * sample_factor
      when 'head' then head_coverage * 0.9 * sample_factor
      when 'movement' then movement_coverage * 0.8 * sample_factor
      when 'camera' then camera_coverage * sample_factor
      else 0::numeric
    end as reliability
  from adequacy
  cross join lateral (values
    (1, 'gaze', 'Approximate camera-directed gaze', 'Camera-relative gaze estimates are not a psychological or honesty measure.', 0.25::numeric),
    (2, 'head', 'Head movement stability', 'Head-pose ranges describe visible motion only; thresholds are approximate coaching values.', 0.20::numeric),
    (3, 'movement', 'Upper-body and hand coverage', 'Movement describes detected coverage and change; absence of gestures is not a negative trait.', 0.20::numeric),
    (4, 'camera', 'Visible-face coverage', 'This is usable visible-face sample coverage, not a framing, lighting, or suitability judgment.', 0.15::numeric),
    (5, 'speech', 'Speech delivery and timing', 'No persisted word-timing or pause observations are available for a server-recomputed score.', 0.20::numeric)
  ) as category(ordinality, key, label, explanation, weight)
), rollup as (
  select
    coalesce(sum(score * weight) filter (where score is not null), 0) as weighted_sum,
    coalesce(sum(weight) filter (where score is not null), 0) as weight_total,
    coalesce(round(sum(coverage) filter (where score is not null) / 5), 0) as coverage,
    coalesce(round(avg(reliability) filter (where score is not null)), 0) as reliability
  from categories
)
select jsonb_build_object(
  'categories', (select coalesce(jsonb_agg(jsonb_build_object(
    'key', key, 'label', label, 'score', score, 'coverage', round(coverage),
    'reliability', round(reliability), 'available', score is not null,
    'explanation', explanation
  ) order by ordinality), '[]'::jsonb) from categories),
  'behavioralScore', case when rollup.weight_total >= 0.45 then round(rollup.weighted_sum / rollup.weight_total) else null end,
  'coverage', rollup.coverage,
  'reliability', rollup.reliability,
  'events', event_summary.events,
  'insufficientData', rollup.weight_total < 0.45,
  'sampleAdequacy', jsonb_build_object(
    'observedFrames', adequacy.total_frames,
    'reliableFrames', adequacy.reliable_frames,
    'observedDurationSeconds', round(adequacy.sample_duration, 1),
    'minimumReliableFrames', 8,
    'minimumDurationSeconds', 3.5,
    'sufficient', adequacy.sufficient,
    'reason', case when adequacy.sufficient then null else 'At least 8 reliable face samples spanning 3.5 seconds are required for camera-based scores.' end
  )
)
from adequacy cross join rollup cross join event_summary;
$function$;
revoke all on function public.compute_behavioral_observation_summary(jsonb) from public, anon, authenticated;

-- Saves an answer and its bounded observation replacement in one transaction.
create or replace function public.save_behavioral_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_transcript text,
  p_transcript_language text,
  p_transcript_confidence numeric,
  p_duration_seconds numeric,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_observation_summary jsonb,
  p_observations jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid := auth.uid();
  v_status text;
  v_answer_id uuid;
  v_observation jsonb;
  v_numeric_key text;
  v_safe_summary jsonb;
  v_raw_observations jsonb;
begin
  if v_owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if nullif(btrim(p_transcript), '') is null then raise exception 'A non-empty spoken transcript is required' using errcode = '22023'; end if;
  if length(p_transcript) > 20000 then raise exception 'Transcript exceeds the allowed size' using errcode = '22023'; end if;
  if p_transcript_language is not null and length(p_transcript_language) > 20 then raise exception 'Transcript language is invalid' using errcode = '22023'; end if;
  if p_transcript_confidence is not null and (p_transcript_confidence < 0 or p_transcript_confidence > 1) then raise exception 'Transcript confidence is invalid' using errcode = '22023'; end if;
  if p_duration_seconds is null or p_duration_seconds <= 0 or p_duration_seconds > 3600 then raise exception 'Answer duration is invalid' using errcode = '22023'; end if;
  if p_started_at is null or p_ended_at is null or p_ended_at < p_started_at then raise exception 'Answer timestamps are invalid' using errcode = '22023'; end if;
  if p_observation_summary is null or jsonb_typeof(p_observation_summary) is distinct from 'object' or pg_column_size(p_observation_summary) > 65536 then
    raise exception 'Observation summary is invalid or too large' using errcode = '22023';
  end if;
  if p_observations is null or jsonb_typeof(p_observations) is distinct from 'array' or pg_column_size(p_observations) > 262144 then
    raise exception 'Observation list is invalid or too large' using errcode = '22023';
  end if;
  if jsonb_array_length(p_observations) > 600 then raise exception 'Too many behavioral observations' using errcode = '22023'; end if;

  -- Only raw frame records are accepted. Validate the exact fields used by the
  -- server scorer; client valid/reliability/category aggregates are ignored.
  for v_observation in select value from jsonb_array_elements(p_observations) as entries(value) loop
    if jsonb_typeof(v_observation) is distinct from 'object' or
       coalesce(v_observation->>'observed_at_ms', '') !~ '^(0|[1-9][0-9]{0,12})$' or
       v_observation->>'observation_type' is distinct from 'frame' or
       jsonb_typeof(v_observation->'payload') is distinct from 'object' then
      raise exception 'Behavioral frame is invalid' using errcode = '22023';
    end if;
    if jsonb_typeof(v_observation->'payload'->'trackingReliable') is distinct from 'boolean' or
       jsonb_typeof(v_observation->'payload'->'faceVisible') is distinct from 'boolean' or
       jsonb_typeof(v_observation->'payload'->'poseVisible') is distinct from 'boolean' or
       jsonb_typeof(v_observation->'payload'->'gaze') is distinct from 'string' or
       v_observation->'payload'->>'gaze' not in ('camera','away','unavailable') then
      raise exception 'Behavioral frame flags are invalid' using errcode = '22023';
    end if;
    if jsonb_typeof(v_observation->'payload'->'faceCount') is distinct from 'number' or
       jsonb_typeof(v_observation->'payload'->'handsVisible') is distinct from 'number' then
      raise exception 'Behavioral landmark counts are invalid' using errcode = '22023';
    end if;
    if length(v_observation->'payload'->>'faceCount') > 3 or
       (v_observation->'payload'->>'faceCount')::numeric not between 0 and 20 or
       (v_observation->'payload'->>'faceCount')::numeric <> trunc((v_observation->'payload'->>'faceCount')::numeric) or
       length(v_observation->'payload'->>'handsVisible') > 2 or
       (v_observation->'payload'->>'handsVisible')::numeric not between 0 and 2 or
       (v_observation->'payload'->>'handsVisible')::numeric <> trunc((v_observation->'payload'->>'handsVisible')::numeric) then
      raise exception 'Behavioral landmark counts are out of range' using errcode = '22023';
    end if;
    if jsonb_typeof(v_observation->'payload'->'blink') not in ('boolean','null') or
       jsonb_typeof(v_observation->'payload'->'lightingOk') not in ('boolean','null') then
      raise exception 'Behavioral optional flags are invalid' using errcode = '22023';
    end if;
    foreach v_numeric_key in array array['yaw','pitch','roll'] loop
      if jsonb_typeof(v_observation->'payload'->v_numeric_key) not in ('number','null') then
        raise exception 'Behavioral head pose is invalid' using errcode = '22023';
      end if;
      if jsonb_typeof(v_observation->'payload'->v_numeric_key) = 'number' then
        if length(v_observation->'payload'->>v_numeric_key) > 8 or
           (v_observation->'payload'->>v_numeric_key)::numeric not between -180 and 180 then
          raise exception 'Behavioral head pose is out of range' using errcode = '22023';
        end if;
      end if;
    end loop;
    foreach v_numeric_key in array array['torsoMovement','handMovement'] loop
      if jsonb_typeof(v_observation->'payload'->v_numeric_key) not in ('number','null') then
        raise exception 'Behavioral movement measurement is invalid' using errcode = '22023';
      end if;
      if jsonb_typeof(v_observation->'payload'->v_numeric_key) = 'number' then
        if length(v_observation->'payload'->>v_numeric_key) > 8 or
           (v_observation->'payload'->>v_numeric_key)::numeric not between 0 and 2 then
          raise exception 'Behavioral movement measurement is out of range' using errcode = '22023';
        end if;
      end if;
    end loop;
  end loop;

  select s.status into v_status
  from public.behavioral_sessions s
  where s.id = p_session_id and s.owner_id = v_owner_id
  for update;
  if not found or v_status <> 'in_progress' then raise exception 'Behavioral session is not accepting answers' using errcode = '55000'; end if;

  perform 1
  from public.behavioral_questions q
  where q.id = p_question_id and q.behavioral_session_id = p_session_id and q.owner_id = v_owner_id
  for update;
  if not found then raise exception 'Question is not part of this behavioral session' using errcode = '42501'; end if;

  insert into public.behavioral_answers (
    owner_id, behavioral_session_id, behavioral_question_id, transcript,
    transcript_language, transcript_confidence, duration_seconds, started_at,
    ended_at, observation_summary, behavioral_score, coverage, reliability
  ) values (
    v_owner_id, p_session_id, p_question_id, nullif(btrim(p_transcript), ''),
    p_transcript_language, p_transcript_confidence, p_duration_seconds,
    p_started_at, p_ended_at, '{}'::jsonb, null, null, null
  )
  on conflict (behavioral_session_id, behavioral_question_id) do update set
    transcript = excluded.transcript,
    transcript_language = excluded.transcript_language,
    transcript_confidence = excluded.transcript_confidence,
    duration_seconds = excluded.duration_seconds,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    observation_summary = '{}'::jsonb,
    behavioral_score = null,
    coverage = null,
    reliability = null,
    updated_at = now()
  where public.behavioral_answers.owner_id = v_owner_id
  returning id into v_answer_id;
  if v_answer_id is null then raise exception 'Behavioral answer could not be saved' using errcode = '42501'; end if;

  delete from public.behavioral_observations
  where owner_id = v_owner_id and behavioral_session_id = p_session_id and behavioral_question_id = p_question_id;

  insert into public.behavioral_observations (
    owner_id, behavioral_session_id, behavioral_question_id,
    observed_at_ms, observation_type, payload, valid, reliability
  )
  select
    v_owner_id, p_session_id, p_question_id,
    (entry.value->>'observed_at_ms')::bigint,
    'frame', entry.value->'payload',
    (entry.value->'payload'->>'trackingReliable' = 'true' and entry.value->'payload'->>'faceVisible' = 'true'),
    null
  from jsonb_array_elements(p_observations) as entry(value);

  select coalesce(jsonb_agg(jsonb_build_object(
      'observed_at_ms', o.observed_at_ms,
      'observation_type', o.observation_type,
      'payload', o.payload,
      'valid', o.valid,
      'reliability', o.reliability
    ) order by o.observed_at_ms, o.id), '[]'::jsonb)
  into v_raw_observations
  from public.behavioral_observations o
  where o.owner_id = v_owner_id and o.behavioral_session_id = p_session_id
    and o.behavioral_question_id = p_question_id;

  v_safe_summary := public.compute_behavioral_observation_summary(v_raw_observations);
  update public.behavioral_answers
  set observation_summary = v_safe_summary,
      behavioral_score = nullif(v_safe_summary->>'behavioralScore','')::numeric,
      coverage = (v_safe_summary->>'coverage')::numeric,
      reliability = (v_safe_summary->>'reliability')::numeric,
      updated_at = now()
  where id = v_answer_id and owner_id = v_owner_id;

  return v_answer_id;
end;
$$;

-- The same parent-row lock fences report completion against concurrent saves.
create or replace function public.complete_behavioral_session(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid := auth.uid();
  v_status text;
  v_saved_summary jsonb;
  v_include_answer_evaluation boolean;
  v_question_count bigint;
  v_answer_count bigint;
  v_adequate_answer_count bigint;
  v_categories jsonb;
  v_weight_total numeric := 0;
  v_weighted_sum numeric := 0;
  v_behavioral_score numeric;
  v_coverage numeric := 0;
  v_reliability numeric := 0;
  v_answer_quality_score numeric;
  v_combined_score numeric;
  v_summary jsonb;
begin
  if v_owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select s.status, s.summary, s.include_answer_evaluation
  into v_status, v_saved_summary, v_include_answer_evaluation
  from public.behavioral_sessions s
  where s.id = p_session_id and s.owner_id = v_owner_id
  for update;
  if not found then raise exception 'Behavioral session is not available' using errcode = '42501'; end if;
  if v_status = 'completed' then return coalesce(v_saved_summary, '{}'::jsonb); end if;
  if v_status <> 'in_progress' then raise exception 'Behavioral session cannot be completed' using errcode = '55000'; end if;

  select count(*) into v_question_count
  from public.behavioral_questions q
  where q.behavioral_session_id = p_session_id and q.owner_id = v_owner_id;
  select count(distinct a.behavioral_question_id) into v_answer_count
  from public.behavioral_answers a
  where a.behavioral_session_id = p_session_id and a.owner_id = v_owner_id;
  if v_question_count = 0 or v_question_count <> v_answer_count then
    raise exception 'Every behavioral question must have a saved answer before completion' using errcode = '55000';
  end if;

  with per_answer as (
    select a.id,
      public.compute_behavioral_observation_summary(coalesce((
        select jsonb_agg(jsonb_build_object(
          'observed_at_ms', o.observed_at_ms,
          'observation_type', o.observation_type,
          'payload', o.payload,
          'valid', o.valid,
          'reliability', o.reliability
        ) order by o.observed_at_ms, o.id)
        from public.behavioral_observations o
        where o.owner_id = v_owner_id and o.behavioral_session_id = p_session_id
          and o.behavioral_question_id = a.behavioral_question_id
      ), '[]'::jsonb)) as metrics
    from public.behavioral_answers a
    where a.behavioral_session_id = p_session_id and a.owner_id = v_owner_id
  ), raw_categories as (
    select
      category.value->>'key' as key,
      category.value->>'label' as label,
      category.value->>'explanation' as explanation,
      (category.value->>'available') = 'true' as available,
      case when jsonb_typeof(category.value->'score') = 'number' then (category.value->>'score')::numeric end as score,
      (category.value->>'coverage')::numeric as coverage,
      (category.value->>'reliability')::numeric as reliability
    from per_answer a
    cross join lateral jsonb_array_elements(a.metrics->'categories') as category(value)
  ), category_means as (
    select key, max(label) as label, max(explanation) as explanation,
      avg(score) filter (where available) as score,
      avg(coverage) as coverage,
      avg(reliability) as reliability,
      bool_or(available) as available
    from raw_categories
    where key in ('gaze','head','movement','camera','speech')
    group by key
  ), category_keys as (
    select * from (values
      ('gaze', 1, 0.25::numeric),
      ('head', 2, 0.20::numeric),
      ('movement', 3, 0.20::numeric),
      ('camera', 4, 0.15::numeric),
      ('speech', 5, 0.20::numeric)
    ) as keys(key, ordinal, weight)
  ), weighted_categories as (
    select keys.key, keys.ordinal, keys.weight,
      coalesce(means.label, keys.key) as label,
      coalesce(means.explanation, 'No persisted observations support this category.') as explanation,
      means.score, coalesce(means.coverage, 0) as coverage,
      coalesce(means.reliability, 0) as reliability,
      coalesce(means.available, false) as available
    from category_keys keys
    left join category_means means using (key)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'key', key,
      'label', label,
      'score', case when available then round(score) else null end,
      'coverage', round(coverage),
      'reliability', round(reliability),
      'available', available,
      'explanation', explanation
    ) order by ordinal), '[]'::jsonb),
    coalesce(sum(score * weight) filter (where available), 0),
    coalesce(sum(weight) filter (where available), 0),
    coalesce(round(sum(coverage) filter (where available) / 5), 0),
    coalesce(round(avg(reliability) filter (where available)), 0)
  into v_categories, v_weighted_sum, v_weight_total, v_coverage, v_reliability
  from weighted_categories;
  v_behavioral_score := case when v_weight_total >= 0.45 then round(v_weighted_sum / v_weight_total) else null end;

  select count(*) filter (where (public.compute_behavioral_observation_summary(coalesce((
      select jsonb_agg(jsonb_build_object(
        'observed_at_ms', o.observed_at_ms,
        'observation_type', o.observation_type,
        'payload', o.payload,
        'valid', o.valid,
        'reliability', o.reliability
      ) order by o.observed_at_ms, o.id)
      from public.behavioral_observations o
      where o.owner_id = v_owner_id and o.behavioral_session_id = p_session_id
        and o.behavioral_question_id = a.behavioral_question_id
    ), '[]'::jsonb))->'sampleAdequacy'->>'sufficient') = 'true')
  into v_adequate_answer_count
  from public.behavioral_answers a
  where a.behavioral_session_id = p_session_id and a.owner_id = v_owner_id;

  select avg(e.overall_score)::numeric
  into v_answer_quality_score
  from public.behavioral_questions q
  join public.interview_answers ia
    on ia.question_id = q.source_question_id and ia.owner_id = v_owner_id
  join public.answer_evaluations e
    on e.answer_id = ia.id and e.owner_id = v_owner_id
  where q.behavioral_session_id = p_session_id and q.owner_id = v_owner_id
    and q.source_question_id is not null;

  if v_include_answer_evaluation and v_answer_quality_score is not null and v_behavioral_score is not null then
    v_combined_score := round(v_answer_quality_score * 0.8 + v_behavioral_score * 0.2);
  end if;

  v_summary := jsonb_build_object(
    'categories', v_categories,
    'coverage', v_coverage,
    'reliability', v_reliability,
    'behavioralScore', v_behavioral_score,
    'answerQuality', v_answer_quality_score,
    'combinedScore', v_combined_score,
    'sampleAdequacy', jsonb_build_object(
      'processedAnswers', v_answer_count,
      'answersMeetingMinimum', coalesce(v_adequate_answer_count, 0),
      'minimumReliableFrames', 8,
      'minimumDurationSeconds', 3.5
    ),
    'questionCount', v_question_count,
    'answeredCount', v_answer_count,
    'insufficientData', v_behavioral_score is null,
    'limitations', jsonb_build_array(
      'Behavioral Coaching Score is an approximate practice metric, not a validated confidence, honesty, personality or hiring score.',
      'Unavailable categories are excluded from the weighted denominator rather than scored as zero.',
      'Camera-based question measurements require at least 8 reliable face samples spanning 3.5 seconds.'
    )
  );

  update public.behavioral_sessions
  set status = 'completed',
      behavioral_score = v_behavioral_score,
      coverage = v_coverage,
      reliability = v_reliability,
      answer_quality_score = v_answer_quality_score,
      combined_score = v_combined_score,
      summary = v_summary,
      completed_at = now()
  where id = p_session_id and owner_id = v_owner_id and status = 'in_progress';

  return v_summary;
end;
$$;

revoke all on function public.enforce_behavioral_session_in_progress() from public, anon;
revoke all on function public.guard_behavioral_session_initial_state() from public, anon;
revoke all on function public.save_behavioral_answer(uuid, uuid, text, text, numeric, numeric, timestamptz, timestamptz, jsonb, jsonb) from public, anon;
revoke all on function public.complete_behavioral_session(uuid) from public, anon;
grant execute on function public.save_behavioral_answer(uuid, uuid, text, text, numeric, numeric, timestamptz, timestamptz, jsonb, jsonb) to authenticated;
grant execute on function public.complete_behavioral_session(uuid) to authenticated;

commit;
