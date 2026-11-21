# Local setup

## Requirements

- Windows PowerShell, Node.js 20+ and Corepack.
- The project pins pnpm 10.34.5.
- A Supabase project for Auth and application data.
- A Google Gemini API key for live AI features.

## Install and start

```powershell
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env
# Fill local values in .env; never paste private credentials into chat.
corepack pnpm dev
```

Open `http://localhost:3000`. The `/api/health` endpoint indicates process liveness only; it is not a database/provider health check.

## Environment

Set values in `.env` or the deployment secret manager:

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` — public project URL and browser-safe publishable/anon key; keep RLS enabled.
- `SUPABASE_DB_URL` — private Session Pooler URI used by the shared Gemini limiter, scheduled workers, and controlled migration runner. URL-encode special characters in the password; never expose it to client code.
- `SUPABASE_DB_SSL_CA` — optional trusted database CA PEM. TLS verification remains enabled.
- `GEMINI_API_KEY` — private, server-side AI credential.
- `GEMINI_MODEL` and `GEMINI_AUDIO_MODEL` — optional model selectors.
- `GEMINI_RATE_LIMIT_WINDOW_SECONDS`, `GEMINI_RATE_LIMIT_BURST`, and operation-specific `GEMINI_RATE_LIMIT_*_PER_WINDOW` — optional positive bounded rate policies; see `.env.example`.
- `SCHEDULER_SHARED_SECRET` — optional until callbacks are configured; minimum 32 characters.
- `PORT`, `API_JSON_BODY_LIMIT`, `API_FORM_BODY_LIMIT` — runtime/size configuration. JSON defaults to 2 MiB.

Do not configure the Supabase service-role key. Rotate credentials previously disclosed in chat and store replacements only in `.env` or a protected secret manager.

## Supabase and OAuth

The repository contains 13 ordered migrations. Back up the target database and reconcile existing schema and migration ledger before applying only verified unapplied files. Never reset a database. Apply `202611100001_gemini_rate_limits.sql` before production AI calls so the shared limiter is present. Remote applied state is unknown; migrations and database operations are reserved for the project owner. Follow [supabase/SETUP.md](supabase/SETUP.md).

Configure Supabase Auth Site URL and allow the local/deployed `/onboarding` and `/reset-password` redirects. To enable Google sign-in, enable the Google provider in Supabase Auth, configure client credentials in its protected dashboard settings, and add the exact Supabase callback URI shown by the provider to the Google Cloud OAuth client. Complete interactive sign-in testing yourself.

## Browser testing (owner-run)

Use a current Chrome or Edge browser. `localhost` is a secure context; deployed microphone/camera use requires HTTPS. Test keyboard/text mode first. Browser speech APIs are not universal; the app offers text fallback. Camera use is optional and requested only after an explicit user action. No browser, device, auth or interview flow was run for this review.

## Safe local checks

```powershell
corepack pnpm lint
corepack pnpm check
corepack pnpm exec vitest run --maxWorkers=1 server/_core/runtime-config.test.ts server/request-limits.test.ts server/_core/gemini-rate-limit.test.ts server/gemini.test.ts server/voice-transcription.test.ts server/scheduled-work.test.ts server/scheduled-work-adapters.test.ts server/live-interview-deadline.test.ts client/src/features/live-interview/LiveInterviewPages.test.tsx
corepack pnpm build
corepack pnpm audit --prod --audit-level=high
```

The listed tests are selected mocks/fixtures, not live integrations. See [TEST_REPORT.md](TEST_REPORT.md) for exact executed results.
