-- Behavioral Interview Analysis is additive. Original interview tables and scores remain unchanged.
create table if not exists public.behavioral_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_session_id uuid references public.interview_sessions(id) on delete set null,
  status text not null default 'setup' check(status in ('setup','in_progress','processing','completed','cancelled','failed')),
  include_answer_evaluation boolean not null default true,
  consent jsonb not null default '{}',
  model_metadata jsonb not null default '{}',
  behavioral_score numeric(5,2) check(behavioral_score between 0 and 100),
  coverage numeric(5,2) check(coverage between 0 and 100),
  reliability numeric(5,2) check(reliability between 0 and 100),
  answer_quality_score numeric(5,2) check(answer_quality_score between 0 and 100),
  combined_score numeric(5,2) check(combined_score between 0 and 100),
  summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.behavioral_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  behavioral_session_id uuid not null references public.behavioral_sessions(id) on delete cascade,
  source_session_id uuid not null references public.interview_sessions(id) on delete restrict,
  source_question_id uuid not null references public.interview_questions(id) on delete restrict,
  question_text text not null,
  topic text not null default '',
  difficulty text not null default 'Medium',
  rationale text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(behavioral_session_id,source_question_id)
);

create table if not exists public.behavioral_answers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  behavioral_session_id uuid not null references public.behavioral_sessions(id) on delete cascade,
  behavioral_question_id uuid not null references public.behavioral_questions(id) on delete cascade,
  transcript text,
  transcript_language text,
  transcript_confidence numeric(5,4),
  duration_seconds numeric(8,2),
  started_at timestamptz,
  ended_at timestamptz,
  observation_summary jsonb not null default '{}',
  behavioral_score numeric(5,2) check(behavioral_score between 0 and 100),
  coverage numeric(5,2) check(coverage between 0 and 100),
  reliability numeric(5,2) check(reliability between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(behavioral_session_id,behavioral_question_id)
);

create table if not exists public.behavioral_observations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  behavioral_session_id uuid not null references public.behavioral_sessions(id) on delete cascade,
  behavioral_question_id uuid not null references public.behavioral_questions(id) on delete cascade,
  observed_at_ms bigint not null,
  observation_type text not null,
  payload jsonb not null default '{}',
  valid boolean not null default true,
  reliability numeric(5,2),
  created_at timestamptz not null default now()
);

-- Behavioral sessions can use fresh Gemini questions, so source links are
-- optional while remaining available for sessions created from saved history.
alter table public.behavioral_questions alter column source_session_id drop not null;
alter table public.behavioral_questions alter column source_question_id drop not null;

create index if not exists behavioral_sessions_owner_created_idx on public.behavioral_sessions(owner_id,created_at desc);
create index if not exists behavioral_questions_session_idx on public.behavioral_questions(behavioral_session_id,sort_order);
create index if not exists behavioral_answers_session_idx on public.behavioral_answers(behavioral_session_id,created_at);
create index if not exists behavioral_observations_question_idx on public.behavioral_observations(behavioral_question_id,observed_at_ms);

drop trigger if exists behavioral_answers_set_updated_at on public.behavioral_answers;
create trigger behavioral_answers_set_updated_at before update on public.behavioral_answers for each row execute function public.set_updated_at();

-- RLS checks the direct owner column; these triggers also prevent a valid owner
-- from attaching a child row to another owner's parent.
create or replace function public.enforce_behavioral_owner_relationship() returns trigger language plpgsql set search_path=public as $$
declare parent_owner uuid; question_owner uuid;
begin
  if tg_table_name='behavioral_sessions' then
    if new.source_session_id is null then return new; end if;
    select owner_id into parent_owner from public.interview_sessions where id=new.source_session_id;
  elsif tg_table_name='behavioral_questions' then
    select owner_id into parent_owner from public.behavioral_sessions where id=new.behavioral_session_id;
    if new.source_question_id is null then
      if parent_owner is null or parent_owner<>new.owner_id then raise exception 'Behavioral parent record is not owned by this account'; end if;
      return new;
    end if;
    select owner_id into question_owner from public.interview_questions where id=new.source_question_id and session_id=new.source_session_id;
    if question_owner is null or question_owner<>new.owner_id then raise exception 'Source question is not owned by this account'; end if;
  elsif tg_table_name='behavioral_answers' then
    select owner_id into parent_owner from public.behavioral_sessions where id=new.behavioral_session_id;
    select owner_id into question_owner from public.behavioral_questions where id=new.behavioral_question_id and behavioral_session_id=new.behavioral_session_id;
    if question_owner is null or question_owner<>new.owner_id then raise exception 'Behavioral question is not owned by this account'; end if;
  elsif tg_table_name='behavioral_observations' then
    select owner_id into parent_owner from public.behavioral_sessions where id=new.behavioral_session_id;
    select owner_id into question_owner from public.behavioral_questions where id=new.behavioral_question_id and behavioral_session_id=new.behavioral_session_id;
    if question_owner is null or question_owner<>new.owner_id then raise exception 'Behavioral question is not owned by this account'; end if;
  else return new;
  end if;
  if parent_owner is null or parent_owner<>new.owner_id then raise exception 'Behavioral parent record is not owned by this account'; end if;
  return new;
end $$;
drop trigger if exists enforce_behavioral_session_owner on public.behavioral_sessions;
create trigger enforce_behavioral_session_owner before insert or update on public.behavioral_sessions for each row execute function public.enforce_behavioral_owner_relationship();
drop trigger if exists enforce_behavioral_question_owner on public.behavioral_questions;
create trigger enforce_behavioral_question_owner before insert or update on public.behavioral_questions for each row execute function public.enforce_behavioral_owner_relationship();
drop trigger if exists enforce_behavioral_answer_owner on public.behavioral_answers;
create trigger enforce_behavioral_answer_owner before insert or update on public.behavioral_answers for each row execute function public.enforce_behavioral_owner_relationship();
drop trigger if exists enforce_behavioral_observation_owner on public.behavioral_observations;
create trigger enforce_behavioral_observation_owner before insert or update on public.behavioral_observations for each row execute function public.enforce_behavioral_owner_relationship();

grant select, insert, update, delete on table public.behavioral_sessions, public.behavioral_questions, public.behavioral_answers, public.behavioral_observations to authenticated;

-- Candidate-owned behavioral records use the same authenticated owner boundary as the original interview.
do $$ declare t text; begin
  foreach t in array array['behavioral_sessions','behavioral_questions','behavioral_answers','behavioral_observations'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I',t||'_owner_select',t);
    execute format('drop policy if exists %I on public.%I',t||'_owner_insert',t);
    execute format('drop policy if exists %I on public.%I',t||'_owner_update',t);
    execute format('drop policy if exists %I on public.%I',t||'_owner_delete',t);
    execute format('create policy %I on public.%I for select to authenticated using(owner_id=auth.uid())',t||'_owner_select',t);
    execute format('create policy %I on public.%I for insert to authenticated with check(owner_id=auth.uid())',t||'_owner_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid())',t||'_owner_update',t);
    execute format('create policy %I on public.%I for delete to authenticated using(owner_id=auth.uid())',t||'_owner_delete',t);
  end loop;
end $$;
