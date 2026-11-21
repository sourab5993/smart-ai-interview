-- Additive interview context and maintained timestamps; no user data is deleted.
alter table public.interview_sessions add column if not exists semester text not null default '';
alter table public.interview_sessions add column if not exists context_notes text not null default '';
alter table public.interview_answers add column if not exists updated_at timestamptz not null default now();
alter table public.answer_evaluations add column if not exists updated_at timestamptz not null default now();
alter table public.performance_metrics add column if not exists updated_at timestamptz not null default now();
alter table public.ml_predictions add column if not exists updated_at timestamptz not null default now();
alter table public.activity_logs add column if not exists updated_at timestamptz not null default now();

alter table public.course_categories add column if not exists updated_at timestamptz not null default now();
alter table public.specializations add column if not exists updated_at timestamptz not null default now();
alter table public.careers add column if not exists updated_at timestamptz not null default now();
alter table public.job_roles add column if not exists updated_at timestamptz not null default now();
alter table public.skills add column if not exists updated_at timestamptz not null default now();
alter table public.user_skills add column if not exists updated_at timestamptz not null default now();
alter table public.interview_sessions add column if not exists updated_at timestamptz not null default now();
alter table public.interview_questions add column if not exists updated_at timestamptz not null default now();
alter table public.interview_reports add column if not exists updated_at timestamptz not null default now();
alter table public.resumes add column if not exists updated_at timestamptz not null default now();
alter table public.resume_analysis add column if not exists updated_at timestamptz not null default now();
alter table public.job_descriptions add column if not exists updated_at timestamptz not null default now();
alter table public.job_matches add column if not exists updated_at timestamptz not null default now();
alter table public.study_plans add column if not exists updated_at timestamptz not null default now();
alter table public.study_plan_items add column if not exists updated_at timestamptz not null default now();
alter table public.bookmarks add column if not exists updated_at timestamptz not null default now();
alter table public.notifications add column if not exists updated_at timestamptz not null default now();
alter table public.question_bank add column if not exists updated_at timestamptz not null default now();
alter table public.interview_types add column if not exists updated_at timestamptz not null default now();
alter table public.question_categories add column if not exists updated_at timestamptz not null default now();
alter table public.evaluation_criteria add column if not exists updated_at timestamptz not null default now();
alter table public.difficulty_levels add column if not exists updated_at timestamptz not null default now();

-- Keep update timestamps consistent for editable catalogs, profiles and learner workflows.
do $$ declare t text; begin
  foreach t in array array['course_categories','courses','specializations','careers','job_roles','skills','course_skills','role_skills','profiles','user_skills','interview_sessions','interview_questions','interview_answers','answer_evaluations','interview_reports','resumes','resume_analysis','job_descriptions','job_matches','performance_metrics','skill_gaps','study_plans','study_plan_items','bookmarks','notifications','activity_logs','ml_predictions','question_bank','interview_types','question_categories','evaluation_criteria','difficulty_levels'] loop
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='updated_at') then
      execute format('drop trigger if exists app_updated_at on public.%I',t);
      execute format('create trigger app_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
    end if;
  end loop;
end $$;

-- Guard child rows against being attached to another account's parent record.
create or replace function public.enforce_owner_relationship() returns trigger language plpgsql set search_path=public as $$
declare parent_owner uuid; question_owner uuid;
begin
  if tg_table_name='interview_questions' then
    select owner_id into parent_owner from public.interview_sessions where id=new.session_id;
  elsif tg_table_name='interview_answers' then
    select owner_id into parent_owner from public.interview_sessions where id=new.session_id;
    select owner_id into question_owner from public.interview_questions where id=new.question_id and session_id=new.session_id;
    if question_owner is null or question_owner<>new.owner_id then raise exception 'Question is not owned by this account and session'; end if;
  elsif tg_table_name='answer_evaluations' then
    select owner_id into parent_owner from public.interview_answers where id=new.answer_id;
  elsif tg_table_name='interview_reports' then
    select owner_id into parent_owner from public.interview_sessions where id=new.session_id;
  elsif tg_table_name='resume_analysis' then
    if new.resume_id is not null then select owner_id into parent_owner from public.resumes where id=new.resume_id; else return new; end if;
  elsif tg_table_name='job_matches' then
    if new.resume_id is not null then select owner_id into parent_owner from public.resumes where id=new.resume_id; end if;
    if new.job_description_id is not null then
      select owner_id into question_owner from public.job_descriptions where id=new.job_description_id;
      if question_owner is null or question_owner<>new.owner_id then raise exception 'Job description is not owned by this account'; end if;
    end if;
    if new.resume_id is null then return new; end if;
  elsif tg_table_name='performance_metrics' then
    if new.session_id is null then return new; end if;
    select owner_id into parent_owner from public.interview_sessions where id=new.session_id;
  elsif tg_table_name='study_plan_items' then
    select owner_id into parent_owner from public.study_plans where id=new.plan_id;
  else
    return new;
  end if;
  if parent_owner is null or parent_owner<>new.owner_id then raise exception 'Parent record is not owned by this account'; end if;
  return new;
end$$;

do $$ begin
  drop trigger if exists enforce_session_question_owner on public.interview_questions;
  create trigger enforce_session_question_owner before insert or update on public.interview_questions for each row execute function public.enforce_owner_relationship();
  drop trigger if exists enforce_answer_owner on public.interview_answers;
  create trigger enforce_answer_owner before insert or update on public.interview_answers for each row execute function public.enforce_owner_relationship();
  drop trigger if exists enforce_evaluation_owner on public.answer_evaluations;
  create trigger enforce_evaluation_owner before insert or update on public.answer_evaluations for each row execute function public.enforce_owner_relationship();
  drop trigger if exists enforce_report_owner on public.interview_reports;
  create trigger enforce_report_owner before insert or update on public.interview_reports for each row execute function public.enforce_owner_relationship();
  drop trigger if exists enforce_resume_analysis_owner on public.resume_analysis;
  create trigger enforce_resume_analysis_owner before insert or update on public.resume_analysis for each row execute function public.enforce_owner_relationship();
  drop trigger if exists enforce_job_match_owner on public.job_matches;
  create trigger enforce_job_match_owner before insert or update on public.job_matches for each row execute function public.enforce_owner_relationship();
  drop trigger if exists enforce_performance_metric_owner on public.performance_metrics;
  create trigger enforce_performance_metric_owner before insert or update on public.performance_metrics for each row execute function public.enforce_owner_relationship();
  drop trigger if exists enforce_study_item_owner on public.study_plan_items;
  create trigger enforce_study_item_owner before insert or update on public.study_plan_items for each row execute function public.enforce_owner_relationship();
end $$;

create index if not exists interview_reports_owner_created_idx on public.interview_reports(owner_id,created_at desc);
create index if not exists resumes_owner_created_idx on public.resumes(owner_id,created_at desc);
create index if not exists job_matches_owner_created_idx on public.job_matches(owner_id,created_at desc);
create index if not exists skill_gaps_owner_priority_idx on public.skill_gaps(owner_id,priority,current_score);
create index if not exists bookmarks_owner_type_created_idx on public.bookmarks(owner_id,target_type,created_at desc);
create index if not exists activity_logs_owner_created_idx on public.activity_logs(owner_id,created_at desc);

-- Re-state the REST grants explicitly so installations migrated from older Postgres defaults work.
grant usage on schema public to anon, authenticated;
grant select on table public.course_categories, public.courses, public.specializations, public.careers, public.job_roles, public.skills, public.course_skills, public.role_skills, public.question_bank, public.demo_students, public.demo_interviews, public.interview_types, public.question_categories, public.evaluation_criteria, public.difficulty_levels to anon, authenticated;
grant insert, update, delete on table public.course_categories, public.courses, public.specializations, public.careers, public.job_roles, public.skills, public.course_skills, public.role_skills, public.question_bank, public.interview_types, public.question_categories, public.evaluation_criteria, public.difficulty_levels to authenticated;
grant select, insert, update, delete on table public.profiles, public.user_skills, public.interview_sessions, public.interview_questions, public.interview_answers, public.answer_evaluations, public.interview_reports, public.resumes, public.resume_analysis, public.job_descriptions, public.job_matches, public.performance_metrics, public.skill_gaps, public.study_plans, public.study_plan_items, public.bookmarks, public.notifications, public.activity_logs, public.ml_predictions to authenticated;
