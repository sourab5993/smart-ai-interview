-- Server-only, database-backed token buckets shared by all application instances.
create table if not exists public.gemini_rate_limit_buckets (
  subject_id uuid not null,
  operation text not null check (
    operation in (
      'question_generation',
      'answer_evaluation',
      'report_generation',
      'audio_transcription',
      'resume_analysis',
      'job_match',
      'study_plan',
      'question_explanation'
    )
  ),
  tokens numeric not null check (tokens >= 0),
  refilled_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (subject_id, operation)
);
create index if not exists gemini_rate_limit_buckets_updated_idx
  on public.gemini_rate_limit_buckets(updated_at);
comment on table public.gemini_rate_limit_buckets is
  'Stores only a user UUID or fixed scheduled-work principal, operation, and token-bucket state; stale rows are removed after 30 days.';

alter table public.gemini_rate_limit_buckets enable row level security;
revoke all on public.gemini_rate_limit_buckets from public, anon, authenticated;

create or replace function public.consume_gemini_rate_limit(
  p_subject_id uuid,
  p_operation text,
  p_limit_per_window integer,
  p_window_seconds integer,
  p_burst integer
) returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  now_at timestamptz := clock_timestamp();
  current_tokens numeric;
  last_refilled_at timestamptz;
  available_tokens numeric;
  wait_seconds integer := 0;
  accepted boolean;
begin
  if p_subject_id is null
    or p_operation not in (
      'question_generation',
      'answer_evaluation',
      'report_generation',
      'audio_transcription',
      'resume_analysis',
      'job_match',
      'study_plan',
      'question_explanation'
    )
    or p_limit_per_window not between 1 and 10000
    or p_window_seconds not between 1 and 86400
    or p_burst not between 1 and 100
  then
    raise exception 'Invalid Gemini rate-limit arguments' using errcode = '22023';
  end if;

  delete from public.gemini_rate_limit_buckets
    where updated_at < now_at - interval '30 days';

  insert into public.gemini_rate_limit_buckets (
    subject_id, operation, tokens, refilled_at, updated_at
  )
  values (p_subject_id, p_operation, p_burst, now_at, now_at)
  on conflict (subject_id, operation) do nothing;

  select tokens, refilled_at
    into current_tokens, last_refilled_at
    from public.gemini_rate_limit_buckets
    where subject_id = p_subject_id and operation = p_operation
    for update;

  available_tokens := least(
    p_burst::numeric,
    current_tokens
      + greatest(0, extract(epoch from (now_at - last_refilled_at)))
        * p_limit_per_window / p_window_seconds
  );
  accepted := available_tokens >= 1;
  if accepted then
    available_tokens := available_tokens - 1;
  else
    wait_seconds := greatest(
      1,
      ceil((1 - available_tokens) * p_window_seconds / p_limit_per_window)::integer
    );
  end if;

  update public.gemini_rate_limit_buckets
    set tokens = available_tokens,
        refilled_at = now_at,
        updated_at = now_at
    where subject_id = p_subject_id and operation = p_operation;

  return query select accepted, wait_seconds;
end;
$$;

revoke all on function public.consume_gemini_rate_limit(uuid, text, integer, integer, integer)
  from public, anon, authenticated;
