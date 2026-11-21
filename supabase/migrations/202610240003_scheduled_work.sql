-- Private scheduler registry, run ledger and expiring finalizer leases. This migration
-- is additive and can be applied repeatedly; browser roles receive no access.
create table if not exists public.scheduled_job_registry (
  task_uid text primary key,
  job_type text not null check (job_type in ('question_bank_refresh','deadline_finalizer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.scheduled_job_runs (
  id uuid primary key default gen_random_uuid(),
  task_uid text not null references public.scheduled_job_registry(task_uid) on delete cascade,
  run_key text not null,
  status text not null check (status in ('running','completed','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  model text,
  prompt_version text,
  generated_count integer not null default 0 check (generated_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  error_summary text,
  unique(task_uid,run_key)
);
create index if not exists scheduled_job_runs_task_started_idx on public.scheduled_job_runs(task_uid,started_at desc);
create table if not exists public.scheduled_finalizer_claims (
  session_kind text not null check (session_kind in ('simple','live')),
  session_id uuid not null,
  lease_until timestamptz not null,
  lease_token uuid,
  last_error text,
  updated_at timestamptz not null default now(),
  primary key(session_kind,session_id)
);
alter table public.scheduled_finalizer_claims add column if not exists lease_token uuid;
alter table public.question_bank add column if not exists source text not null default 'curated';
alter table public.question_bank add column if not exists source_run_id uuid;
alter table public.question_bank add column if not exists question_category text not null default 'General';
alter table public.question_bank add column if not exists rationale text not null default '';
alter table public.live_interview_sessions add column if not exists camera_summary jsonb;
comment on column public.live_interview_sessions.camera_summary is 'Nullable, bounded aggregate framing metadata only; never store images, frames, audio, or landmark coordinates.';
alter table public.answer_evaluations add column if not exists model_version text;
alter table public.answer_evaluations add column if not exists prompt_version text;
alter table public.answer_evaluations add column if not exists rubric_version text;
alter table public.scheduled_job_runs add column if not exists prompt_version text;
create index if not exists question_bank_source_run_idx on public.question_bank(source_run_id) where source_run_id is not null;
create index if not exists scheduled_simple_deadline_idx on public.interview_sessions(status,created_at,duration_minutes);
create index if not exists scheduled_live_deadline_idx on public.live_interview_sessions(status,deadline_at);
-- No policies are created for internal scheduler tables. RLS is enabled, and all
-- browser grants are explicitly revoked; server uses only SUPABASE_DB_URL.
alter table public.scheduled_job_registry enable row level security;
alter table public.scheduled_job_runs enable row level security;
alter table public.scheduled_finalizer_claims enable row level security;
revoke all on public.scheduled_job_registry, public.scheduled_job_runs, public.scheduled_finalizer_claims from anon, authenticated;
revoke all on public.scheduled_job_registry, public.scheduled_job_runs, public.scheduled_finalizer_claims from public;

-- Browser-triggered completion and the server worker share this lease table.
-- These functions expose only an owner-checked claim/release operation, not the table.
drop function if exists public.claim_interview_finalization(text, uuid);
drop function if exists public.release_interview_finalization(text, uuid, text);
drop function if exists public.release_interview_finalization(text, uuid, uuid, text);
create or replace function public.claim_interview_finalization(
  p_session_kind text,
  p_session_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owns_session boolean := false;
  acquired uuid;
  locked_session uuid;
begin
  if auth.uid() is null or p_session_kind not in ('simple', 'live') then
    return null;
  end if;

  if p_session_kind = 'simple' then
    select id into locked_session
    from public.interview_sessions
    where id = p_session_id and owner_id = auth.uid() and status = 'in_progress'
    for update;
    owns_session := found;
  else
    select id into locked_session
    from public.live_interview_sessions
    where id = p_session_id and owner_id = auth.uid()
      and status in ('in_progress', 'failed', 'finalizing')
    for update;
    owns_session := found;
  end if;

  if not owns_session then
    return null;
  end if;

  insert into public.scheduled_finalizer_claims(session_kind, session_id, lease_until, lease_token)
  values (p_session_kind, p_session_id, now() + interval '20 minutes', gen_random_uuid())
  on conflict (session_kind, session_id) do update
    set lease_until = excluded.lease_until,
        lease_token = gen_random_uuid(),
        last_error = null,
        updated_at = now()
    where public.scheduled_finalizer_claims.lease_until < now()
  returning lease_token into acquired;

  return acquired;
end;
$$;

create or replace function public.release_interview_finalization(
  p_session_kind text,
  p_session_id uuid,
  p_claim_token uuid,
  p_failure_message text default null
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owns_session boolean := false;
  released boolean := false;
  locked_session uuid;
begin
  if auth.uid() is null or p_session_kind not in ('simple', 'live') then
    return false;
  end if;

  if p_session_kind = 'simple' then
    select id into locked_session
    from public.interview_sessions
    where id = p_session_id and owner_id = auth.uid()
    for update;
    owns_session := found;
  else
    select id into locked_session
    from public.live_interview_sessions
    where id = p_session_id and owner_id = auth.uid()
    for update;
    owns_session := found;
  end if;

  if not owns_session then
    return false;
  end if;

  perform 1
  from public.scheduled_finalizer_claims
  where session_kind = p_session_kind
    and session_id = p_session_id
    and lease_token = p_claim_token
  for update;

  if not found then
    return false;
  end if;

  if p_session_kind = 'simple' then
    if exists (
      select 1 from public.interview_sessions
      where id = p_session_id and owner_id = auth.uid() and status = 'completed'
    ) then
      return false;
    end if;
  else
    if exists (
      select 1 from public.live_interview_sessions
      where id = p_session_id and owner_id = auth.uid() and status = 'completed'
    ) then
      return false;
    end if;
    update public.live_interview_sessions
    set status = 'failed',
        report_error = 'Evaluation or report generation failed. Retry finalization.'
    where id = p_session_id
      and owner_id = auth.uid()
      and status = 'finalizing';
  end if;

  update public.scheduled_finalizer_claims
  set lease_until = now(),
      lease_token = null,
      last_error = left(coalesce(nullif(trim(p_failure_message), ''), 'Finalization failed; retry allowed.'), 200),
      updated_at = now()
  where session_kind = p_session_kind and session_id = p_session_id
    and lease_token = p_claim_token
  returning true into released;

  return coalesce(released, false);
end;
$$;

revoke all on function public.claim_interview_finalization(text, uuid) from public, anon;
revoke all on function public.release_interview_finalization(text, uuid, uuid, text) from public, anon;
grant execute on function public.claim_interview_finalization(text, uuid) to authenticated;
grant execute on function public.release_interview_finalization(text, uuid, uuid, text) to authenticated;


-- Evaluation writes and terminal report/status commits are fenced by the same
-- per-session finalization claim used by browser and scheduled workers.
create or replace function public.save_live_interview_evaluation(
  p_session_id uuid,
  p_turn_id uuid,
  p_evaluation jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved boolean := false;
begin
  if auth.uid() is null or jsonb_typeof(p_evaluation) <> 'object'
     or p_evaluation->>'source' <> 'ai'
     or pg_column_size(p_evaluation) > 65536 then
    return false;
  end if;

  perform 1
  from public.live_interview_sessions
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'in_progress'
  for update;

  if not found then
    return false;
  end if;

  update public.live_interview_turns
  set evaluation = p_evaluation,
      evaluation_status = 'completed'
  where id = p_turn_id
    and session_id = p_session_id
    and owner_id = auth.uid()
    and transcript_status = 'accepted'
    and transcript is not null
    and evaluation_status <> 'completed'
  returning true into saved;

  if not found then
    select exists (
      select 1 from public.live_interview_turns
      where id = p_turn_id
        and session_id = p_session_id
        and owner_id = auth.uid()
        and transcript_status = 'accepted'
        and evaluation_status = 'completed'
        and evaluation->>'source' = 'ai'
    ) into saved;
  end if;

  return coalesce(saved, false);
end;
$$;

create or replace function public.save_live_interview_finalized_turn(
  p_session_id uuid,
  p_turn_id uuid,
  p_claim_token uuid,
  p_evaluation jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved boolean := false;
begin
  if auth.uid() is null or jsonb_typeof(p_evaluation) <> 'object'
     or p_evaluation->>'source' <> 'ai'
     or pg_column_size(p_evaluation) > 65536 then
    return false;
  end if;

  perform 1
  from public.live_interview_sessions
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'finalizing'
  for update;

  if not found then
    return false;
  end if;

  perform 1
  from public.scheduled_finalizer_claims
  where session_kind = 'live'
    and session_id = p_session_id
    and lease_token = p_claim_token
    and lease_until > clock_timestamp()
  for update;

  if not found then
    return false;
  end if;

  update public.live_interview_turns
  set evaluation = p_evaluation,
      evaluation_status = 'completed'
  where id = p_turn_id
    and session_id = p_session_id
    and owner_id = auth.uid()
    and transcript_status = 'accepted'
    and transcript is not null
    and evaluation_status <> 'completed'
  returning true into saved;

  if not found then
    select exists (
      select 1 from public.live_interview_turns
      where id = p_turn_id
        and session_id = p_session_id
        and owner_id = auth.uid()
        and transcript_status = 'accepted'
        and evaluation_status = 'completed'
        and evaluation->>'source' = 'ai'
    ) into saved;
  end if;

  return coalesce(saved, false);
end;
$$;

create or replace function public.complete_live_interview_with_claim(
  p_session_id uuid,
  p_claim_token uuid,
  p_report jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer := 0;
begin
  if auth.uid() is null or jsonb_typeof(p_report) <> 'object'
     or pg_column_size(p_report) > 1048576 then
    return false;
  end if;

  perform 1
  from public.live_interview_sessions
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'finalizing'
  for update;

  if not found then
    return false;
  end if;

  perform 1
  from public.scheduled_finalizer_claims
  where session_kind = 'live'
    and session_id = p_session_id
    and lease_token = p_claim_token
    and lease_until > clock_timestamp()
  for update;

  if not found then
    return false;
  end if;

  update public.live_interview_sessions
  set status = 'completed',
      report = p_report,
      report_error = null,
      completed_at = clock_timestamp()
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'finalizing';
  get diagnostics affected = row_count;

  if affected <> 1 then
    return false;
  end if;

  update public.scheduled_finalizer_claims
  set lease_until = 'infinity'::timestamptz,
      last_error = null,
      updated_at = clock_timestamp()
  where session_kind = 'live'
    and session_id = p_session_id
    and lease_token = p_claim_token;

  return true;
end;
$$;

create or replace function public.complete_simple_interview_with_claim(
  p_session_id uuid,
  p_claim_token uuid,
  p_overall_score integer,
  p_report jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer := 0;
begin
  if auth.uid() is null
     or (p_overall_score is not null and (p_overall_score < 0 or p_overall_score > 100))
     or jsonb_typeof(p_report) <> 'object'
     or pg_column_size(p_report) > 1048576 then
    return false;
  end if;

  perform 1
  from public.interview_sessions
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'in_progress'
  for update;

  if not found then
    return false;
  end if;

  perform 1
  from public.scheduled_finalizer_claims
  where session_kind = 'simple'
    and session_id = p_session_id
    and lease_token = p_claim_token
    and lease_until > clock_timestamp()
  for update;

  if not found then
    return false;
  end if;

  insert into public.interview_reports(owner_id, session_id, analysis)
  values (auth.uid(), p_session_id, p_report)
  on conflict (session_id) do update
    set analysis = excluded.analysis
    where public.interview_reports.owner_id = auth.uid();
  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'Simple interview report could not be committed for its owner';
  end if;

  update public.interview_sessions
  set status = 'completed',
      overall_score = p_overall_score,
      duration_seconds = greatest(0, floor(extract(epoch from (clock_timestamp() - created_at)))::integer),
      completed_at = clock_timestamp()
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'in_progress';
  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'Simple interview status changed before report commit';
  end if;

  update public.scheduled_finalizer_claims
  set lease_until = 'infinity'::timestamptz,
      last_error = null,
      updated_at = clock_timestamp()
  where session_kind = 'simple'
    and session_id = p_session_id
    and lease_token = p_claim_token;

  return true;
end;
$$;

revoke all on function public.save_live_interview_evaluation(uuid, uuid, jsonb) from public, anon;
revoke all on function public.save_live_interview_finalized_turn(uuid, uuid, uuid, jsonb) from public, anon;
revoke all on function public.complete_live_interview_with_claim(uuid, uuid, jsonb) from public, anon;
revoke all on function public.complete_simple_interview_with_claim(uuid, uuid, integer, jsonb) from public, anon;
grant execute on function public.save_live_interview_evaluation(uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_live_interview_finalized_turn(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.complete_live_interview_with_claim(uuid, uuid, jsonb) to authenticated;
grant execute on function public.complete_simple_interview_with_claim(uuid, uuid, integer, jsonb) to authenticated;


-- Preserve honest unscorable results as NULL rather than a fabricated zero.

-- An unscorable report has no numeric score; NULL must remain distinct from zero.
ALTER TABLE public.interview_sessions
  ALTER COLUMN overall_score DROP NOT NULL;

-- A Simple answer score can be stored only while its owned session remains active,
-- and the first AI evaluation wins. The scheduler uses the same insert-on-conflict rule.
create or replace function public.save_simple_answer_evaluation(
  p_session_id uuid,
  p_answer_id uuid,
  p_evaluation jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_created timestamptz;
  session_duration integer;
  score integer;
  affected integer := 0;
begin
  if auth.uid() is null
     or jsonb_typeof(p_evaluation) <> 'object'
     or p_evaluation->>'source' <> 'ai'
     or jsonb_typeof(p_evaluation->'dimensions') <> 'array'
     or pg_column_size(p_evaluation) > 65536
     or coalesce(p_evaluation->>'overall_score', '') !~ '^[0-9]{1,3}$' then
    return false;
  end if;

  score := (p_evaluation->>'overall_score')::integer;
  if score < 0 or score > 100 then
    return false;
  end if;

  select created_at, duration_minutes
  into session_created, session_duration
  from public.interview_sessions
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'in_progress'
    and created_at + make_interval(mins => duration_minutes) > clock_timestamp()
  for update;

  if not found then
    return false;
  end if;

  perform 1
  from public.interview_answers a
  where a.id = p_answer_id
    and a.session_id = p_session_id
    and a.owner_id = auth.uid()
    and a.created_at <= session_created + make_interval(mins => session_duration)
  for key share;

  if not found then
    return false;
  end if;

  if exists (
    select 1 from public.answer_evaluations
    where answer_id = p_answer_id
      and owner_id = auth.uid()
      and source = 'ai'
  ) then
    return true;
  end if;

  insert into public.answer_evaluations(
    owner_id, answer_id, overall_score, dimensions, strengths, weaknesses,
    missing_points, better_answer, improvement_tip, source, model_version,
    prompt_version, rubric_version
  ) values (
    auth.uid(), p_answer_id, score, p_evaluation->'dimensions',
    coalesce(p_evaluation->'strengths', '[]'::jsonb),
    coalesce(p_evaluation->'weaknesses', '[]'::jsonb),
    coalesce(p_evaluation->'missing_points', '[]'::jsonb),
    left(coalesce(p_evaluation->>'better_answer', ''), 12000),
    left(coalesce(p_evaluation->>'improvement_tip', ''), 2000),
    'ai',
    left(coalesce(p_evaluation->>'modelVersion', ''), 120),
    left(coalesce(p_evaluation->>'promptVersion', ''), 120),
    left(coalesce(p_evaluation->>'rubricVersion', ''), 120)
  ) on conflict (answer_id) do nothing;

  get diagnostics affected = row_count;
  return affected = 1 or exists (
    select 1 from public.answer_evaluations
    where answer_id = p_answer_id and owner_id = auth.uid() and source = 'ai'
  );
end;
$$;

create or replace function public.save_live_interview_question(
  p_session_id uuid,
  p_turn_index integer,
  p_question_text text,
  p_question_type text,
  p_difficulty text,
  p_competencies text[],
  p_parent_turn_id uuid,
  p_idempotency_key text
) returns public.live_interview_turns
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved public.live_interview_turns;
begin
  if auth.uid() is null
     or p_turn_index < 0 or p_turn_index > 60
     or char_length(trim(coalesce(p_question_text, ''))) < 1
     or char_length(p_question_text) > 2000
     or char_length(coalesce(p_question_type, '')) > 80
     or char_length(coalesce(p_difficulty, '')) > 30
     or coalesce(cardinality(p_competencies), 0) > 12
     or char_length(coalesce(p_idempotency_key, '')) < 1
     or char_length(p_idempotency_key) > 160 then
    return null;
  end if;

  perform 1
  from public.live_interview_sessions
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'in_progress'
    and deadline_at > clock_timestamp()
  for update;

  if not found then
    return null;
  end if;

  select * into saved
  from public.live_interview_turns
  where session_id = p_session_id and turn_index = p_turn_index and owner_id = auth.uid();
  if found then return saved; end if;

  insert into public.live_interview_turns(
    owner_id, session_id, turn_index, question_text, question_type, difficulty,
    competencies, parent_turn_id, idempotency_key
  ) values (
    auth.uid(), p_session_id, p_turn_index, trim(p_question_text),
    p_question_type, p_difficulty, coalesce(p_competencies, '{}'::text[]),
    p_parent_turn_id, p_idempotency_key
  ) on conflict (session_id, turn_index) do nothing
  returning * into saved;

  if not found then
    select * into saved
    from public.live_interview_turns
    where session_id = p_session_id and turn_index = p_turn_index and owner_id = auth.uid();
  end if;
  return saved;
end;
$$;

create or replace function public.save_live_interview_transcript(
  p_session_id uuid,
  p_turn_id uuid,
  p_transcript text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved boolean := false;
begin
  if auth.uid() is null
     or char_length(trim(coalesce(p_transcript, ''))) < 1
     or char_length(p_transcript) > 12000 then
    return false;
  end if;

  perform 1
  from public.live_interview_sessions
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'in_progress'
    and deadline_at > clock_timestamp()
  for update;

  if not found then
    return false;
  end if;

  update public.live_interview_turns
  set transcript = trim(p_transcript), transcript_status = 'accepted'
  where id = p_turn_id
    and session_id = p_session_id
    and owner_id = auth.uid()
    and transcript_status <> 'accepted'
  returning true into saved;

  if not found then
    select exists (
      select 1 from public.live_interview_turns
      where id = p_turn_id
        and session_id = p_session_id
        and owner_id = auth.uid()
        and transcript_status = 'accepted'
        and transcript = trim(p_transcript)
    ) into saved;
  end if;

  return coalesce(saved, false);
end;
$$;

create or replace function public.save_live_interview_camera_summary(
  p_session_id uuid,
  p_summary jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  samples integer;
  face_count integer;
  shoulder_count integer;
  hand_count integer;
begin
  if auth.uid() is null or jsonb_typeof(p_summary) <> 'object'
     or p_summary->>'version' <> 'local-framing-v1' then
    return false;
  end if;
  begin
    samples := (p_summary->>'sample_count')::integer;
    face_count := (p_summary->>'face_present')::integer;
    shoulder_count := (p_summary->>'shoulders_present')::integer;
    hand_count := (p_summary->>'hands_present')::integer;
  exception when others then
    return false;
  end;
  if samples < 1 or samples > 10000
     or face_count < 0 or face_count > samples
     or shoulder_count < 0 or shoulder_count > samples
     or hand_count < 0 or hand_count > samples
     or pg_column_size(p_summary) > 4096 then
    return false;
  end if;

  perform 1
  from public.live_interview_sessions
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'in_progress'
    and deadline_at > clock_timestamp()
  for update;
  if not found then return false; end if;

  update public.live_interview_sessions
  set camera_summary = p_summary
  where id = p_session_id and owner_id = auth.uid() and status = 'in_progress'
    and deadline_at > clock_timestamp();
  return found;
end;
$$;

revoke all on function public.save_simple_answer_evaluation(uuid, uuid, jsonb) from public, anon;
revoke all on function public.save_live_interview_question(uuid, integer, text, text, text, text[], uuid, text) from public, anon;
revoke all on function public.save_live_interview_transcript(uuid, uuid, text) from public, anon;
revoke all on function public.save_live_interview_camera_summary(uuid, jsonb) from public, anon;
grant execute on function public.save_simple_answer_evaluation(uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_live_interview_question(uuid, integer, text, text, text, text[], uuid, text) to authenticated;
grant execute on function public.save_live_interview_transcript(uuid, uuid, text) to authenticated;
grant execute on function public.save_live_interview_camera_summary(uuid, jsonb) to authenticated;

-- Strengthen the earlier RPCs with additional input and parent-turn checks. These
-- replacements remain safe when this additive migration is run as one transaction.
create or replace function public.save_live_interview_question(
  p_session_id uuid,
  p_turn_index integer,
  p_question_text text,
  p_question_type text,
  p_difficulty text,
  p_competencies text[],
  p_parent_turn_id uuid,
  p_idempotency_key text
) returns public.live_interview_turns
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved public.live_interview_turns;
begin
  if auth.uid() is null
     or p_turn_index < 0 or p_turn_index > 60
     or char_length(trim(coalesce(p_question_text, ''))) < 1
     or char_length(p_question_text) > 2000
     or char_length(trim(coalesce(p_question_type, ''))) < 1
     or char_length(p_question_type) > 80
     or char_length(trim(coalesce(p_difficulty, ''))) < 1
     or char_length(p_difficulty) > 30
     or coalesce(cardinality(p_competencies), 0) > 12
     or exists (
       select 1 from unnest(coalesce(p_competencies, '{}'::text[])) as item(value)
       where char_length(item.value) > 80
     )
     or char_length(coalesce(p_idempotency_key, '')) < 1
     or char_length(p_idempotency_key) > 160 then
    return null;
  end if;

  perform 1
  from public.live_interview_sessions
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'in_progress'
    and deadline_at > clock_timestamp()
  for update;

  if not found then
    return null;
  end if;

  if p_parent_turn_id is not null and not exists (
    select 1 from public.live_interview_turns parent
    where parent.id = p_parent_turn_id
      and parent.session_id = p_session_id
      and parent.owner_id = auth.uid()
      and parent.turn_index < p_turn_index
  ) then
    return null;
  end if;

  select * into saved
  from public.live_interview_turns
  where session_id = p_session_id and turn_index = p_turn_index and owner_id = auth.uid();
  if found then return saved; end if;

  insert into public.live_interview_turns(
    owner_id, session_id, turn_index, question_text, question_type, difficulty,
    competencies, parent_turn_id, idempotency_key
  ) values (
    auth.uid(), p_session_id, p_turn_index, trim(p_question_text),
    trim(p_question_type), trim(p_difficulty), coalesce(p_competencies, '{}'::text[]),
    p_parent_turn_id, p_idempotency_key
  ) on conflict (session_id, turn_index) do nothing
  returning * into saved;

  if not found then
    select * into saved
    from public.live_interview_turns
    where session_id = p_session_id and turn_index = p_turn_index and owner_id = auth.uid();
  end if;
  return saved;
end;
$$;

create or replace function public.save_simple_answer_evaluation(
  p_session_id uuid,
  p_answer_id uuid,
  p_evaluation jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_created timestamptz;
  session_duration integer;
  score integer;
  affected integer := 0;
begin
  if auth.uid() is null
     or jsonb_typeof(p_evaluation) <> 'object'
     or p_evaluation->>'source' <> 'ai'
     or jsonb_typeof(p_evaluation->'dimensions') <> 'array'
     or pg_column_size(p_evaluation) > 65536
     or coalesce(p_evaluation->>'overall_score', '') !~ '^[0-9]{1,3}$'
     or (p_evaluation ? 'strengths' and jsonb_typeof(p_evaluation->'strengths') <> 'array')
     or (p_evaluation ? 'weaknesses' and jsonb_typeof(p_evaluation->'weaknesses') <> 'array')
     or (p_evaluation ? 'missing_points' and jsonb_typeof(p_evaluation->'missing_points') <> 'array') then
    return false;
  end if;

  score := (p_evaluation->>'overall_score')::integer;
  if score < 0 or score > 100 then
    return false;
  end if;

  select created_at, duration_minutes
  into session_created, session_duration
  from public.interview_sessions
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'in_progress'
    and created_at + make_interval(mins => duration_minutes) > clock_timestamp()
  for update;

  if not found then
    return false;
  end if;

  if exists (
    select 1 from public.scheduled_finalizer_claims
    where session_kind = 'simple'
      and session_id = p_session_id
      and lease_until > clock_timestamp()
  ) then
    return false;
  end if;

  perform 1
  from public.interview_answers a
  where a.id = p_answer_id
    and a.session_id = p_session_id
    and a.owner_id = auth.uid()
    and a.created_at <= session_created + make_interval(mins => session_duration)
  for key share;

  if not found then
    return false;
  end if;

  if exists (
    select 1 from public.answer_evaluations
    where answer_id = p_answer_id
      and owner_id = auth.uid()
      and source = 'ai'
  ) then
    return true;
  end if;

  insert into public.answer_evaluations(
    owner_id, answer_id, overall_score, dimensions, strengths, weaknesses,
    missing_points, better_answer, improvement_tip, source, model_version,
    prompt_version, rubric_version
  ) values (
    auth.uid(), p_answer_id, score, p_evaluation->'dimensions',
    coalesce(p_evaluation->'strengths', '[]'::jsonb),
    coalesce(p_evaluation->'weaknesses', '[]'::jsonb),
    coalesce(p_evaluation->'missing_points', '[]'::jsonb),
    left(coalesce(p_evaluation->>'better_answer', ''), 12000),
    left(coalesce(p_evaluation->>'improvement_tip', ''), 2000),
    'ai',
    left(coalesce(p_evaluation->>'modelVersion', ''), 120),
    left(coalesce(p_evaluation->>'promptVersion', ''), 120),
    left(coalesce(p_evaluation->>'rubricVersion', ''), 120)
  ) on conflict (answer_id) do nothing;

  get diagnostics affected = row_count;
  return affected = 1 or exists (
    select 1 from public.answer_evaluations
    where answer_id = p_answer_id and owner_id = auth.uid() and source = 'ai'
  );
end;
$$;

-- Live turn competencies are JSONB in the existing schema, not text[]. Drop the
-- earlier provisional overload so PostgREST has exactly one unambiguous RPC.
drop function if exists public.save_live_interview_question(uuid, integer, text, text, text, text[], uuid, text);

create or replace function public.save_live_interview_question(
  p_session_id uuid,
  p_turn_index integer,
  p_question_text text,
  p_question_type text,
  p_difficulty text,
  p_competencies jsonb,
  p_parent_turn_id uuid,
  p_idempotency_key text
) returns public.live_interview_turns
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved public.live_interview_turns;
  competencies jsonb := coalesce(p_competencies, '[]'::jsonb);
begin
  if auth.uid() is null
     or p_turn_index < 0 or p_turn_index > 60
     or char_length(trim(coalesce(p_question_text, ''))) < 1
     or char_length(p_question_text) > 2000
     or char_length(trim(coalesce(p_question_type, ''))) < 1
     or char_length(p_question_type) > 80
     or char_length(trim(coalesce(p_difficulty, ''))) < 1
     or char_length(p_difficulty) > 30
     or jsonb_typeof(competencies) <> 'array'
     or jsonb_array_length(competencies) > 12
     or exists (
       select 1 from jsonb_array_elements_text(competencies) as item(value)
       where char_length(item.value) > 80
     )
     or char_length(coalesce(p_idempotency_key, '')) < 8
     or char_length(p_idempotency_key) > 120 then
    return null;
  end if;

  perform 1
  from public.live_interview_sessions
  where id = p_session_id
    and owner_id = auth.uid()
    and status = 'in_progress'
    and deadline_at > clock_timestamp()
  for update;
  if not found then return null; end if;

  if p_parent_turn_id is not null and not exists (
    select 1 from public.live_interview_turns parent
    where parent.id = p_parent_turn_id
      and parent.session_id = p_session_id
      and parent.owner_id = auth.uid()
      and parent.turn_index < p_turn_index
  ) then
    return null;
  end if;

  select * into saved
  from public.live_interview_turns
  where session_id = p_session_id and turn_index = p_turn_index and owner_id = auth.uid();
  if found then return saved; end if;

  insert into public.live_interview_turns(
    owner_id, session_id, turn_index, question_text, question_type, difficulty,
    competencies, parent_turn_id, idempotency_key
  ) values (
    auth.uid(), p_session_id, p_turn_index, trim(p_question_text),
    trim(p_question_type), trim(p_difficulty), competencies,
    p_parent_turn_id, p_idempotency_key
  ) on conflict (session_id, turn_index) do nothing
  returning * into saved;

  if not found then
    select * into saved
    from public.live_interview_turns
    where session_id = p_session_id and turn_index = p_turn_index and owner_id = auth.uid();
  end if;
  return saved;
end;
$$;

revoke all on function public.save_live_interview_question(uuid, integer, text, text, text, jsonb, uuid, text) from public, anon;
grant execute on function public.save_live_interview_question(uuid, integer, text, text, text, jsonb, uuid, text) to authenticated;

-- Make the existing table-write compatibility path safe too. The browser is
-- upgraded to the RPC below, but older published clients still use PostgREST.
create or replace function public.enforce_interview_answer_deadline()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent public.interview_sessions%rowtype;
begin
  if tg_op = 'UPDATE'
     and new.owner_id = old.owner_id
     and new.session_id = old.session_id
     and new.question_id = old.question_id
     and new.answer_text = old.answer_text
     and new.answer_mode = old.answer_mode then
    return new;
  end if;

  if tg_op = 'UPDATE' and (
       new.owner_id <> old.owner_id
       or new.session_id <> old.session_id
       or new.question_id <> old.question_id
     ) then
    raise exception 'Interview answer ownership and question links are immutable'
      using errcode = '55000';
  end if;

  select * into parent
  from public.interview_sessions
  where id = new.session_id
    and owner_id = new.owner_id
  for update;

  if not found then
    raise exception 'Interview session not found for this account'
      using errcode = '23503';
  end if;
  if parent.status <> 'in_progress' then
    raise exception 'This interview is no longer accepting answers'
      using errcode = '55000';
  end if;
  if clock_timestamp() >= parent.created_at + make_interval(mins => parent.duration_minutes) then
    raise exception 'The interview deadline has passed; new answers are not accepted'
      using errcode = '55000';
  end if;
  if exists (
    select 1 from public.scheduled_finalizer_claims
    where session_kind = 'simple'
      and session_id = new.session_id
      and lease_until > clock_timestamp()
  ) then
    raise exception 'This interview is being finalized; answer changes are closed'
      using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.interview_questions
    where id = new.question_id
      and session_id = new.session_id
      and owner_id = new.owner_id
  ) then
    raise exception 'Interview question does not belong to this session'
      using errcode = '23503';
  end if;
  if tg_op = 'UPDATE' and exists (
    select 1 from public.answer_evaluations
    where answer_id = old.id
  ) then
    raise exception 'An evaluated answer cannot be replaced'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function public.save_simple_interview_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_answer_text text,
  p_answer_mode text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent public.interview_sessions%rowtype;
  saved public.interview_answers%rowtype;
  has_existing boolean := false;
begin
  if auth.uid() is null
     or p_session_id is null
     or p_question_id is null
     or p_answer_text is null
     or char_length(trim(p_answer_text)) < 2
     or char_length(p_answer_text) > 12000
     or coalesce(p_answer_mode, '') not in ('text', 'voice') then
    return null;
  end if;

  select * into parent
  from public.interview_sessions
  where id = p_session_id and owner_id = auth.uid()
  for update;
  if not found then return null; end if;

  select * into saved
  from public.interview_answers
  where question_id = p_question_id
    and session_id = p_session_id
    and owner_id = auth.uid()
  for update;
  has_existing := found;

  if has_existing
     and saved.answer_text = trim(p_answer_text)
     and saved.answer_mode = p_answer_mode then
    return jsonb_build_object(
      'id', saved.id,
      'question_id', saved.question_id,
      'answer_text', saved.answer_text,
      'answer_mode', saved.answer_mode,
      'created_at', saved.created_at
    );
  end if;

  if parent.status <> 'in_progress'
     or clock_timestamp() >= parent.created_at + make_interval(mins => parent.duration_minutes)
     or exists (
       select 1 from public.scheduled_finalizer_claims
       where session_kind = 'simple'
         and session_id = p_session_id
         and lease_until > clock_timestamp()
     ) then
    return null;
  end if;

  perform 1
  from public.interview_questions
  where id = p_question_id
    and session_id = p_session_id
    and owner_id = auth.uid()
  for key share;
  if not found then return null; end if;

  if has_existing and exists (
    select 1 from public.answer_evaluations where answer_id = saved.id
  ) then
    return null;
  end if;

  insert into public.interview_answers(
    owner_id, session_id, question_id, answer_text, answer_mode
  ) values (
    auth.uid(), p_session_id, p_question_id, trim(p_answer_text), p_answer_mode
  )
  on conflict (question_id) do update
    set answer_text = excluded.answer_text,
        answer_mode = excluded.answer_mode
    where public.interview_answers.owner_id = auth.uid()
      and public.interview_answers.session_id = p_session_id
  returning * into saved;

  if not found then return null; end if;
  return jsonb_build_object(
    'id', saved.id,
    'question_id', saved.question_id,
    'answer_text', saved.answer_text,
    'answer_mode', saved.answer_mode,
    'created_at', saved.created_at
  );
end;
$$;

revoke all on function public.save_simple_interview_answer(uuid, uuid, text, text) from public, anon;
grant execute on function public.save_simple_interview_answer(uuid, uuid, text, text) to authenticated;
comment on function public.save_simple_interview_answer(uuid, uuid, text, text) is
  'Owner-scoped, server-deadline-checked Simple Interview answer save serialized against finalizer claims.';
