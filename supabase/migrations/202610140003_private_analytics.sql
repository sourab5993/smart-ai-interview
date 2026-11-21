-- Profile preferences added after the core schema to preserve compatibility with existing rows.
alter table public.profiles add column if not exists default_difficulty text not null default 'Medium';
alter table public.profiles add column if not exists theme_preference text not null default 'dark' check(theme_preference in ('dark','system'));
alter table public.profiles add column if not exists email_notifications boolean not null default true;
alter table public.profiles add column if not exists notifications_enabled boolean not null default true;

-- Tighten every learner-owned table: admins receive only purpose-built aggregates/directory fields.
do $$ declare t text; begin
  foreach t in array array['user_skills','interview_sessions','interview_questions','interview_answers','answer_evaluations','interview_reports','resumes','resume_analysis','job_descriptions','job_matches','performance_metrics','skill_gaps','study_plans','study_plan_items','bookmarks','notifications','activity_logs','ml_predictions'] loop
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

create or replace function public.prevent_self_role_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
    raise exception 'Only an administrator can change account role';
  end if;
  return new;
end$$;

-- These definer functions enforce authorization and return no answer text or private resume content.
create or replace function public.admin_dashboard_stats() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'total_users',(select count(*) from public.profiles),
    'active_users_30d',(select count(distinct owner_id) from public.interview_sessions where created_at>=now()-interval '30 days'),
    'interviews',(select count(*) from public.interview_sessions),
    'completed_interviews',(select count(*) from public.interview_sessions where status='completed'),
    'questions',(select count(*) from public.question_bank where active),
    'average_score',(select coalesce(round(avg(overall_score)),0) from public.interview_sessions where status='completed' and overall_score is not null),
    'completion_rate',(select coalesce(round(100.0*count(*) filter(where status='completed')/nullif(count(*),0)),0) from public.interview_sessions),
    'popular_roles',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (select target_role as role,count(*) as count from public.interview_sessions group by target_role order by count desc limit 8) r),
    'weak_areas',(select coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from (select skill_name as skill,round(avg(current_score)) as average_score,count(*) as learners from public.skill_gaps group by skill_name order by average_score asc limit 8) w),
    'usage_14d',(select coalesce(jsonb_agg(to_jsonb(d) order by d.day),'[]'::jsonb) from (select g.day::date as day,count(s.id) as sessions from generate_series(current_date-13,current_date,interval '1 day') g(day) left join public.interview_sessions s on s.created_at::date=g.day::date group by g.day order by g.day) d)
  ) into result;
  return result;
end$$;
create or replace function public.admin_user_directory() returns table(id uuid,full_name text,email text,course text,target_role text,role text,created_at timestamptz) language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query select p.id,p.full_name,p.email,p.course,p.target_role,p.role,p.created_at from public.profiles p order by p.created_at desc limit 500;
end$$;
create or replace function public.admin_set_user_role(target_user uuid,new_role text) returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if new_role not in ('user','admin') then raise exception 'Role is invalid'; end if;
  if target_user=auth.uid() and new_role<>'admin' then raise exception 'You cannot remove your own administrator access'; end if;
  update public.profiles set role=new_role where id=target_user;
  return found;
end$$;
revoke all on function public.admin_dashboard_stats() from public;
revoke all on function public.admin_user_directory() from public;
revoke all on function public.admin_set_user_role(uuid,text) from public;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_user_directory() to authenticated;
grant execute on function public.admin_set_user_role(uuid,text) to authenticated;
