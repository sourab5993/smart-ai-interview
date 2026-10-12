# 🚀 Supabase Setup & Upload Guide (Smart AI Interview Platform)

All necessary code changes have been made to your project to support **Supabase PostgreSQL Database** and **Supabase Storage**.

Follow these simple steps to finalize your Supabase setup and take your project live.

---

## ⚡ Step 1: Run the Database Schema in Supabase (1 Minute)

Your Supabase project is already connected in `.env`:
`https://fvvdkfdyvgwxymhpxhgi.supabase.co`

Now, create the required database tables (`users`, `interview_sessions`) and storage bucket:

1. Open your [Supabase Dashboard](https://supabase.com/dashboard/project/fvvdkfdyvgwxymhpxhgi).
2. On the left sidebar, click the **SQL Editor** tab (the `>_` terminal icon).
3. Click **"+ New query"**.
4. Open the file [`supabase_schema.sql`](file:///c:/Users/soura/Sourab%20Kumar/smart-ai-interview-preparation-&-evaluation/supabase_schema.sql) in this project, copy **all** of its contents, and paste it into the Supabase SQL editor.
5. Click **"Run"** (or press `Ctrl` + `Enter`).
6. You will see:
   ```text
   Success: No rows returned
   ```
   This automatically creates:
   - ✅ The `public.users` table with performance indexes and timestamps trigger.
   - ✅ The `public.interview_sessions` table with user isolation.
   - ✅ The `resumes` cloud storage bucket with public read policies.
   - ✅ Pre-seeded administrator account: `sourabstar786@gmail.com`
   - ✅ Pre-seeded test candidate account: `candidate@evaluator.edu`

---

## 🔍 Step 2: Test Locally

Start your local development server:
```bash
npm run dev
```

1. Look at the terminal output. You will see:
   ```text
   [Database] ⚡ Supabase provider detected: https://fvvdkfdyvgwxymhpxhgi.supabase.co
   [Database] ✅ Supabase PostgreSQL active (Supabase PostgreSQL connected and tables ready!)
   ```
2. Open [http://localhost:3000](http://localhost:3000) in your browser.
3. Test login with:
   - **Admin Account**: `sourabstar786@gmail.com` / `sourab2004`
   - **Candidate Account**: `candidate@evaluator.edu` / `CandidatePassword@123`
4. Conduct an interview or save a session — the data will now be stored directly in your Supabase PostgreSQL cloud database!

---

## 🌐 Step 3: Deploy Full Application to Vercel (or Render)

Since Supabase is a **Backend-as-a-Service (Database + Storage)**, your web application (React frontend + Express API) is hosted on **Vercel** (which is already configured via [`vercel.json`](file:///c:/Users/soura/Sourab%20Kumar/smart-ai-interview-preparation-&-evaluation/vercel.json)):

### Option A: Deploy to Vercel (Recommended & Instant)
1. Push your updated code to GitHub:
   ```bash
   git add .
   git commit -m "Add Supabase PostgreSQL and Storage integration"
   git push origin main
   ```
2. Go to [vercel.com](https://vercel.com) and click **"Add New..." ➜ "Project"**.
3. Import your GitHub repository.
4. Add the following **Environment Variables** in the Vercel dashboard:

| Variable Name | Value | Purpose |
|---|---|---|
| `SUPABASE_URL` | `https://fvvdkfdyvgwxymhpxhgi.supabase.co` | Supabase Cloud API URL |
| `SUPABASE_ANON_KEY` | *(Your anon key from .env)* | Supabase Client Public Key |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Your service_role key from .env)* | Supabase Backend Secret Key |
| `GEMINI_API_KEY` | *(Your Gemini API Key from .env)* | Google Gemini AI Engine |
| `JWT_SECRET` | `super_secret_jwt_key_smart_ai_interview_prep_2026_production_safe` | Secure JWT signing |
| `NODE_ENV` | `production` | Production mode |

5. Click **"Deploy"**.
6. Within 60 seconds, your complete Smart AI Interview Preparation platform will be live with full Supabase cloud storage and PostgreSQL!

---

## 🛡️ What Changes Were Made to This Codebase?

1. **Installed `@supabase/supabase-js`**: Official Supabase SDK for Node.js.
2. **Created `server/config/supabase.ts`**:
   - Manages client singleton with service role key.
   - Provides live connectivity checks and resume file uploads to Supabase Storage.
3. **Created `supabase_schema.sql`**:
   - PostgreSQL schema, foreign keys, cascade deletes, indexes, triggers, and storage bucket configuration.
4. **Updated `server/models/User.ts`**:
   - Implemented bidirectional snake_case ↔ camelCase column mappers.
   - `UserService` queries Supabase `users` table directly with zero breaking changes and fallback resilience.
5. **Updated `server/models/InterviewSession.ts`**:
   - `SessionService` performs full CRUD operations on Supabase `interview_sessions` table.
   - Added user isolation filters and JSONB support for questions and rubric scores.
6. **Updated `server/routes/databaseRoutes.ts`**:
   - Replaced strict MongoDB ObjectId casting with safe polymorphic ID handling (supporting Supabase UUIDs).
7. **Updated `server/routes/resumeRoutes.ts`**:
   - Added optional upload of candidate resumes directly to the `resumes` bucket on Supabase Storage.
8. **Updated `server/config/database.ts`**:
   - Automatically detects Supabase and reports real-time latency and health status via `/api/health` and `/api/db/health`.
