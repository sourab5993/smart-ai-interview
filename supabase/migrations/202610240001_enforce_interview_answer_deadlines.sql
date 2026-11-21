-- Server-authoritative cutoff for Simple Interview answers.
-- Answers saved before an evaluation request are considered accepted and can still
-- be evaluated/finalized after the deadline. New/changed answers are rejected.

create or replace function public.enforce_interview_answer_deadline()
returns trigger
language plpgsql
security invoker
set search_path = public
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
    -- A retry of the same accepted answer is idempotent, including after expiry.
    return new;
  end if;

  select * into parent
  from public.interview_sessions
  where id = new.session_id
    and owner_id = new.owner_id;

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

  return new;
end;
$$;

drop trigger if exists interview_answers_enforce_deadline on public.interview_answers;
create trigger interview_answers_enforce_deadline
before insert or update on public.interview_answers
for each row execute function public.enforce_interview_answer_deadline();
