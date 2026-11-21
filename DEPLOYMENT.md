# Deployment guide

## Release checks

The current source passed these safe local checks on 11 November 2026:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm check
corepack pnpm build
corepack pnpm audit --prod --audit-level=high
```

The focused mocked/fixture suite result is in [TEST_REPORT.md](TEST_REPORT.md). Do not use the unrestricted suite until its auth, database, device, speech and interview tests are explicitly within the owner's scope.

## Runtime and configuration

Deploy the built Express server on a Node.js host or Docker-compatible platform. It listens on `PORT`, serves the production Vite build, and exposes `GET /api/health`. Health is process liveness only; it does not prove provider, database or scheduler availability.

Set these only in the host's protected environment/secret manager:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — public Supabase project configuration; the server rejects service-role credentials.
- `SUPABASE_DB_URL` — private PostgreSQL Session Pooler URL. Required in production for the shared Gemini rate limiter and used by scheduled workers and controlled migrations.
- `SUPABASE_DB_SSL_CA` — optional trusted CA PEM. TLS certificate validation must stay enabled.
- `GEMINI_API_KEY` — private server-only key required for AI features.
- `GEMINI_MODEL`, `GEMINI_AUDIO_MODEL` — optional model selectors.
- `SCHEDULER_SHARED_SECRET` — optional until scheduler callbacks are enabled; if set, it must be at least 32 characters and the database URL is required.
- `PORT` — host-provided listening port.

Never put private keys in browser variables, `VITE_` variables, source control or container images. Rotate previously disclosed credentials before production.

## Supabase release gate

1. Back up the target database and reconcile all 13 ordered migrations with its schema and migration ledger.
2. Apply only verified unapplied migrations, including `202611100001_gemini_rate_limits.sql`; confirm the function/table and restricted grants before enabling AI endpoints.
3. Verify RLS/ownership and the private resume bucket settings in the actual project. No migration or database operation was performed in this audit.
4. Configure Auth site/redirect URLs, Google provider settings and callback URIs. Complete real auth and cross-account tests with non-production accounts.

See [supabase/SETUP.md](supabase/SETUP.md).

## Scheduler

The app does not register jobs. Once the scheduled-work migration is applied and the server is deployed over HTTPS, configure an operator-controlled scheduler:

- `POST https://<production-host>/api/scheduled/callback`
- `Authorization: Bearer <secret from SCHEDULER_SHARED_SECRET>`
- `x-scheduled-task-uid: question-bank-refresh-daily` daily at a selected UTC time.
- `x-scheduled-task-uid: deadline-finalizer-minute` once per minute UTC.

Register matching active task IDs in `scheduled_job_registry`. Verify `scheduled_job_runs` completed records and actual persisted database changes in a safe non-production environment. Do not execute/activate the jobs until the owner is ready.

## Edge security and operations

Express sets baseline browser security headers and suppresses `X-Powered-By`; it does not set CSP or HSTS. At the trusted HTTPS edge:

- Terminate TLS and redirect HTTP to HTTPS; enable HSTS once all subdomains are HTTPS-ready.
- Configure a Content Security Policy compatible with the configured Supabase origin and documented MediaPipe asset origins.
- Preserve same-origin API behavior; do not add wildcard credentialed CORS.
- Configure request/connection timeouts, backups, monitoring, log retention, incident response and secret rotation.
- Add provider/gateway global quotas and alerts. The application limiter is per-user/per-operation and is not a global spend cap.
- Confirm production resume bucket privacy, MIME restrictions and size limit.

No hosting provider was configured, no production deployment occurred, and no paid service was activated by this review.
