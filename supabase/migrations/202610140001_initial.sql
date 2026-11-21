create extension if not exists pgcrypto;

create table if not exists public.course_categories (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, sort_order int not null default 0, active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(), category_id uuid references public.course_categories(id) on delete set null, slug text not null unique, name text not null, level text, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.specializations (
  id uuid primary key default gen_random_uuid(), course_id uuid references public.courses(id) on delete cascade, name text not null, active boolean not null default true, created_at timestamptz not null default now(), unique(course_id,name)
);
create table if not exists public.careers (
  id uuid primary key default gen_random_uuid(), name text not null unique, description text not null default '', course_category_id uuid references public.course_categories(id) on delete set null, active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.job_roles (
  id uuid primary key default gen_random_uuid(), career_id uuid references public.careers(id) on delete set null, name text not null unique, category text not null default 'General', interview_types text[] not null default '{}', active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, category text not null default 'General', description text not null default '', active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.course_skills (
  course_id uuid not null references public.courses(id) on delete cascade, skill_id uuid not null references public.skills(id) on delete cascade, required_score int not null default 70 check (required_score between 0 and 100), primary key(course_id,skill_id)
);
create table if not exists public.role_skills (
  role_id uuid not null references public.job_roles(id) on delete cascade, skill_id uuid not null references public.skills(id) on delete cascade, required_score int not null default 75 check (required_score between 0 and 100), primary key(role_id,skill_id)
);
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, email text, full_name text not null default '', college text not null default '', degree text not null default '', course text not null default '', specialization text not null default '', department text not null default '', semester text not null default '', graduation_year int, target_career text not null default '', target_role text not null default '', experience_level text not null default 'Student', preferred_industry text not null default '', skills text[] not null default '{}', interview_preference text not null default 'Mixed', language text not null default 'English' check (language in ('English','Hindi','Hinglish')), role text not null default 'user' check(role in ('user','admin')), onboarding_complete boolean not null default false, voice_enabled boolean not null default true, feedback_detail text not null default 'Detailed', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, skill_id uuid references public.skills(id) on delete set null, skill_name text not null, current_score int not null default 0 check(current_score between 0 and 100), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,skill_name)
);
create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, course text not null, specialization text not null default '', target_career text not null default '', target_role text not null, experience_level text not null default '', skills text[] not null default '{}', interview_type text not null, difficulty text not null, language text not null default 'English', question_count int not null default 5, duration_minutes int not null default 20, status text not null default 'in_progress' check(status in ('in_progress','completed','abandoned')), overall_score int check(overall_score between 0 and 100), duration_seconds int, created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, session_id uuid not null references public.interview_sessions(id) on delete cascade, question_text text not null, topic text not null default '', difficulty text not null default 'Medium', rationale text not null default '', sort_order int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.interview_answers (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, session_id uuid not null references public.interview_sessions(id) on delete cascade, question_id uuid not null references public.interview_questions(id) on delete cascade, answer_text text not null, answer_mode text not null default 'text' check(answer_mode in ('text','voice')), created_at timestamptz not null default now(), unique(question_id)
);
create table if not exists public.answer_evaluations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, answer_id uuid not null unique references public.interview_answers(id) on delete cascade, overall_score int not null check(overall_score between 0 and 100), dimensions jsonb not null default '[]', strengths jsonb not null default '[]', weaknesses jsonb not null default '[]', missing_points jsonb not null default '[]', better_answer text not null default '', improvement_tip text not null default '', source text not null default 'ai', created_at timestamptz not null default now()
);
create table if not exists public.interview_reports (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, session_id uuid not null unique references public.interview_sessions(id) on delete cascade, analysis jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, file_name text not null, storage_path text, parsed_text text not null default '', course text not null default '', target_role text not null default '', is_primary boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.resume_analysis (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, resume_id uuid references public.resumes(id) on delete set null, result jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.job_descriptions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, title text not null, company text not null default '', content text not null, created_at timestamptz not null default now()
);
create table if not exists public.job_matches (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, resume_id uuid references public.resumes(id) on delete set null, job_description_id uuid references public.job_descriptions(id) on delete cascade, result jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.performance_metrics (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, session_id uuid references public.interview_sessions(id) on delete set null, metric_name text not null, metric_value numeric(5,2) not null check(metric_value between 0 and 100), category text not null default 'General', created_at timestamptz not null default now()
);
create table if not exists public.skill_gaps (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, skill_id uuid references public.skills(id) on delete set null, skill_name text not null, course text not null default '', target_role text not null default '', current_score int not null default 0 check(current_score between 0 and 100), required_score int not null default 75 check(required_score between 0 and 100), priority text not null default 'Medium' check(priority in ('High','Medium','Low')), updated_at timestamptz not null default now(), unique(owner_id,course,target_role,skill_name)
);
create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, title text not null, duration_days int not null check(duration_days in (7,14,30)), course text not null default '', target_role text not null default '', created_at timestamptz not null default now()
);
create table if not exists public.study_plan_items (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, plan_id uuid not null references public.study_plans(id) on delete cascade, day_number int not null, topic text not null, activity text not null default '', skill text not null default '', minutes int not null default 30, completed boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(), course_category text not null default 'General', course_names text[] not null default '{}', topic text not null, question_text text not null unique, role text not null default 'Any role', interview_type text not null default 'Technical', difficulty text not null default 'Medium' check(difficulty in ('Easy','Medium','Hard','Expert')), active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, target_type text not null check(target_type in ('question','report','study','resource')), target_id text not null, title text not null, detail text not null default '', created_at timestamptz not null default now(), unique(owner_id,target_type,target_id)
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, kind text not null, title text not null, body text not null default '', read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete set null, event_type text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.ml_predictions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, session_id uuid references public.interview_sessions(id) on delete cascade, readiness_score int not null check(readiness_score between 0 and 100), readiness_label text not null, features jsonb not null default '{}', model_type text not null default 'transparent-baseline', model_version text not null default 'baseline-v1', created_at timestamptz not null default now()
);
create table if not exists public.demo_students (
  id int primary key, display_name text not null, course text not null, target_role text not null, cohort text not null default 'Sample cohort', readiness int not null check(readiness between 0 and 100), demo_only boolean not null default true
);
create table if not exists public.demo_interviews (
  id int primary key, demo_student_id int not null references public.demo_students(id) on delete cascade, course text not null, target_role text not null, interview_type text not null, difficulty text not null, overall_score int not null check(overall_score between 0 and 100), date_offset_days int not null, duration_minutes int not null, demo_only boolean not null default true
);

create index if not exists profiles_course_idx on public.profiles(course);
create index if not exists interview_sessions_owner_created_idx on public.interview_sessions(owner_id,created_at desc);
create index if not exists interview_questions_session_idx on public.interview_questions(session_id,sort_order);
create index if not exists interview_answers_session_idx on public.interview_answers(owner_id,session_id);
create index if not exists performance_metrics_owner_created_idx on public.performance_metrics(owner_id,created_at desc);
create index if not exists notifications_owner_unread_idx on public.notifications(owner_id,read_at,created_at desc);
create index if not exists question_bank_filter_idx on public.question_bank(course_category,interview_type,difficulty);
create index if not exists study_plan_items_owner_plan_idx on public.study_plan_items(owner_id,plan_id,day_number);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now(); return new; end$$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at before update on public.courses for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict(id) do update set email=excluded.email;
  return new;
end$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.prevent_self_role_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.role is distinct from old.role and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then raise exception 'Only an administrator can change account role'; end if;
  return new;
end$$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update of role on public.profiles for each row execute function public.prevent_self_role_change();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using(id=auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check(id=auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists profiles_admin_delete on public.profiles;

-- Public catalog is readable; all writes require a database-backed admin role.
do $$ declare t text; begin
  foreach t in array array['course_categories','courses','specializations','careers','job_roles','skills','course_skills','role_skills','question_bank'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I',t||'_read',t);
    execute format('drop policy if exists %I on public.%I',t||'_admin_manage',t);
    execute format('create policy %I on public.%I for select to anon,authenticated using (true)',t||'_read',t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',t||'_admin_manage',t);
  end loop;
end $$;

-- Candidate-owned records: every query is additionally protected by owner_id = auth.uid().
do $$ declare t text; begin
  foreach t in array array['user_skills','interview_sessions','interview_questions','interview_answers','answer_evaluations','interview_reports','resumes','resume_analysis','job_descriptions','job_matches','performance_metrics','skill_gaps','study_plans','study_plan_items','bookmarks','notifications','activity_logs','ml_predictions'] loop
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
alter table public.demo_students enable row level security;
alter table public.demo_interviews enable row level security;
drop policy if exists demo_students_read on public.demo_students;
drop policy if exists demo_interviews_read on public.demo_interviews;
create policy demo_students_read on public.demo_students for select to anon,authenticated using(demo_only=true);
create policy demo_interviews_read on public.demo_interviews for select to anon,authenticated using(demo_only=true);

do $$ begin
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('resumes','resumes',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict(id) do nothing;
exception when undefined_table then null; end $$;
do $$ begin
  execute 'drop policy if exists resumes_select_own on storage.objects';
  execute 'drop policy if exists resumes_insert_own on storage.objects';
  execute 'drop policy if exists resumes_update_own on storage.objects';
  execute 'create policy resumes_select_own on storage.objects for select to authenticated using(bucket_id=''resumes'' and (storage.foldername(name))[1]=auth.uid()::text)';
  execute 'create policy resumes_insert_own on storage.objects for insert to authenticated with check(bucket_id=''resumes'' and (storage.foldername(name))[1]=auth.uid()::text)';
  execute 'create policy resumes_update_own on storage.objects for update to authenticated using(bucket_id=''resumes'' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id=''resumes'' and (storage.foldername(name))[1]=auth.uid()::text)';
exception when undefined_table then null; end $$;

insert into public.course_categories(slug,name,sort_order) values
('engineering','Engineering & Technology',1),('medical','Medical & Healthcare',2),('management','Management & Business',3),('commerce','Commerce',4),('science','Science',5),('arts','Arts & Humanities',6),('law','Law',7),('design','Design & Creative',8),('education','Education',9),('hospitality','Hospitality & Tourism',10),('agriculture','Agriculture',11),('vocational','Vocational & Diploma',12),('other','Other / Custom',13)
on conflict(slug) do nothing;
insert into public.courses(category_id,slug,name,level)
select c.id,v.slug,v.name,v.level from (values
('engineering','btech','B.Tech','Undergraduate'),('engineering','be','B.E.','Undergraduate'),('engineering','mtech','M.Tech','Postgraduate'),('engineering','me','M.E.','Postgraduate'),('engineering','bca','BCA','Undergraduate'),('engineering','mca','MCA','Postgraduate'),('engineering','bsc-cs','B.Sc Computer Science','Undergraduate'),('engineering','bsc-it','B.Sc IT','Undergraduate'),('engineering','diploma-engineering','Diploma Engineering','Diploma'),('medical','mbbs','MBBS','Undergraduate'),('medical','bds','BDS','Undergraduate'),('medical','bams','BAMS','Undergraduate'),('medical','bhms','BHMS','Undergraduate'),('medical','bpharm','B.Pharm','Undergraduate'),('medical','mpharm','M.Pharm','Postgraduate'),('medical','nursing','B.Sc Nursing','Undergraduate'),('medical','gnm','GNM','Diploma'),('medical','anm','ANM','Diploma'),('medical','bpt','BPT','Undergraduate'),('medical','bot','BOT','Undergraduate'),('medical','mlt','Medical Laboratory Technology','Diploma'),('medical','radiology','Radiology','Diploma'),('management','bba','BBA','Undergraduate'),('management','mba','MBA','Postgraduate'),('management','pgdm','PGDM','Postgraduate'),('commerce','bcom','B.Com','Undergraduate'),('commerce','mcom','M.Com','Postgraduate'),('science','bsc','B.Sc','Undergraduate'),('science','msc','M.Sc','Postgraduate'),('arts','ba','BA','Undergraduate'),('arts','ma','MA','Postgraduate'),('law','llb','LLB','Undergraduate'),('law','llm','LLM','Postgraduate'),('design','bdes','B.Des','Undergraduate'),('design','mdes','M.Des','Postgraduate'),('education','bed','B.Ed','Undergraduate'),('education','med','M.Ed','Postgraduate'),('hospitality','hotel-management','Hotel Management','Undergraduate'),('hospitality','travel-tourism','Travel & Tourism','Undergraduate'),('agriculture','bsc-agriculture','B.Sc Agriculture','Undergraduate'),('agriculture','msc-agriculture','M.Sc Agriculture','Postgraduate'),('vocational','iti','ITI','Vocational'),('vocational','diploma','Diploma courses','Diploma'),('vocational','certification','Professional certifications','Certification'),('other','custom','Other / Custom Course','Custom')
) as v(cat,slug,name,level) join public.course_categories c on c.slug=v.cat on conflict(slug) do nothing;
insert into public.specializations(course_id,name)
select c.id,v.name from (values
('btech','Computer Science'),('btech','Information Technology'),('btech','AI & ML'),('btech','Data Science'),('btech','Cybersecurity'),('btech','Electronics'),('btech','Electrical'),('btech','Mechanical'),('btech','Civil'),('btech','Chemical'),('btech','Automobile'),('btech','Aerospace'),('btech','Biomedical'),('btech','Robotics'),('btech','Mechatronics'),('bcom','Accounting & Finance'),('bba','Marketing'),('bba','Business Analytics'),('mba','Finance'),('mba','Human Resources'),('bsc','Physics'),('bsc','Chemistry'),('bsc','Mathematics'),('bsc','Biology'),('ba','English'),('ba','Psychology'),('llb','Corporate Law'),('bdes','UI/UX'),('bsc-agriculture','Horticulture')
) as v(course_slug,name) join public.courses c on c.slug=v.course_slug on conflict(course_id,name) do nothing;
insert into public.careers(name,description,course_category_id)
select v.name,v.description,c.id from (values
('Software Engineering','Build and maintain dependable software.','engineering'),('Mechanical Design Engineering','Design and validate mechanical products and systems.','engineering'),('Civil Engineering','Plan, deliver and inspect built-environment projects.','engineering'),('Data Analysis','Use data to answer operational and business questions.','engineering'),('Financial Analysis','Interpret financial statements, forecasts and performance.','commerce'),('Accounting','Record, reconcile and report financial transactions.','commerce'),('Marketing','Grow products with customer insight and measurable campaigns.','management'),('Pharmacovigilance','Support medication safety monitoring and reporting.','medical'),('Nursing','Deliver safe, empathetic and evidence-informed patient care.','medical'),('Legal Practice','Research law, analyze cases and support clients.','law'),('Content & Communications','Develop clear audience-aware written communications.','arts'),('Research Science','Design and communicate evidence-based investigations.','science'),('Teaching','Plan and deliver inclusive learning experiences.','education'),('Product Design','Research, prototype and evaluate user experiences.','design'),('Agriculture','Apply science and technology to sustainable production.','agriculture')
) v(name,description,cat) join public.course_categories c on c.slug=v.cat on conflict(name) do nothing;
insert into public.job_roles(name,category,interview_types)
values
('Software Engineer','engineering',array['Technical','Coding','Behavioral','HR']),('Frontend Developer','engineering',array['Technical','Coding','HR']),('Backend Developer','engineering',array['Technical','System Design','Coding']),('Full Stack Developer','engineering',array['Technical','Coding','HR']),('Data Analyst','engineering',array['Technical','Case Study']),('Data Scientist','engineering',array['Technical','Case Study']),('Mechanical Design Engineer','engineering',array['Domain','Technical','HR']),('Civil Engineer','engineering',array['Domain','Technical']),('Financial Analyst','commerce',array['Domain','Case Study','HR']),('Accountant','commerce',array['Domain','Technical','HR']),('Marketing Executive','management',array['Domain','Situational','HR']),('Business Analyst','management',array['Case Study','Situational','HR']),('Pharmacovigilance Associate','medical',array['Domain','Situational','HR']),('Staff Nurse','medical',array['Domain','Situational','HR']),('Legal Associate','law',array['Domain','Case Study','HR']),('Content Writer','arts',array['Communication','Behavioral']),('Research Assistant','science',array['Domain','Technical']),('Teacher','education',array['Situational','Communication','HR']),('Product Designer','design',array['Portfolio','Situational','HR']),('Agriculture Officer','agriculture',array['Domain','Situational','HR'])
on conflict(name) do nothing;
insert into public.skills(slug,name,category) values
('javascript','JavaScript','Technology'),('typescript','TypeScript','Technology'),('react','React','Technology'),('nodejs','Node.js','Technology'),('python','Python','Technology'),('java','Java','Technology'),('cpp','C++','Technology'),('sql','SQL','Technology'),('mongodb','MongoDB','Technology'),('aws','AWS','Cloud'),('docker','Docker','Cloud'),('machine-learning','Machine Learning','Technology'),('data-structures','Data Structures','Technology'),('algorithms','Algorithms','Technology'),('system-design','System Design','Technology'),('rest-apis','REST APIs','Technology'),('testing','Software Testing','Technology'),('security','Application Security','Technology'),('git','Version Control','Technology'),('communication','Communication','Professional'),('problem-solving','Problem Solving','Professional'),('leadership','Leadership','Professional'),('financial-statements','Financial Statements','Commerce'),('accounting','Accounting','Commerce'),('gst','GST & Taxation','Commerce'),('auditing','Auditing','Commerce'),('financial-modeling','Financial Modeling','Commerce'),('market-research','Market Research','Business'),('digital-marketing','Digital Marketing','Business'),('consumer-behavior','Consumer Behavior','Business'),('project-management','Project Management','Business'),('thermodynamics','Thermodynamics','Mechanical'),('cad','CAD','Mechanical'),('machine-design','Machine Design','Mechanical'),('manufacturing','Manufacturing','Mechanical'),('materials-science','Materials Science','Mechanical'),('fluid-mechanics','Fluid Mechanics','Engineering'),('structural-analysis','Structural Analysis','Civil'),('surveying','Surveying','Civil'),('clinical-communication','Clinical Communication','Healthcare'),('patient-safety','Patient Safety','Healthcare'),('pharmacology','Pharmacology','Healthcare'),('legal-research','Legal Research','Law'),('case-analysis','Case Analysis','Law'),('writing','Professional Writing','Arts'),('critical-thinking','Critical Thinking','Professional'),('statistics','Statistics','Science'),('experimental-design','Experimental Design','Science'),('curriculum-design','Curriculum Design','Education'),('lesson-planning','Lesson Planning','Education'),('ui-ux','UI/UX Design','Design'),('prototyping','Prototyping','Design'),('agronomy','Agronomy','Agriculture'),('sustainable-farming','Sustainable Agriculture','Agriculture'),('customer-service','Customer Service','Hospitality'),('food-safety','Food Safety','Hospitality')
on conflict(slug) do nothing;
insert into public.course_skills(course_id,skill_id,required_score)
select c.id,s.id,case when s.category in ('Professional') then 75 else 80 end from public.courses c join public.skills s on
(c.slug in ('btech','bca','mca','bsc-cs','bsc-it') and s.category in ('Technology','Professional')) or
(c.slug in ('bcom','mcom') and s.category in ('Commerce','Professional')) or
(c.slug in ('bba','mba','pgdm') and s.category in ('Business','Professional')) or
(c.slug in ('bsc','msc') and s.category in ('Science','Professional')) or
(c.slug in ('mbbs','bds','bams','bhms','bpharm','mpharm','nursing','gnm','anm','bpt','bot','mlt') and s.category in ('Healthcare','Professional')) or
(c.slug in ('llb','llm') and s.category in ('Law','Professional')) or
(c.slug in ('bdes','mdes') and s.category in ('Design','Professional')) or
(c.slug in ('bed','med') and s.category in ('Education','Professional')) or
(c.slug in ('bsc-agriculture','msc-agriculture') and s.category in ('Agriculture','Professional'))
on conflict do nothing;

insert into public.question_bank(course_category,course_names,topic,question_text,role,interview_type,difficulty) values
('engineering',array['B.Tech','B.E.','BCA','MCA','Computer Science'],'Data Structures','When would you choose a hash map over a balanced tree, and what trade-offs matter?','Software Engineer','Technical','Medium'),
('engineering',array['B.Tech','B.E.','Computer Science'],'Algorithms','How would you find the first repeated value in a stream if memory is limited?','Software Engineer','Coding','Hard'),
('engineering',array['B.Tech','B.E.','Computer Science'],'Databases','Explain how a composite index changes query planning and when it can hurt writes.','Backend Developer','Technical','Hard'),
('engineering',array['B.Tech','B.E.','Computer Science'],'Operating Systems','What happens during a context switch, and which costs can dominate?','Software Engineer','Technical','Medium'),
('engineering',array['B.Tech','B.E.','Computer Science'],'Networks','Walk through a browser request from DNS lookup to an HTTPS response.','Full Stack Developer','Technical','Medium'),
('engineering',array['B.Tech','B.E.','Computer Science'],'Web Development','How would you diagnose and improve a slow React page with a large list?','Frontend Developer','Technical','Medium'),
('engineering',array['B.Tech','B.E.','Computer Science'],'Security','How would you design session authentication for a React and Node.js application?','Full Stack Developer','System Design','Hard'),
('engineering',array['B.Tech','B.E.','Computer Science'],'System Design','Design a notification service that handles retries without delivering duplicates.','Backend Developer','System Design','Expert'),
('engineering',array['B.Tech','B.E.','Mechanical Engineering'],'Thermodynamics','State the assumptions behind an ideal Rankine cycle and explain how superheating changes efficiency.','Mechanical Design Engineer','Domain','Medium'),
('engineering',array['B.Tech','B.E.','Mechanical Engineering'],'Machine Design','How would you choose a shaft diameter under combined bending and torsional loads?','Mechanical Design Engineer','Domain','Hard'),
('engineering',array['B.Tech','B.E.','Mechanical Engineering'],'CAD','What checks do you perform before releasing a parametric CAD assembly for manufacture?','Mechanical Design Engineer','Domain','Medium'),
('engineering',array['B.Tech','B.E.','Mechanical Engineering'],'Manufacturing','A machined feature is out of tolerance on multiple parts; how would you isolate the cause?','Mechanical Design Engineer','Situational','Medium'),
('engineering',array['B.Tech','B.E.','Mechanical Engineering'],'Materials','How would fatigue life, corrosion and manufacturability influence material selection?','Mechanical Design Engineer','Domain','Hard'),
('engineering',array['B.Tech','B.E.','Mechanical Engineering'],'Fluid Mechanics','When is a Bernoulli-based estimate insufficient for a real pipe network?','Mechanical Design Engineer','Domain','Medium'),
('engineering',array['B.Tech','B.E.','Mechanical Engineering'],'GD&T','How would you choose a datum reference frame for a locating feature?','Mechanical Design Engineer','Domain','Hard'),
('engineering',array['B.Tech','B.E.','Civil Engineering'],'Structural Analysis','How do boundary conditions influence the results of a frame analysis?','Civil Engineer','Domain','Medium'),
('engineering',array['B.Tech','B.E.','Civil Engineering'],'Concrete','Which factors would you check when concrete test results vary between batches?','Civil Engineer','Situational','Medium'),
('engineering',array['B.Tech','B.E.','Civil Engineering'],'Geotechnical','How would groundwater conditions change your foundation investigation plan?','Civil Engineer','Domain','Hard'),
('engineering',array['B.Tech','B.E.','Civil Engineering'],'Surveying','How do you detect and reduce accumulated measurement error across a traverse?','Civil Engineer','Domain','Medium'),
('engineering',array['B.Tech','B.E.','Electrical Engineering'],'Power Systems','What operational constraints matter when integrating variable renewable generation?','Electrical Engineer','Domain','Hard'),
('engineering',array['B.Tech','B.E.','Electronics'],'Embedded Systems','How would you debug an intermittent timing fault in a microcontroller system?','Electronics Engineer','Situational','Hard'),
('engineering',array['B.Tech','B.E.','Chemical Engineering'],'Process Engineering','How would you investigate a sustained drop in reactor conversion while feed composition is stable?','Process Engineer','Domain','Hard'),
('engineering',array['B.Tech','B.E.','Robotics'],'Control Systems','How would you tune a controller when overshoot and settling time both matter?','Robotics Engineer','Domain','Hard'),
('commerce',array['B.Com','M.Com','Accounting'],'Accounting','Walk me through how the income statement, balance sheet and cash-flow statement connect.','Accountant','Domain','Medium'),
('commerce',array['B.Com','M.Com','Accounting'],'Reconciliation','How would you investigate an unexplained difference in a bank reconciliation?','Accountant','Situational','Medium'),
('commerce',array['B.Com','Accounting & Finance'],'GST','Explain input and output GST and the checks you would perform before filing a return.','Tax Associate','Domain','Medium'),
('commerce',array['B.Com','M.Com','Auditing'],'Audit','What evidence would you gather to test whether revenue is recorded in the correct period?','Audit Associate','Domain','Hard'),
('commerce',array['B.Com','Financial Analyst'],'Financial Analysis','How would you assess whether a company''s earnings growth is supported by cash generation?','Financial Analyst','Domain','Hard'),
('commerce',array['B.Com','Accounting'],'Internal Controls','What controls reduce the risk of duplicate vendor payments without delaying operations?','Accountant','Situational','Medium'),
('commerce',array['B.Com','Finance'],'Budgeting','How would you explain a material unfavorable variance between budget and actual results?','Financial Analyst','Behavioral','Medium'),
('commerce',array['B.Com','Taxation'],'Taxation','What documents would you verify before preparing an individual tax filing?','Tax Associate','Domain','Medium'),
('commerce',array['B.Com','Banking'],'Banking','How would you explain the relationship between liquidity risk and interest-rate risk?','Banking Associate','Domain','Hard'),
('commerce',array['B.Com','Financial Analyst'],'Valuation','Which assumptions have the greatest effect on a discounted cash-flow valuation?','Financial Analyst','Case Study','Expert'),
('management',array['BBA','MBA','Marketing'],'Market Research','How would you segment a market when historical purchase data is incomplete?','Marketing Executive','Case Study','Medium'),
('management',array['BBA','MBA','Marketing'],'Consumer Behavior','A product has high awareness but weak conversion; how would you diagnose the gap?','Marketing Executive','Case Study','Hard'),
('management',array['BBA','MBA','Marketing'],'Branding','How would you position a new product in a crowded category without competing only on price?','Marketing Executive','Case Study','Hard'),
('management',array['BBA','MBA','Marketing'],'Digital Marketing','Which measures would you use to compare two acquisition channels with different attribution windows?','Marketing Executive','Domain','Medium'),
('management',array['BBA','MBA','Marketing'],'Sales','How would you test whether a discount creates incremental sales or simply shifts timing?','Marketing Executive','Case Study','Hard'),
('management',array['BBA','MBA','Business Analytics'],'Business Analysis','How would you prioritize requirements when two departments disagree about the problem?','Business Analyst','Situational','Medium'),
('management',array['BBA','MBA','Finance'],'Operations','A process misses its service target every month; what data would you examine first?','Operations Analyst','Case Study','Medium'),
('management',array['MBA','HR'],'Human Resources','How would you structure a fair, consistent interview rubric for a new role?','HR Associate','Situational','Medium'),
('management',array['MBA','Business Analytics'],'Case Analysis','Estimate the likely effect of a 10% price change when elasticity is uncertain.','Business Analyst','Case Study','Expert'),
('management',array['BBA','MBA'],'Leadership','Tell me about a time you changed a plan after hearing evidence from your team.','Management Trainee','Behavioral','Medium'),
('medical',array['MBBS','BDS','B.Pharm','Healthcare'],'Patient Safety','What verification steps help prevent a patient-identification error during handover?','Healthcare Associate','Situational','Medium'),
('medical',array['B.Pharm','M.Pharm','Pharmacy'],'Pharmacology','How would you explain the difference between an adverse event report and a confirmed causal relationship?','Pharmacovigilance Associate','Domain','Hard'),
('medical',array['B.Pharm','M.Pharm'],'Pharmacovigilance','What information makes a safety case sufficiently complete for initial triage?','Pharmacovigilance Associate','Domain','Medium'),
('medical',array['B.Sc Nursing','GNM','ANM','Nursing'],'Nursing Handover','How would you organize a concise handover when several observations need follow-up?','Staff Nurse','Situational','Medium'),
('medical',array['B.Sc Nursing','GNM','ANM'],'Clinical Communication','How do you explain a care process in plain language while checking understanding?','Staff Nurse','Communication','Medium'),
('medical',array['MBBS','BDS','B.Sc Nursing'],'Documentation','What practices help keep clinical documentation accurate when the unit is busy?','Healthcare Associate','Situational','Medium'),
('medical',array['B.Pharm','Pharmacy'],'Quality Systems','How would you handle a potential product-quality complaint while preserving traceability?','Pharmacovigilance Associate','Situational','Hard'),
('medical',array['BPT','BOT','Physiotherapy'],'Rehabilitation','How would you adapt an exercise plan if a patient''s functional goals and tolerance differ?','Physiotherapy Associate','Situational','Medium'),
('medical',array['Medical Laboratory Technology','Radiology'],'Laboratory Quality','Which checks would you perform when a control sample falls outside its accepted range?','Lab Technician','Domain','Hard'),
('medical',array['MBBS','BDS'],'Professionalism','How would you respond if you noticed a documentation gap during a routine handover?','Healthcare Associate','Situational','Medium'),
('science',array['B.Sc','M.Sc','Biology','Biotechnology'],'Experimental Design','How would you design a control group for an experiment with a likely confounding variable?','Research Assistant','Domain','Hard'),
('science',array['B.Sc','M.Sc','Statistics'],'Statistics','How would you decide whether a paired or independent-samples test fits a study?','Research Analyst','Domain','Hard'),
('science',array['B.Sc','M.Sc','Chemistry'],'Laboratory Practice','What steps help distinguish instrument drift from a real change in sample composition?','Lab Technician','Situational','Medium'),
('science',array['B.Sc','M.Sc','Physics'],'Measurement','How do you propagate measurement uncertainty through a derived quantity?','Research Assistant','Domain','Hard'),
('science',array['B.Sc','M.Sc','Environmental Science'],'Environmental Science','How would you separate seasonal change from a long-term trend in field observations?','Research Assistant','Domain','Hard'),
('science',array['B.Sc','M.Sc','Mathematics'],'Mathematics','How would you communicate the assumptions and limits of a statistical model to a project team?','Data Analyst','Communication','Medium'),
('science',array['B.Sc Biology','Zoology','Botany'],'Biology','How would you assess whether an observed ecological difference is biologically meaningful?','Research Assistant','Domain','Medium'),
('science',array['B.Sc','Microbiology'],'Microbiology','What controls would you use to detect contamination in a culture workflow?','Lab Technician','Situational','Medium'),
('science',array['B.Sc','Biotechnology'],'Research Communication','How would you present a null result without overstating the study''s conclusion?','Research Assistant','Communication','Medium'),
('science',array['B.Sc','M.Sc'],'Research Ethics','What would you do if a result could not be reproduced using the recorded method?','Research Assistant','Situational','Hard'),
('law',array['LLB','LLM','Corporate Law'],'Contract Law','How would you identify material facts and legal issues in an unfamiliar contract dispute?','Legal Associate','Case Study','Hard'),
('law',array['LLB','LLM','Constitutional Law'],'Constitutional Law','How would you distinguish binding precedent from persuasive authority in a case note?','Legal Associate','Domain','Hard'),
('law',array['LLB','Criminal Law'],'Criminal Law','How would you organize evidence and competing inferences before drafting a case summary?','Legal Associate','Case Study','Hard'),
('law',array['LLB','Corporate Law'],'Legal Research','What steps would you take to confirm that a source remains good law in the relevant jurisdiction?','Legal Associate','Domain','Medium'),
('law',array['LLB','IPR'],'Intellectual Property','Which facts would you clarify before assessing ownership of work created by a contractor?','Legal Associate','Situational','Medium'),
('law',array['LLB','Cyber Law'],'Cyber Law','How would you preserve a clear chain of custody for digital evidence?','Legal Associate','Domain','Hard'),
('law',array['LLB','Civil Law'],'Civil Procedure','How would you explain the purpose of interim relief to a client without overstating the outcome?','Legal Associate','Communication','Medium'),
('law',array['LLB','LLM'],'Professional Ethics','What would you do if a client request appears inconsistent with your professional duties?','Legal Associate','Situational','Hard'),
('law',array['LLB','LLM'],'Case Analysis','How do you build a concise argument that addresses the strongest counterargument?','Legal Associate','Case Study','Medium'),
('arts',array['BA English','BA','MA English'],'Writing','How would you adapt a technical explanation for a general audience without losing accuracy?','Content Writer','Communication','Medium'),
('arts',array['BA English','Journalism','Mass Communication'],'Editing','How do you verify a factual claim before it appears in a published article?','Communication Executive','Situational','Medium'),
('arts',array['BA History','History'],'Historical Analysis','How would you compare two primary sources that interpret the same event differently?','Research Assistant','Domain','Hard'),
('arts',array['BA Psychology','Psychology'],'Psychology','How would you distinguish a correlation in survey data from a causal explanation?','Research Assistant','Domain','Hard'),
('arts',array['BA Sociology','Sociology'],'Sociology','Which sampling limitations would you explain before generalizing a qualitative finding?','Research Assistant','Domain','Medium'),
('arts',array['BA Economics','Economics'],'Economics','How would you explain the assumptions behind a policy recommendation to a non-specialist?','Analyst','Communication','Medium'),
('arts',array['BA Political Science','Political Science'],'Political Science','How do you assess the reliability and perspective of a political source?','Research Assistant','Domain','Medium'),
('arts',array['BA English','BA'],'Critical Thinking','What evidence would make you revise an interpretation of a text or cultural artifact?','Content Writer','Behavioral','Medium'),
('arts',array['BA English','Languages'],'Communication','Describe your editing process when accuracy and a strict word limit both matter.','Content Writer','Communication','Medium'),
('design',array['B.Des','M.Des','UI/UX'],'User Research','How would you recruit participants for a usability study while reducing selection bias?','Product Designer','Domain','Hard'),
('design',array['B.Des','M.Des','Graphic Design'],'Visual Design','How do you decide whether a visual hierarchy is working for a first-time user?','Product Designer','Portfolio','Medium'),
('design',array['B.Des','UI/UX'],'Prototyping','What would you prototype first when a team is uncertain about a key interaction?','Product Designer','Situational','Medium'),
('design',array['B.Des','Fashion Design'],'Design Process','How do material constraints and user needs shape an early design concept?','Designer','Portfolio','Medium'),
('design',array['B.Des','Animation'],'Iteration','Tell me about a design iteration that changed after user feedback.','Product Designer','Behavioral','Medium'),
('education',array['B.Ed','M.Ed','Teaching'],'Lesson Planning','How would you adapt a lesson when learners have different starting levels?','Teacher','Situational','Medium'),
('education',array['B.Ed','Teaching'],'Assessment','How would you check whether a formative assessment measures the stated learning objective?','Teacher','Domain','Medium'),
('education',array['B.Ed','Special Education'],'Inclusive Learning','What changes can make classroom instructions more accessible without singling out a learner?','Teacher','Situational','Hard'),
('education',array['B.Ed','M.Ed'],'Classroom Management','How would you respond when a class activity is not producing the intended engagement?','Teacher','Situational','Medium'),
('hospitality',array['Hotel Management','Hospitality Management'],'Guest Experience','How would you resolve a service complaint while keeping the guest and team informed?','Hospitality Associate','Situational','Medium'),
('hospitality',array['Culinary Arts','Hotel Management'],'Food Safety','What checks would you perform when a temperature log has a missing reading?','Hospitality Associate','Domain','Medium'),
('hospitality',array['Travel & Tourism','Hospitality Management'],'Travel Operations','How would you communicate a contingency plan after a transport disruption?','Travel Coordinator','Situational','Medium'),
('agriculture',array['B.Sc Agriculture','M.Sc Agriculture'],'Agronomy','How would you compare two planting approaches when weather and soil conditions vary?','Agriculture Officer','Domain','Hard'),
('agriculture',array['B.Sc Agriculture','Horticulture'],'Horticulture','What observations would help distinguish nutrient deficiency from water stress?','Agriculture Officer','Domain','Medium'),
('agriculture',array['Agricultural Engineering','Food Technology'],'Food Technology','How would you investigate a change in yield while holding the input specification constant?','Food Technologist','Situational','Hard'),
('agriculture',array['B.Sc Agriculture','Sustainable Farming'],'Sustainable Farming','How would you assess the trade-offs of introducing a new pest-management practice?','Agriculture Officer','Case Study','Hard'),
('general',array['All courses'],'HR','Tell me about a time you received feedback that changed how you approached your work.','Any role','Behavioral','Medium'),
('general',array['All courses'],'HR','Why does this role fit the course and experience you have built so far?','Any role','HR','Easy'),
('general',array['All courses'],'HR','Describe a difficult problem you solved and how you knew your approach worked.','Any role','Behavioral','Medium'),
('general',array['All courses'],'Situational','Two important deadlines conflict; how would you prioritize and communicate your plan?','Any role','Situational','Medium'),
('general',array['All courses'],'Communication','Explain one concept from your field to a person with no background in it.','Any role','Communication','Easy'),
('general',array['All courses'],'Teamwork','Tell me about a time you disagreed with a teammate and how you reached a decision.','Any role','Behavioral','Medium'),
('general',array['All courses'],'Motivation','What skill are you deliberately improving, and what evidence shows progress?','Any role','HR','Easy'),
('general',array['All courses'],'Problem Solving','A plan is not working as expected; what would you check before changing direction?','Any role','Situational','Medium')
on conflict(question_text) do nothing;

insert into public.demo_students(id,display_name,course,target_role,cohort,readiness)
select n, 'Sample Learner '||lpad(n::text,2,'0'), (array['B.Tech Computer Science','B.Tech Mechanical','B.Com Accounting & Finance','BBA Marketing','B.Sc Nursing','LLB','BA English','B.Sc Biology','B.Ed','B.Des UI/UX','B.Sc Agriculture','Diploma Engineering','MBA Finance','M.Pharm'])[1+((n-1)%14)], (array['Full Stack Developer','Mechanical Design Engineer','Financial Analyst','Marketing Executive','Staff Nurse','Legal Associate','Content Writer','Research Assistant','Teacher','Product Designer','Agriculture Officer','Engineering Technician','Business Analyst','Pharmacovigilance Associate'])[1+((n-1)%14)], 'Illustrative demo cohort', 58+((n*13)%38) from generate_series(1,20) n on conflict(id) do nothing;
insert into public.demo_interviews(id,demo_student_id,course,target_role,interview_type,difficulty,overall_score,date_offset_days,duration_minutes)
select n,1+((n-1)%20),(array['B.Tech Computer Science','B.Tech Mechanical','B.Com Accounting & Finance','BBA Marketing','B.Sc Nursing','LLB','BA English','B.Sc Biology','B.Ed','B.Des UI/UX','B.Sc Agriculture','Diploma Engineering','MBA Finance','M.Pharm'])[1+((n-1)%14)],(array['Full Stack Developer','Mechanical Design Engineer','Financial Analyst','Marketing Executive','Staff Nurse','Legal Associate','Content Writer','Research Assistant','Teacher','Product Designer','Agriculture Officer','Engineering Technician','Business Analyst','Pharmacovigilance Associate'])[1+((n-1)%14)],(array['Technical','Domain','Behavioral','Mixed'])[1+((n-1)%4)],(array['Easy','Medium','Hard'])[1+((n-1)%3)],54+((n*17)%43),n*2,18+((n*7)%18) from generate_series(1,30) n on conflict(id) do nothing;

-- Synthetic records are segregated from authenticated learner history and are always labeled demo-only.


-- PostgREST requires SQL grants in addition to RLS policies.
grant usage on schema public to anon, authenticated;
grant select on table public.course_categories, public.courses, public.specializations, public.careers, public.job_roles, public.skills, public.course_skills, public.role_skills, public.question_bank, public.demo_students, public.demo_interviews to anon, authenticated;
grant insert, update, delete on table public.course_categories, public.courses, public.specializations, public.careers, public.job_roles, public.skills, public.course_skills, public.role_skills, public.question_bank to authenticated;
grant select, insert, update, delete on table public.profiles, public.user_skills, public.interview_sessions, public.interview_questions, public.interview_answers, public.answer_evaluations, public.interview_reports, public.resumes, public.resume_analysis, public.job_descriptions, public.job_matches, public.performance_metrics, public.skill_gaps, public.study_plans, public.study_plan_items, public.bookmarks, public.notifications, public.activity_logs, public.ml_predictions to authenticated;
