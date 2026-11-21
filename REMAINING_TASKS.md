# Remaining tasks before release

These are owner-only operations. This audit did not execute SQL, migrations, auth, provider calls, devices, interviews, scheduler callbacks, or deployment.

## Database and Supabase

1. Back up the target Supabase database and compare its schema and migration ledger with all 13 files in `supabase/migrations/`; never reset or delete data.
2. Apply only verified unapplied migrations in order, including `202611100001_gemini_rate_limits.sql`. Verify the limiter function/table, its private execution privileges, owner policies, relationship constraints and RLS.
3. Inspect the existing `resumes` bucket settings; ensure it is private, capped at 10 MiB, restricted to PDF/DOCX MIME types, and uses the user-ID folder policies. Confirm current bucket configuration because the initial migration does not update an already-existing bucket on conflict.
4. Verify read/write ownership with two non-production accounts, including direct IDs for another account's interview, transcript, report, resume and study plan. Confirm cross-account reads/writes are denied.
5. Ensure the private `SUPABASE_DB_URL` is correctly configured for the server and migration runner with certificate verification enabled. Do not share it in chat.

## Authentication

Using non-production accounts, test:

1. Email/password signup and email verification.
2. Login/logout and session refresh after reload.
3. Password recovery and reset redirect.
4. Google OAuth provider setup, exact Supabase callback, return to `/onboarding`, and persisted authenticated session.
5. Protected route redirects and server procedure rejection without/with an invalid token.

## Interviews, speech and camera

In a supported browser, test text-only and spoken Simple/Live interviews separately:

1. Question generation, saved question/answer/transcript and evaluation/report persistence.
2. Manual finish, expiry finalization, refresh/recovery and transient network loss.
3. Microphone allowed/denied, unsupported speech recognition, silence/noise, duplicate result events, transcription errors, TTS unavailable/failure, and text fallback.
4. Confirm no answer is lost after interruption and no fake success is shown when a provider fails.
5. Confirm camera-off works without permission; optionally grant/deny camera and verify the feature's disclosed local processing behavior.

Do not treat fixture tests as real interview or device verification. Audio fallback is capped at 1,400,000 raw bytes and oversized recordings are rejected before base64 encoding or network submission; test microphone/audio behavior manually.

## Scheduler

1. Configure a high-entropy `SCHEDULER_SHARED_SECRET` (minimum 32 characters) in app and scheduler secret managers.
2. After applying scheduled-work migration, register `question-bank-refresh-daily` as `question_bank_refresh` and `deadline-finalizer-minute` as `deadline_finalizer`.
3. Configure HTTPS `POST /api/scheduled/callback` jobs at a daily UTC time and once-per-minute UTC respectively; use `Authorization: Bearer <secret>` and `x-scheduled-task-uid`.
4. In non-production, verify successful `scheduled_job_runs` records and actual question-bank/finalization persistence. HTTP 200 alone is insufficient.

## Production operations

1. Configure trusted HTTPS termination, HSTS and an environment-specific Content Security Policy. The application adds baseline browser security headers but does not configure CSP/HSTS.
2. Store private DB/Gemini/scheduler credentials only in the host secret manager; rotate any credentials previously disclosed in chat.
3. Configure and test backups, error monitoring, log retention, health checks, resource limits and a global/provider-level AI spend control. The shared limiter is per-user and does not provide a global billing cap.
4. Confirm outbound access to Supabase, Gemini and the browser model-asset origins used by optional MediaPipe.
5. Run the full test suite only within an explicitly approved environment; this review intentionally ran selected safe tests only.

See [DEPLOYMENT.md](DEPLOYMENT.md), [supabase/SETUP.md](supabase/SETUP.md) and [TEST_REPORT.md](TEST_REPORT.md).
