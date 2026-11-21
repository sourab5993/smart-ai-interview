# Supabase setup

The app uses Supabase Auth, PostgreSQL/PostgREST and a private `resumes` Storage bucket. The app intentionally uses the learner's Supabase access token for table and storage operations, so Row Level Security remains in force; the service-role key is neither needed nor accepted.

## Browser-safe and private settings

Set these values in the local `.env` file for development and in the deployment's protected secret/environment settings in production:

- `SUPABASE_URL`: project URL (public identifier).
- `SUPABASE_ANON_KEY`: anon/publishable key (intended for browsers; database RLS is still mandatory).
- `SUPABASE_DB_URL`: **private** PostgreSQL connection string used by the shared Gemini rate limiter and scheduled workers as well as controlled migrations. Do not prefix it with `VITE_` or expose it to browser code. Learner application records are read through Supabase PostgREST using the user's access token.
- `SUPABASE_DB_SSL_CA`: optional private PEM CA certificate only when the database endpoint uses a non-system-trusted CA. The migration runner always validates the server certificate; do not use `sslmode=no-verify` or disable validation to work around a TLS error.

Never provide or deploy the Supabase `service_role` key. The legacy starter MySQL adapter and its `DATABASE_URL`/Drizzle migration commands are not part of the active application; use Supabase PostgreSQL and the private `SUPABASE_DB_URL` only for server-side rate limiting, scheduled work, and controlled migrations.

## Create the schema

Run the SQL files below in the intended Supabase project, in the displayed filename order. This includes the Simple Interview deadline guard, owner-scoped behavioral/Live Interview tables, scheduled-work/lease-fencing functions, and the atomic Behavioral Interview write/report lifecycle:

```text
202610140001_initial.sql
202610140002_admin_catalogs.sql
202610140003_private_analytics.sql
202610140004_integrity_and_context.sql
202610140005_retry_safe_metrics.sql
202610140006_cross_discipline_questions.sql
202610140007_profile_interests.sql
202610200002_behavioral_interviews.sql
202610240001_enforce_interview_answer_deadlines.sql
202610240002_live_interviews.sql
202610240003_scheduled_work.sql
202611030001_behavioral_atomic_lifecycle.sql
202611100001_gemini_rate_limits.sql
```

### Manual SQL Editor procedure

1. Sign in to the Supabase Dashboard and confirm the project reference in the URL matches the project used by this website. Do not use a different development or production project by mistake.
2. Before applying schema changes, create a recoverable database backup/export using the Supabase backup workflow available to the project. These application tables may contain real user data; do not test migrations by deleting or resetting production records.
3. Open **SQL Editor** and create a new query. Copy the complete contents of the first not-yet-applied file from `supabase/migrations/`; do not omit headers, transaction statements, or the end of a file. Click **Run** once and wait for the editor's completed result.
4. Continue in the exact order above only after the previous file completed without an error. If the editor reports an error, stop at that file. Read the failed statement and inspect the database state before deciding whether to repair or retry; do not paste the entire file again blindly because a prior run may have applied some statements.
5. Pay particular attention to the final migrations. `202610240003_scheduled_work.sql` adds row-locked Simple/Live writes, UUID finalization fencing and provenance fields. `202611030001_behavioral_atomic_lifecycle.sql` adds atomic Behavioral Interview answer/observation saves, server-recomputed report completion, minimum-sample enforcement, active-session write guards and narrower authenticated write grants. `202611100001_gemini_rate_limits.sql` adds the server-only shared per-user token bucket used to protect paid AI operations. Apply only migrations not already fully applied; do not rerun a partially applied SQL Editor migration blindly. A successful SQL Editor response is not by itself proof that every expected function, trigger and policy exists; inspect the migration's object definitions and resulting schema before proceeding.
6. The SQL Editor does not record execution in `public.app_schema_migrations`. Before using `pnpm db:supabase:migrate` later, reconcile that ledger with the files you have independently verified as fully applied. If a manual run stopped partway, do not add the filename to the ledger until you have verified or repaired the full migration.

To inspect an existing runner ledger (if it exists):

```sql
select name, applied_at
from public.app_schema_migrations
order by name;
```

The repository runner creates this table and records a filename only after its SQL transaction commits. A manual SQL Editor run is outside that transaction/ledger mechanism. When the manual execution history is uncertain, reconcile each file against its complete SQL effects first; do not mark every filename as applied just to make the runner continue.

### Optional connection-string migration runner

If using the repository command instead, go to the Supabase Dashboard **Connect** panel, choose the **Session pooler** connection string, and copy the full URI including its exact username format. The session-pooler URI typically uses the project-qualified database username shown by Supabase; do not guess the username or substitute the account login password for the database password. If the database password is unknown, reset it in Supabase and update the URI. On an IPv4-only environment, use the `*.pooler.supabase.com` host; the direct `db.<project-ref>.supabase.co` host can be IPv6-only. Put this value only in the local `.env` as `SUPABASE_DB_URL` or in a trusted deployment secret manager; never place it in chat, source code, browser configuration or a `VITE_` variable. URL-encode special characters in the password. Then run `pnpm db:supabase:migrate`; it connects before creating the ledger and safely skips only files present in that ledger. If authentication fails, obtain/reset the database password and copy a fresh URI; do not weaken TLS verification.

The runner verifies the PostgreSQL TLS certificate chain (optionally using `SUPABASE_DB_SSL_CA`) and must authenticate successfully before it creates the migration ledger or applies any file. A failed TLS/authentication check leaves the schema unchanged. Keep both values private; neither is used for browser requests.

The Behavioral Interview Analysis migration creates owner-scoped behavioral sessions, Gemini-generated practice questions, spoken-answer metadata, timestamped landmark observations and report summaries. Raw camera frames are never uploaded. Audio is held in memory for the authenticated server-side Gemini transcription request and is not written to Supabase Storage or retained by the application by default. Apply `202610200002_behavioral_interviews.sql` before opening `/behavioral-interview` in Preview or production, then apply `202611030001_behavioral_atomic_lifecycle.sql` so answer/observation replacements and report finalization are transactionally guarded.

The Live Interview migration stores only the role, requested duration, inferred speech locale, question turns, recognized text, structured answer evaluations, and report JSON under the authenticated owner. It sets `started_at`/`deadline_at` from the database clock and rejects new or changed turn submissions after expiry. It does not install a background scheduler; a deployment scheduler/worker is still needed to finalize sessions if a candidate closes the page at the deadline.

The initial migration includes synthetic records in clearly labeled `demo_students` / `demo_interviews` tables. Current application source does not query these tables; they are not user practice history or trained-model evidence.

## Register scheduled work

The application does not install or rely on a hosted platform scheduler. A deployment must provide an external scheduler (for example a cron service you control) that sends HTTPS POST requests to `/api/scheduled/callback`. The callback requires both the server-only `SCHEDULER_SHARED_SECRET` and a registered task UID. Set the secret in the app's local `.env` for development or the deployment's secret manager, and set the same value in the scheduler's protected header configuration. Do not put it in a query string, request body, source control, or chat.

1. Apply `202610240003_scheduled_work.sql` and confirm the application is deployed with `/api/scheduled/callback`.
2. Set `SCHEDULER_SHARED_SECRET` to a freshly generated, high-entropy secret in both the application and scheduler secret managers. Use an HTTPS production origin for deployment.
3. Register the task IDs in Supabase SQL Editor:

   ```sql
   insert into public.scheduled_job_registry (task_uid, job_type, active)
   values
     ('question-bank-refresh-daily', 'question_bank_refresh', true),
     ('deadline-finalizer-minute', 'deadline_finalizer', true)
   on conflict (task_uid) do update
     set job_type = excluded.job_type,
         active = true,
         updated_at = now();
   ```

4. Configure the external scheduler to POST daily at a chosen UTC time (for example 00:10 UTC) for `question-bank-refresh-daily` and once per minute in UTC for `deadline-finalizer-minute`. Set the `Authorization` header to the literal `Bearer ` prefix followed by the value of `SCHEDULER_SHARED_SECRET`, and add these headers:

   ```text
   Authorization: Bearer <secret stored in scheduler secret manager>
   x-scheduled-task-uid: question-bank-refresh-daily
   ```

   Use `deadline-finalizer-minute` for the finalizer job's task header. Do not put either value in a URL or callback body.

5. Confirm successful runs in the database ledger:

   ```sql
   select r.job_type, r.active, r.task_uid,
          j.status, j.started_at, j.finished_at,
          j.model, j.prompt_version, j.generated_count, j.inserted_count, j.error_summary
   from public.scheduled_job_registry r
   left join public.scheduled_job_runs j using (task_uid)
   order by r.job_type, j.started_at desc;
   ```

   The question-bank job uses one date-keyed run per UTC day; the deadline finalizer records retry-safe invocations. Treat only a database row with `status = 'completed'` and a successful external scheduler run as evidence of execution. A missing secret, inactive registry row, unavailable database, failed AI provider call or unreachable handler is a failed setup—not an active job.

## Authentication URLs

In Supabase Authentication settings, keep email verification enabled as desired and allow the application's actual Preview origin plus the local development origin. Add the published origin as an additional redirect once the site has one. Signup links return to `/onboarding`; password recovery returns to `/reset-password` on the same origin.

The login/signup UI also offers Google OAuth. To enable it, create the OAuth client in Google Cloud, configure the Supabase Google provider with its client ID/secret, add the exact Supabase callback URL to the Google client, and allow the application's `/onboarding` redirect URL. A button in the UI does not mean provider setup or end-to-end OAuth testing is complete.

## First administrator

Sign up normally first. To grant administrator access to a specific account, copy `bootstrap-admin.sql` into the Supabase SQL Editor, replace its explicit email placeholder with that account's exact email, and run it once. Treat this as a privileged operation; the application itself does not let a normal user promote their own role. The admin screen exposes aggregates and limited account directory fields, not private answer or resume text.
