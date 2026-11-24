# Smart Interview AI

Smart Interview AI is a React 19 + TypeScript + Vite client with an Express/tRPC server, Supabase Auth/PostgreSQL persistence, and server-side Google Gemini calls. The active application does not depend on Manus or a platform-specific runtime.

## Local setup

Requirements: Node.js 20+ and the project-pinned pnpm 10.34.5.

```powershell
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env
# Configure values locally; never paste private keys into chat or source control.
corepack pnpm dev
```

Open `http://localhost:3000`. `GET /api/health` is a process liveness check only; it does not verify Supabase, Gemini, or scheduler connectivity.

## Configuration and integrations

See [.env.example](.env.example) and [SETUP.md](SETUP.md). Keep `.env` local; `.gitignore` excludes it.

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are browser-safe Supabase settings; RLS must remain enabled.
- `SUPABASE_DB_URL` is private and required by production for the shared Gemini limiter; it is also used by scheduled workers and the controlled migration command. Never expose it through `VITE_` variables.
- `SUPABASE_DB_SSL_CA` optionally supplies the trusted database CA PEM. TLS verification remains enabled.
- `GEMINI_API_KEY` is a private server credential. Gemini calls are made from the server.
- `GEMINI_MODEL` and `GEMINI_AUDIO_MODEL` select the text and audio models.
- `SCHEDULER_SHARED_SECRET` is required only when external scheduled callbacks are enabled.
- Google OAuth client credentials belong in Supabase Auth provider settings, not frontend variables or source files.

Rotate any credentials previously disclosed in chat. Store replacements only in local `.env` or the deployment secret manager.

Apply the 13 ordered SQL migrations in `supabase/migrations/` only after a backup and reconciliation of the target schema and migration ledger. Follow [Supabase setup](supabase/SETUP.md); never reset or delete existing data. The latest migration enables the shared database-backed per-user Gemini token bucket and must be applied before production AI calls are enabled.

## Architecture and Directory Structure

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for a comprehensive diagram, module tree, and data flow guide covering the client, server, and database architecture.

## Interview behavior and limitations

Simple Interview, Live Interview, and Behavioral Interview are authenticated routes. The Live Interview route uses the three-panel room and existing persisted session/turn/finalization handlers. Browser speech recognition and synthesis are feature-dependent; audio transcription uses a server-side Gemini request. Camera use is optional and user-initiated. Resume files are checked and parsed locally, then stored in the user's private Supabase `resumes` bucket.

Structured AI responses are validated before use. Gemini requests have bounded retry attempts and per-attempt timeouts; transcription has a separate timeout and no automatic retry. AI requests fail closed if the shared database-backed per-user limiter is unavailable or its migration is missing.

The app does not register scheduled jobs itself. A configured external scheduler is needed for daily question-bank refresh and deadline finalization. An HTTP success response alone does not prove a job completed.

## Commands

- `corepack pnpm dev` — Express/tRPC + Vite development server.
- `corepack pnpm build` — production client and server bundles.
- `corepack pnpm start` — run the built server.
- `corepack pnpm check` — TypeScript check.
- `corepack pnpm lint` — ESLint.
- `corepack pnpm test` — full Vitest suite; not run in this audit because it may include user-reserved integration flows.
- `corepack pnpm audit --prod --audit-level=high` — production dependency audit.
- `corepack pnpm db:supabase:migrate` — apply versioned migrations through the private database URI; reserved for the project owner.

## Current release-readiness evidence

**Verified by execution on 11 November 2026:** frozen install, lint (zero warnings/errors), TypeScript check, production build, production dependency audit (no known vulnerabilities at the high threshold), and 46 isolated mocked/fixture tests across 9 files. Exact commands and limitations are in [TEST_REPORT.md](TEST_REPORT.md).

**Not verified:** Supabase migration state/RLS, authentication and OAuth, real Gemini beyond previously recorded historical activity, browser permissions/speech, authenticated interviews, scheduler execution, or production hosting. The application is build-verified but is **not production-ready** until the reserved runtime and operational checks are completed.
