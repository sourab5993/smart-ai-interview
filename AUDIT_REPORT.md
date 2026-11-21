# Final release-readiness audit

**Review date:** 11 November 2026  
**Classification:** Code complete for inspected flows; build verified; runtime partially verified; **not production-ready**.

## Executive summary

The current source builds and type-checks. The server now sets baseline browser security headers and disables Express's `X-Powered-By` header. The two unused direct production dependencies `axios` and `cookie` were removed. The shared per-user Gemini token bucket is implemented in PostgreSQL and fails closed if unavailable. Final safe checks passed: frozen install, lint, TypeScript, build, production audit, and 46 isolated mocked/fixture tests across 9 files.

No Supabase migrations, SQL, database operations, authentication flow, microphone/camera/recording/speech operation, interview session, external scheduler callback, live Gemini request, or deployment action was performed in this review.

## Security and authorization findings

- **Verified by code inspection:** `Private` wraps learner routes; protected tRPC procedures validate the bearer token against Supabase Auth. Admin access derives from the owner profile's role and uses an admin-only middleware.
- **Verified by code inspection:** application requests use the user's access token and public Supabase key. Interview, transcript, report, resume and study-plan queries use owner identifiers; migration source defines owner-scoped RLS, relationship constraints and private resume-storage policies.
- **Not verified:** remote migration state, actual RLS/storage policies, and cross-account denial. Source inspection is not a security guarantee.
- **Verified by code inspection:** Zod bounds API inputs; Express JSON/form body limits are configurable and bounded. Resume parsing checks size, file signature and PDF/DOCX extension/MIME in the browser; storage migration specifies a private bucket, 10 MiB size cap and allowed MIME types. Existing remote bucket settings still require owner verification.
- **Verified by code inspection:** server-side provider and scheduler errors are generally sanitized. Gemini secrets are sent in request headers, not URLs. The Supabase app-config endpoint returns only the browser-public URL/key.
- **Verified by code inspection:** server responses set `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a camera/microphone/geolocation `Permissions-Policy`; Express's `X-Powered-By` is disabled. No permissive CORS middleware is configured. CSP and HSTS are not set by Express; production TLS termination should enforce HTTPS/HSTS and an environment-specific CSP.
- **Not guaranteed by source review:** no penetration test, production traffic review, live RLS test, TLS deployment inspection, or provider security assessment was performed.

## Interview functionality

- **Simple Interview — implemented, not runtime verified:** authenticated setup generates questions through the server AI path; session, answers, evaluations and report are persisted under the user. Client timer triggers the existing finalization flow; server SQL functions and scheduled worker provide deadline protections/recovery. Requires owner-run database/auth/browser tests.
- **Live Interview — implemented, not runtime verified:** `/live-interview/:id` renders the three-panel `LiveInterviewRoom`. Session and turns are loaded from authenticated tRPC; saved questions/transcripts/evaluations drive the transcript; playback events and listening phase drive speech indicators. Adaptive follow-up, manual completion, deadline finalization and report generation use existing handlers. Camera is opt-in and its off state does not request permission.
- **Behavioral Interview — implemented, not runtime verified:** camera analysis remains local and optional; microphone/transcript and persisted lifecycle code exist. No device or session flow was run.
- **Known runtime boundary:** Browser speech support varies. Audio fallback is capped at 1,400,000 raw bytes (with a matching base64 input bound) so it fits under the default 2 MiB Express JSON limit. Oversized recordings are rejected locally with a shorter-answer/text-mode message; no provider call is made.
- **Session recovery and reports:** persistence/lease and deadline behavior are present in source and isolated unit tests; recovery against a real Supabase project remains unverified.

## AI protection

- **Verified by code inspection:** schema-validated Gemini requests, operation-specific PostgreSQL token buckets keyed by authenticated user/operation, bounded retries for transient text-provider errors, and per-attempt timeouts. Audio transcription uses its own timeout and no automatic retry.
- **Verified by safe tests:** mocked limiter tests cover authenticated identity, allowed/limited requests, and database failure behavior.
- **Production prerequisite:** apply `202611100001_gemini_rate_limits.sql`; do not enable production AI until the function/table exist and the server's private PostgreSQL role can execute the function. The limiter fails closed otherwise. Per-user limits do not replace provider-level/global cost controls.
- **Not performed:** no live Gemini request in this audit.

## Scheduler

- **Verified by code inspection:** bearer secret uses constant-time comparison; secret must be at least 32 characters; task UID is bounded and looked up in the active registry; PostgreSQL advisory lock prevents overlap; run ledger uses UTC date/minute keys; failed or stale-running work is retryable; errors are sanitized. Deadline finalization uses row locks and expiring leases.
- **Not runtime verified:** external task registration, callback execution, and persistent database effects. Configure the two task IDs only after database migration and deploy the endpoint over HTTPS.

## Manus independence and dependencies

- **Verified by code/dependency scan:** no Manus/Forge SDK, package, API, environment variable, auth/storage runtime integration, or active UI branding was found in client/server/shared/scripts/models/Supabase source, package manifest, or lockfile. A hidden starter metadata file remains locally; it is not imported or used at runtime.
- The initial migration contains clearly labeled synthetic demo-only records in separate tables. Current client/server source does not query those tables; do not present them as real learner outcomes.
- **Verified by code inspection:** `axios` and direct `cookie` dependency were unused and removed. Other UI and server dependencies have source usages; no further production dependency was removed.
- **Verified by execution:** production audit reported no known vulnerabilities at the requested high-severity threshold. This does not establish a vulnerability-free system.

## Remaining release blockers

1. Owner: reconcile and apply migrations only after backup; verify migration ledger, RLS, storage bucket settings, and RPC grants.
2. Owner: test email/password, verification, recovery, session refresh, Google OAuth callback, protected routes, and cross-account denial with non-production accounts.
3. Owner: test text, speech-recognition and transcription paths, permission denial/unsupported browser, interruption/reload, timer expiry, reports, and optional camera-off/camera-on behavior.
4. Owner: configure the external scheduler secret and task registry; verify successful run records and persisted changes in a safe non-production environment.
5. Owner: configure HTTPS/reverse proxy, HSTS/CSP, secrets, backups, monitoring, and provider/global spend controls; verify production health and recovery.
6. Owner: manually verify resume bucket policies/size/MIME settings and deletion/retention behavior.

Detailed evidence and safe-test boundaries are in [TEST_REPORT.md](TEST_REPORT.md), [SECURITY_AUDIT.md](SECURITY_AUDIT.md), [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md), and [REMAINING_TASKS.md](REMAINING_TASKS.md).
