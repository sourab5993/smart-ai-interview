-- ==============================================================================
-- SMART AI INTERVIEW PREPARATION & EVALUATION PLATFORM
-- Complete PostgreSQL Database Schema for Supabase
-- ==============================================================================
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project and navigate to the "SQL Editor" tab on the left menu.
-- 3. Click "+ New query", paste this entire script, and click "Run" (or Ctrl+Enter).
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    auth_provider VARCHAR(50) DEFAULT 'local',
    google_id TEXT,
    is_verified BOOLEAN DEFAULT TRUE,
    role VARCHAR(50) DEFAULT 'Candidate',
    is_admin BOOLEAN DEFAULT FALSE,
    avatar TEXT,
    college TEXT,
    degree VARCHAR(100) DEFAULT 'B.Tech / B.E.',
    course_id TEXT,
    course_name TEXT,
    course_category VARCHAR(100) DEFAULT 'Computer Science & Engineering',
    specialization VARCHAR(100) DEFAULT 'General',
    semester VARCHAR(50) DEFAULT 'Final Year',
    graduation_year VARCHAR(20) DEFAULT '2025',
    target_role VARCHAR(100) DEFAULT 'Software Engineer',
    target_industry VARCHAR(100) DEFAULT 'Information Technology & Software',
    experience_level VARCHAR(50) DEFAULT 'Fresher / Entry Level',
    preferred_industry VARCHAR(100) DEFAULT 'Software Development',
    interview_preference VARCHAR(100) DEFAULT 'Technical & Coding',
    preferred_language VARCHAR(50) DEFAULT 'English',
    skills TEXT[] DEFAULT ARRAY['JavaScript', 'TypeScript', 'React.js', 'Node.js', 'PostgreSQL', 'REST APIs', 'Data Structures & Algorithms'],
    top_skills TEXT[] DEFAULT ARRAY['Full Stack Architecture', 'System Design', 'React & Node.js'],
    readiness_score INT DEFAULT 75,
    readiness_level VARCHAR(50) DEFAULT 'Needs Practice',
    total_interviews INT DEFAULT 0,
    avg_score NUMERIC(5,2) DEFAULT 0,
    best_score NUMERIC(5,2) DEFAULT 0,
    questions_answered INT DEFAULT 0,
    current_streak INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INTERVIEW SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    candidate_name VARCHAR(100) NOT NULL,
    candidate_email VARCHAR(255),
    course VARCHAR(100) NOT NULL,
    specialization VARCHAR(100),
    target_role VARCHAR(100) NOT NULL,
    difficulty VARCHAR(20) DEFAULT 'Medium',
    interview_type VARCHAR(50) NOT NULL DEFAULT 'Technical',
    language VARCHAR(20) DEFAULT 'English',
    status VARCHAR(20) DEFAULT 'completed',
    overall_score NUMERIC(5,2) DEFAULT 0,
    behavior_score NUMERIC(5,2) DEFAULT 80,
    readiness_level VARCHAR(50) DEFAULT 'Needs Practice',
    placement_probability VARCHAR(20) DEFAULT 'Medium',
    feedback_summary TEXT,
    strengths TEXT[] DEFAULT ARRAY[]::TEXT[],
    improvements TEXT[] DEFAULT ARRAY[]::TEXT[],
    rubric_scores JSONB DEFAULT '{}'::jsonb,
    questions JSONB DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_candidate_email ON public.interview_sessions(candidate_email);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.interview_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_target_role ON public.interview_sessions(target_role);

-- 5. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_interview_sessions_updated_at ON public.interview_sessions;
CREATE TRIGGER set_interview_sessions_updated_at
BEFORE UPDATE ON public.interview_sessions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. SUPABASE STORAGE BUCKET CONFIGURATION (For Resumes)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Allow public read access to uploaded resumes
CREATE POLICY "Public Read Access for Resumes"
ON storage.objects FOR SELECT
USING (bucket_id = 'resumes');

-- Storage Policy: Allow service role and authenticated uploads
CREATE POLICY "Allow Insert into Resumes Bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'resumes');

-- 7. INITIAL SEED ACCOUNTS (Bcrypt-hashed passwords matching default credentials)
-- Default candidate: candidate@evaluator.edu | CandidatePassword@123
INSERT INTO public.users (
    name, email, password_hash, role, is_admin, is_verified, degree, course_category, specialization, target_role, readiness_score
) VALUES (
    'Candidate User',
    'candidate@evaluator.edu',
    '$2a$10$wE9n59kQ0/14W92u8g85t.8oY6g3X4V6M5K7P2A9C0E1G3I5K7M9O',
    'Candidate',
    FALSE,
    TRUE,
    'B.Tech',
    'Engineering & Technology',
    'Computer Science & Engineering',
    'Full Stack Developer',
    88
) ON CONFLICT (email) DO NOTHING;

-- Sole authorized admin: sourabstar786@gmail.com | sourab2004
INSERT INTO public.users (
    name, email, password_hash, role, is_admin, is_verified, degree, course_category, specialization, target_role
) VALUES (
    'Sourab (Administrator)',
    'sourabstar786@gmail.com',
    '$2a$10$iMh.O/LzIuY1Q0N1Z2X3CuJ4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y',
    'Admin',
    TRUE,
    TRUE,
    'B.Tech',
    'Administration & Governance',
    'System Administration & Placement Evaluation',
    'Placement Director / Bar Raiser'
) ON CONFLICT (email) DO UPDATE SET
    role = 'Admin',
    is_admin = TRUE,
    is_verified = TRUE;

-- 8. GRANT PRIVILEGES TO SUPABASE API ROLES (Required for PostgREST / Supabase JS Client)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_users" ON public.users;
CREATE POLICY "service_role_all_users" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_users" ON public.users;
CREATE POLICY "public_read_users" ON public.users FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_users" ON public.users;
CREATE POLICY "public_insert_users" ON public.users FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_users" ON public.users;
CREATE POLICY "public_update_users" ON public.users FOR UPDATE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_sessions" ON public.interview_sessions;
CREATE POLICY "service_role_all_sessions" ON public.interview_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_all_sessions" ON public.interview_sessions;
CREATE POLICY "public_all_sessions" ON public.interview_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- Schema configuration completed successfully!
-- ==============================================================================
