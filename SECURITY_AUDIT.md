# Security audit

**Review date:** 11 November 2026  
**Scope:** Source/configuration review plus safe tests and dependency audit; no penetration test or live service tests.

## Findings

- Protected React routes wait for Supabase auth state; tRPC protected/admin procedures independently enforce authenticated/admin contexts. Server context validates bearer tokens with Supabase Auth and uses the user's token for REST access.
- Candidate data queries include owner filters, and migration source establishes owner-scoped RLS, ownership relationships and a private resume bucket with owner-folder policies. These are source-level findings only; remote migrations, policies, storage settings and cross-account denial were not exercised.
- API procedures use bounded Zod schemas. Express request bodies are size-limited; resume files are parsed in the browser with size/type/signature checks and then uploaded to the private storage bucket. The remote bucket's existing settings require owner verification.
- Gemini keys are sent only in server request headers. Structured outputs are schema-validated. Text provider retries are bounded and time-limited; audio transcription has a separate timeout. The database-backed per-user rate limiter fails closed and its mocked tests passed.
- Scheduler callback code requires a high-entropy bearer secret, constant-time comparison, registered UID, advisory lock, idempotent run ledger, sanitized failures, and retryable stale/failed work.
- Express disables `X-Powered-By` and adds `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and a restrictive Permissions Policy. No permissive CORS middleware is configured. CSP and HSTS are not provided by the app and must be configured at the production edge. Use HTTPS and configure trusted proxy behavior at the host.
- No active Manus/Forge package or runtime integration was found. The initial migration seeds separate synthetic demo-only tables, which the current app source does not query.

## Remaining risks and limitations

1. RLS/storage claims are not verified against the actual Supabase project. Do not treat source policies as a guarantee.
2. The shared limiter requires `202611100001_gemini_rate_limits.sql` and access to the private database URI. It is per-user/per-operation, not a global rate or spend cap.
3. Resume upload, remote bucket size/MIME settings, retention and deletion behavior require a database/storage owner review.
4. Audio fallback is capped at 1,400,000 raw bytes, with matching server-side decoded-buffer and base64-length validation so normal payloads fit below Express's default 2 MiB JSON cap. Oversized recordings receive a client-side error before base64 encoding/submission.
5. HSTS/CSP, HTTPS termination, backups, log retention, monitoring and environment secret storage were not verified.
6. This review did not execute authenticated browser tests, SQL, migrations, external jobs, device access, or live provider requests. It is not a security guarantee or penetration test.

## Safe execution evidence

- `corepack pnpm lint` — 0 warnings/errors.
- `corepack pnpm check` — passed.
- `corepack pnpm build` — passed.
- `corepack pnpm audit --prod --audit-level=high` — no known vulnerabilities.
- Selected mocked/fixture suite — 9 files / 46 tests passed.

Manual verification requirements are in [REMAINING_TASKS.md](REMAINING_TASKS.md). Full execution evidence is in [TEST_REPORT.md](TEST_REPORT.md).
