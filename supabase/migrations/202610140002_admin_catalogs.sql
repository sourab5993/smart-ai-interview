create table if not exists public.interview_types (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, description text not null default '', active boolean not null default true, sort_order int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.question_categories (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, description text not null default '', active boolean not null default true, sort_order int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(), scope_type text not null default 'global' check(scope_type in ('global','course','role','interview_type')), scope_name text not null default 'General', interview_type text not null default '', name text not null, description text not null default '', weight numeric(5,2) not null default 1 check(weight>=0 and weight<=100), active boolean not null default true, sort_order int not null default 0, created_at timestamptz not null default now(), unique(scope_type,scope_name,interview_type,name)
);
create table if not exists public.difficulty_levels (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, description text not null default '', active boolean not null default true, sort_order int not null default 0, created_at timestamptz not null default now()
);
alter table public.question_bank add column if not exists question_category text not null default 'Conceptual';
alter table public.course_skills add column if not exists id uuid not null default gen_random_uuid();
alter table public.course_skills add column if not exists active boolean not null default true;
alter table public.course_skills add column if not exists updated_at timestamptz not null default now();
alter table public.role_skills add column if not exists id uuid not null default gen_random_uuid();
alter table public.role_skills add column if not exists active boolean not null default true;
alter table public.role_skills add column if not exists updated_at timestamptz not null default now();
create unique index if not exists course_skills_admin_id_idx on public.course_skills(id);
create unique index if not exists role_skills_admin_id_idx on public.role_skills(id);

insert into public.role_skills(role_id,skill_id,required_score)
select r.id,s.id,v.required_score from (values
 ('Software Engineer','JavaScript',78),('Software Engineer','Data Structures',82),('Software Engineer','Algorithms',80),('Software Engineer','SQL',70),
 ('Frontend Developer','React',82),('Frontend Developer','TypeScript',76),('Frontend Developer','Communication',68),
 ('Backend Developer','Node.js',78),('Backend Developer','SQL',82),('Backend Developer','REST APIs',80),('Backend Developer','Application Security',72),
 ('Full Stack Developer','React',76),('Full Stack Developer','Node.js',76),('Full Stack Developer','SQL',76),('Full Stack Developer','Problem Solving',80),
 ('Data Analyst','SQL',84),('Data Analyst','Statistics',80),('Data Analyst','Financial Statements',68),
 ('Data Scientist','Python',82),('Data Scientist','Machine Learning',84),('Data Scientist','Statistics',82),
 ('Mechanical Design Engineer','Thermodynamics',80),('Mechanical Design Engineer','CAD',88),('Mechanical Design Engineer','Machine Design',86),('Mechanical Design Engineer','Manufacturing',78),('Mechanical Design Engineer','Materials Science',76),
 ('Civil Engineer','Structural Analysis',84),('Civil Engineer','Surveying',78),('Civil Engineer','Problem Solving',78),
 ('Financial Analyst','Financial Statements',88),('Financial Analyst','Financial Modeling',84),('Financial Analyst','Accounting',80),('Financial Analyst','Communication',70),
 ('Accountant','Accounting',88),('Accountant','GST & Taxation',82),('Accountant','Auditing',78),('Accountant','Financial Statements',85),
 ('Marketing Executive','Market Research',82),('Marketing Executive','Digital Marketing',84),('Marketing Executive','Consumer Behavior',80),
 ('Pharmacovigilance Associate','Pharmacology',86),('Pharmacovigilance Associate','Clinical Communication',80),
 ('Staff Nurse','Patient Safety',90),('Staff Nurse','Clinical Communication',88),
 ('Legal Associate','Legal Research',88),('Legal Associate','Case Analysis',86),('Legal Associate','Professional Writing',78),
 ('Content Writer','Professional Writing',88),('Content Writer','Critical Thinking',78),('Content Writer','Communication',84),
 ('Research Assistant','Statistics',78),('Research Assistant','Critical Thinking',82),('Teacher','Lesson Planning',86),('Teacher','Curriculum Design',82),
 ('Product Designer','UI/UX Design',88),('Product Designer','Prototyping',82),('Agriculture Officer','Agronomy',88),('Agriculture Officer','Sustainable Agriculture',82)
) as v(role_name,skill_name,required_score)
join public.job_roles r on r.name=v.role_name
join public.skills s on s.name=v.skill_name
on conflict(role_id,skill_id) do nothing;

create index if not exists evaluation_criteria_scope_idx on public.evaluation_criteria(scope_type,scope_name,interview_type,active);
do $$ declare t text; begin
  foreach t in array array['interview_types','question_categories','evaluation_criteria','difficulty_levels'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I',t||'_read',t);
    execute format('drop policy if exists %I on public.%I',t||'_admin_manage',t);
    execute format('create policy %I on public.%I for select to anon,authenticated using(active=true)',t||'_read',t);
    execute format('create policy %I on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t||'_admin_manage',t);
  end loop;
end $$;

insert into public.interview_types(slug,name,description,sort_order) values
('hr','HR','Motivation, professionalism and communication.',1),('technical','Technical','Role-specific technical knowledge and application.',2),('domain','Domain','Course and industry domain knowledge.',3),('behavioral','Behavioral','Past examples, reflection and work style.',4),('situational','Situational','Judgment in a realistic scenario.',5),('case-study','Case Study','Structured analysis of a business or field problem.',6),('coding','Coding','Problem solving, logic and code quality.',7),('viva','Viva','Oral examination of academic concepts.',8),('communication','Communication','Clarity, fluency, listening and explanation.',9),('aptitude','Aptitude','Reasoning and quantitative fundamentals.',10),('mixed','Mixed','A balanced selection of relevant question types.',11)
on conflict(slug) do nothing;
insert into public.question_categories(slug,name,description,sort_order) values
('basic','Basic','Foundational knowledge and definitions.',1),('intermediate','Intermediate','Applied concepts and explanation.',2),('advanced','Advanced','Trade-offs and in-depth application.',3),('scenario-based','Scenario-based','Practical context and decisions.',4),('problem-solving','Problem-solving','Structured analysis and reasoning.',5),('case-based','Case-based','Multi-step case response.',6),('application-based','Application-based','Apply course learning to real work.',7),('conceptual','Conceptual','Principles and conceptual understanding.',8)
on conflict(slug) do nothing;
insert into public.difficulty_levels(slug,name,description,sort_order) values
('easy','Easy','Introductory and confidence-building.',1),('medium','Medium','Core applied understanding.',2),('hard','Hard','Multi-step reasoning and trade-offs.',3),('expert','Expert','Complex scenarios for advanced practice.',4)
on conflict(slug) do nothing;
insert into public.evaluation_criteria(scope_type,scope_name,interview_type,name,description,weight,sort_order) values
('global','General','General','Relevance','How directly the response addresses the prompt.',1,1),
('global','General','General','Completeness','Coverage of key reasoning, evidence and outcome.',1,2),
('global','General','General','Communication','Clear and professional expression.',1,3),
('global','General','General','Structure','Logical organization and progression.',1,4),
('interview_type','HR','HR','Professionalism','Respectful, role-appropriate professional conduct.',1,5),
('interview_type','Technical','Technical','Technical Accuracy','Correctness of relevant technical concepts.',1,6),
('interview_type','Coding','Coding','Problem Solving','Reasoning, correctness and complexity awareness.',1,7),
('interview_type','Case Study','Case Study','Decision Making','Reasoned recommendation and trade-offs.',1,8),
('course','Mechanical','Domain','Engineering Application','Application to design, manufacturing and engineering constraints.',1,9),
('course','Medical & Healthcare','Domain','Clinical Reasoning','Educational discussion of safe process and professional reasoning.',1,10),
('course','Commerce','Domain','Financial Reasoning','Accounting, numerical and business understanding.',1,11),
('course','Law','Domain','Case Analysis','Issue spotting, authority and argument structure.',1,12),
('course','Arts & Humanities','Domain','Critical Thinking','Source analysis and evidence-based interpretation.',1,13),
('course','Management & Business','Domain','Business Judgment','Customer, commercial, leadership and decision reasoning.',1,14)
on conflict(scope_type,scope_name,interview_type,name) do nothing;

create or replace function public.admin_dashboard_stats() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'total_users',(select count(*) from public.profiles),
    'active_users_30d',(select count(distinct owner_id) from public.activity_logs where owner_id is not null and created_at>=now()-interval '30 days'),
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
revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.admin_dashboard_stats() to authenticated;


-- Table privileges complement (and never replace) the administrator-only RLS policies above.
grant select on table public.interview_types, public.question_categories, public.evaluation_criteria, public.difficulty_levels to anon, authenticated;
grant insert, update, delete on table public.interview_types, public.question_categories, public.evaluation_criteria, public.difficulty_levels to authenticated;


-- Expanded course-specific and interview-type rubric seeds; administrators can edit these values later.
insert into public.evaluation_criteria(scope_type,scope_name,interview_type,name,description,weight,sort_order) values
('global','General','General','Accuracy','Evidence-based correctness of the relevant concept or claim.',1,20),
('global','General','General','Clarity','How clearly and directly the response is explained.',1,21),
('global','General','General','Confidence','Composed, appropriately assured delivery without overstating evidence.',1,22),
('global','General','General','Problem Solving','Structured reasoning and a usable approach to the prompt.',1,23),
('course','Engineering & Technology','Domain','Technical Knowledge','Discipline-specific technical concepts and terminology.',1,30),
('course','Engineering & Technology','Domain','Engineering Application','Application of relevant engineering concepts to practical constraints.',1,31),
('course','Engineering & Technology','Domain','Problem Solving','Structured engineering diagnosis and trade-off reasoning.',1,32),
('course','Engineering & Technology','Domain','Design Understanding','Design constraints, testing and maintainability appropriate to the branch.',1,33),
('course','Science','Domain','Subject Knowledge','Accuracy and depth of the relevant scientific concepts.',1,34),
('course','Science','Domain','Experimental Reasoning','Appropriate controls, methods and limits of inference.',1,35),
('course','Science','Domain','Evidence Analysis','Use of data, uncertainty and appropriate interpretation.',1,36),
('course','Arts & Humanities','Domain','Subject Knowledge','Course-relevant historical, cultural or theoretical understanding.',1,37),
('course','Arts & Humanities','Domain','Critical Thinking','Compare interpretations and support claims with evidence.',1,38),
('course','Arts & Humanities','Domain','Communication','Organize a clear explanation for the audience and context.',1,39),
('course','Design & Creative','Domain','Design Knowledge','Relevant design principles, tools and constraints.',1,40),
('course','Design & Creative','Domain','User-centred Reasoning','Use research and user evidence to frame decisions.',1,41),
('course','Education','Domain','Instructional Design','Align teaching activities and assessment with learning outcomes.',1,42),
('course','Education','Domain','Learner Support','Use inclusive, constructive and level-appropriate learner support.',1,43),
('course','Agriculture','Domain','Applied Agriculture','Apply agronomy, soil, water and production evidence to field decisions.',1,44),
('course','Agriculture','Domain','Sustainability','Consider resource stewardship, safety and sustainable outcomes.',1,45),
('course','Hospitality & Tourism','Domain','Service Knowledge','Apply relevant service, operations and guest-experience knowledge.',1,46),
('course','Hospitality & Tourism','Domain','Safety and Professionalism','Communicate safe, respectful and professional procedures.',1,47),
('course','Management & Business','Domain','Business Knowledge','Apply appropriate customer, commercial and operational context.',1,48),
('course','Management & Business','Domain','Decision Making','Use evidence, trade-offs and accountable decisions.',1,49),
('interview_type','Behavioral','Behavioral','Evidence and Reflection','Specific examples, individual contribution and learning.',1,50),
('interview_type','Situational','Situational','Judgment and Prioritization','Safe, proportionate and reasoned decisions in a scenario.',1,51),
('interview_type','Communication','Communication','Fluency and Vocabulary','Clear, audience-appropriate and coherent spoken or written expression.',1,52),
('interview_type','Viva','Viva','Concept Explanation','Accurate explanation of the underlying course concept.',1,53),
('interview_type','Aptitude','Aptitude','Reasoning and Accuracy','Clear reasoning steps and accurate use of evidence or calculations.',1,54),
('interview_type','Technical','Technical','Problem Solving','Practical analysis, validation and trade-off awareness.',1,55),
('role','Mechanical Design Engineer','Domain','Thermodynamics','Apply thermodynamic fundamentals to an engineering design problem.',1,60),
('role','Mechanical Design Engineer','Domain','CAD','Interpret design intent, constraints and appropriate CAD practice.',1,61),
('role','Mechanical Design Engineer','Domain','Machine Design','Reason about load, failure modes, fit and maintainability.',1,62),
('role','Mechanical Design Engineer','Domain','Manufacturing','Consider manufacturability, process choice and quality control.',1,63),
('role','Financial Analyst','Domain','Financial Statements','Interpret linked financial statements and evidence.',1,64),
('role','Financial Analyst','Domain','Financial Modeling','Explain assumptions, sensitivities and transparent calculations.',1,65),
('role','Financial Analyst','Domain','Accounting','Use appropriate accounting concepts and reconciliations.',1,66),
('role','Accountant','Domain','Accounting','Apply accurate accounting and reconciliation practice.',1,67),
('role','Accountant','Domain','GST & Taxation','Explain appropriate tax or GST concepts for the given context.',1,68),
('role','Accountant','Domain','Auditing','Apply evidence, controls and documentation in an audit scenario.',1,69),
('role','Marketing Executive','Domain','Market Research','Frame customer and market questions using appropriate evidence.',1,70),
('role','Marketing Executive','Domain','Digital Marketing','Select channels and metrics appropriate to an audience and goal.',1,71),
('role','Marketing Executive','Domain','Consumer Behavior','Reason about customer needs, positioning and ethical practice.',1,72),
('role','Pharmacovigilance Associate','Domain','Pharmacology','Explain relevant medication-safety fundamentals educationally.',1,73),
('role','Pharmacovigilance Associate','Domain','Clinical Communication','Use clear, neutral safety-case documentation and communication.',1,74),
('role','Staff Nurse','Domain','Patient Safety','Explain safety-focused checks and escalation in an educational context.',1,75),
('role','Staff Nurse','Domain','Clinical Communication','Communicate respectfully, accurately and clearly in a care scenario.',1,76),
('role','Legal Associate','Domain','Legal Research','Identify relevant authorities and verify jurisdictional context.',1,77),
('role','Legal Associate','Domain','Case Analysis','Identify issues, relevant facts and a reasoned position.',1,78),
('role','Content Writer','Domain','Professional Writing','Organize clear, accurate and audience-appropriate content.',1,79),
('role','Research Assistant','Domain','Experimental Reasoning','Use suitable research methods, controls and uncertainty.',1,80),
('role','Teacher','Domain','Lesson Planning','Align an inclusive lesson with learner level and objectives.',1,81),
('role','Product Designer','Domain','UI/UX Design','Support design choices with accessibility and user evidence.',1,82),
('role','Agriculture Officer','Domain','Agronomy','Apply crop and field knowledge to context-specific recommendations.',1,83)
on conflict(scope_type,scope_name,interview_type,name) do nothing;
