-- Distinct audio-only Live Interview sessions. Camera analysis remains optional
-- and outside this session schema. Apply after the existing numbered migrations.

create table if not exists public.live_interview_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  target_role text not null check (length(trim(target_role)) between 1 and 160),
  duration_minutes integer not null check (duration_minutes in (5,10,15,20,30,45,60)),
  speech_language text not null default 'en-US' check (length(speech_language) between 2 and 20),
  status text not null default 'in_progress' check (status in ('in_progress','finalizing','completed','failed')),
  started_at timestamptz not null default clock_timestamp(),
  deadline_at timestamptz not null,
  completed_at timestamptz,
  report jsonb,
  report_error text,
  prompt_version text not null default 'live-interviewer-v1',
  rubric_version text not null default 'interview-rubric-v1',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.live_interview_turns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.live_interview_sessions(id) on delete cascade,
  turn_index integer not null check (turn_index between 0 and 100),
  question_text text not null check (length(trim(question_text)) between 1 and 2000),
  question_type text not null default 'role-specific',
  difficulty text not null default 'Medium',
  competencies jsonb not null default '[]'::jsonb,
  parent_turn_id uuid references public.live_interview_turns(id) on delete set null,
  transcript text check (transcript is null or length(trim(transcript)) between 1 and 12000),
  transcript_status text not null default 'pending' check (transcript_status in ('pending','accepted','unavailable')),
  evaluation jsonb,
  evaluation_status text not null default 'pending' check (evaluation_status in ('pending','completed','failed')),
  idempotency_key text not null check (length(idempotency_key) between 8 and 120),
  accepted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(session_id, turn_index),
  unique(session_id, idempotency_key)
);

create index if not exists live_interview_sessions_owner_idx
  on public.live_interview_sessions(owner_id, created_at desc);
create index if not exists live_interview_sessions_deadline_idx
  on public.live_interview_sessions(status, deadline_at);
create index if not exists live_interview_turns_session_idx
  on public.live_interview_turns(owner_id, session_id, turn_index);

create or replace function public.set_live_interview_deadline()
returns trigger language plpgsql set search_path=public as $$
begin
  new.started_at := clock_timestamp();
  new.deadline_at := new.started_at + make_interval(mins => new.duration_minutes);
  new.updated_at := new.started_at;
  return new;
end;
$$;
drop trigger if exists live_interview_deadline_insert on public.live_interview_sessions;
create trigger live_interview_deadline_insert
before insert on public.live_interview_sessions
for each row execute function public.set_live_interview_deadline();

create or replace function public.enforce_live_interview_turn()
returns trigger language plpgsql security invoker set search_path=public as $$
declare parent public.live_interview_sessions%rowtype;
begin
  select * into parent from public.live_interview_sessions
   where id=new.session_id and owner_id=new.owner_id;
  if not found then raise exception 'Live Interview session not found for this account' using errcode='23503'; end if;
  if tg_op='UPDATE' then
    if new.transcript is not null and old.transcript is not distinct from new.transcript then
      return new;
    end if;
  end if;
  if parent.status <> 'in_progress' then raise exception 'Live Interview is not accepting turns' using errcode='55000'; end if;
  if clock_timestamp() >= parent.deadline_at then raise exception 'Live Interview deadline has passed' using errcode='55000'; end if;
  if new.transcript is not null then new.accepted_at := clock_timestamp(); end if;
  return new;
end;
$$;
drop trigger if exists live_interview_turn_deadline on public.live_interview_turns;
create trigger live_interview_turn_deadline
before insert or update on public.live_interview_turns
for each row execute function public.enforce_live_interview_turn();

alter table public.live_interview_sessions enable row level security;
alter table public.live_interview_turns enable row level security;
drop policy if exists live_interview_sessions_owner_all on public.live_interview_sessions;
create policy live_interview_sessions_owner_all on public.live_interview_sessions
  for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists live_interview_turns_owner_all on public.live_interview_turns;
create policy live_interview_turns_owner_all on public.live_interview_turns
  for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
grant select,insert,update,delete on public.live_interview_sessions, public.live_interview_turns to authenticated;
