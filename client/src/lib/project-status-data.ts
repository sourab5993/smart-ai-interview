export type OutcomeStatus = "complete" | "open";
export type OutcomeGate = "local" | "browser" | "supabase" | "external";

export type ProjectOutcome = {
  id: string;
  title: string;
  status: OutcomeStatus;
  gate: OutcomeGate;
  note: string;
};

// Keep ids, titles and status values aligned with the headings in TODO.md.
// The status page treats an open outcome as incomplete even when some code exists.
export const projectOutcomes: ProjectOutcome[] = [
  { id: "1", title: "Public landing, brand system, accessibility and responsive application shell", status: "open", gate: "local", note: "The main landing and workspace are implemented; remaining visual/accessibility details and full responsive acceptance still need completion." },
  { id: "1A", title: "SMART INTERVIEW product scope and responsive visual repair", status: "open", gate: "browser", note: "The requested SMART INTERVIEW-only brand is preserved; full laptop, tablet and mobile visual acceptance remains open." },
  { id: "1B", title: "Fast report responses and authentication redirect verification", status: "complete", gate: "external", note: "Fast response handling and same-origin redirect behavior are implemented and covered locally. Supabase dashboard provider/allowlist settings remain explicitly unverified." },
  { id: "1C", title: "Readable readiness/report layout and completion-aware scoring", status: "complete", gate: "local", note: "Readiness/report layout and completion-adjusted session scoring changes are implemented and covered by local checks." },
  { id: "1D", title: "Skill-gap table readability", status: "complete", gate: "local", note: "Skill rows, target/current labels, progress and gap presentation were repaired for narrow layouts." },
  { id: "1E", title: "Full workspace structure and responsive readability pass", status: "complete", gate: "local", note: "Shared workspace layout and responsive wrapping were repaired across the tracked application surfaces." },
  { id: "1F", title: "Standalone administrator console", status: "complete", gate: "local", note: "The admin route uses a standalone shell and preserves separate unauthenticated and non-admin states." },
  { id: "2A", title: "Behavioral Interview Analysis launcher and AI question generation", status: "open", gate: "supabase", note: "Local launcher and generation paths exist; end-to-end authenticated question/session persistence still depends on the configured Supabase schema." },
  { id: "2B", title: "Behavioral device setup, consent and model readiness", status: "open", gate: "browser", note: "Selected device IDs are handed off in tab-scoped storage and exact constraints are rebuilt; actual permissions, model readiness and full browser behavior remain unverified." },
  { id: "2C", title: "Speech-only behavioral interview room", status: "open", gate: "browser", note: "Speech capture/retry is implemented, with transcription recording isolated to microphone tracks; full device and persistence journeys are not verified." },
  { id: "2D", title: "Local behavioral inference and reliable telemetry", status: "open", gate: "browser", note: "Face/Pose/Hand inference runs in a local worker; actual device coverage and all telemetry cases remain open for verification." },
  { id: "2E", title: "Behavioral backend, scoring and report integration", status: "open", gate: "supabase", note: "Atomic lifecycle and recomputed scoring are in local migration source, but remote schema, RLS, writes and report persistence were not checked." },
  { id: "2F", title: "Behavioral mode tests and local setup documentation", status: "open", gate: "local", note: "Focused tests and setup notes exist; several requested edge-case tests and the complete environment/device documentation remain to be audited." },
  { id: "2", title: "Authentication, onboarding, account settings and privacy boundaries", status: "open", gate: "supabase", note: "The product uses Supabase Auth and owner-scoped data paths; live provider, redirect, RLS isolation and durable user-data behavior require Supabase verification." },
  { id: "3", title: "Data-driven cross-discipline education, career, roles, skills and question taxonomy", status: "open", gate: "supabase", note: "Catalog breadth and pathways depend on the persistent catalog schema and real seeded data; no database audit or seed operation was performed." },
  { id: "4", title: "Personalized interview setup, question generation and live interview controls", status: "complete", gate: "local", note: "The written interview setup, question flow, controls and server-backed evaluation contract are implemented and locally tested." },
  { id: "5", title: "Universal, course- and interview-type-aware answer evaluation and reports", status: "complete", gate: "local", note: "Evidence-checked evaluation, report separation and retry-safe service failure behavior are implemented; live model quality is not implied." },
  { id: "6", title: "Resume upload/analyzer, job-description matching and secure assets", status: "open", gate: "supabase", note: "The interface and analysis paths exist; durable owner-scoped storage, authorization and complete document workflows need live data/storage verification." },
  { id: "7", title: "Question explanations, study plans, skill gaps and repeat practice", status: "open", gate: "supabase", note: "These features rely on persisted course/skill/interview context and saved plan actions; end-to-end data-backed completion remains open." },
  { id: "8", title: "Performance analytics, ML readiness and comparisons", status: "open", gate: "supabase", note: "Local baseline and analytics code avoid invented model accuracy; populated history, comparisons and metrics require real stored records." },
  { id: "9", title: "Dashboard, history, bookmarks, notifications, settings and admin", status: "open", gate: "supabase", note: "Some shell and control surfaces are implemented; full owner-scoped history, bookmark, notification, profile and admin data journeys remain unverified." },
  { id: "10", title: "Persistent database schema, migrations, RLS and backend API", status: "open", gate: "supabase", note: "This outcome is intentionally untouched in this task. The existing migrations were not inspected, applied or verified." },
  { id: "11", title: "Secure configurable AI service, error handling and multilingual UX", status: "open", gate: "external", note: "Server-side schemas, bounded errors and retries are present; provider availability/quality and complete English/Hindi/Hinglish UX need validation." },
  { id: "12", title: "Academic project-insights, operational quality and deployment readiness", status: "open", gate: "supabase", note: "Project Insights and local operational safeguards exist; full demo journeys and integration readiness depend on live database/provider checks." },
  { id: "13", title: "Cross-platform deployment packaging and public release", status: "open", gate: "supabase", note: "Deployment remains open until the configured database, providers and production runtime are verified." },
  { id: "14", title: "Authenticated, retry-safe scheduled application work", status: "open", gate: "supabase", note: "Worker code exists locally, but schedule registration, task-UID binding and successful run records were not performed or verified." },
  { id: "15", title: "Live Interview character and optional on-device camera framing", status: "open", gate: "browser", note: "A virtual interviewer, optional local framing analysis and retryable turn-based transcript path are implemented; browser/device verification remains open." },
  { id: "16", title: "Evidence-based report rubric and separation of measures", status: "open", gate: "supabase", note: "Evidence-backed answer quality is separated from transcript communication observations in local code/tests; persisted records and full report lifecycle still need verification." },
  { id: "17", title: "Project progress and remaining-work status page", status: "complete", gate: "local", note: "This public page reports completed/open outcomes, cautions against treating partial implementation as complete, and separates local work from external blockers." },
];

export const gateLabels: Record<OutcomeGate, string> = {
  local: "Local implementation",
  browser: "Browser/device check",
  supabase: "Supabase required",
  external: "Live provider/settings",
};
