import { Activity, BrainCircuit, Database, ShieldCheck } from "lucide-react";
import { PageHeading, Panel, Tag } from "@/components/app/Shared";

const layers = [
  { title: "React + Vite client", detail: "Accessible, responsive routes; Supabase Auth session; browser speech and optional on-device MediaPipe." },
  { title: "Express + tRPC", detail: "Typed, authenticated procedures; input validation; server-side AI and speech calls; bounded error handling." },
  { title: "Supabase Auth + PostgreSQL", detail: "Identity, owner-scoped application records, migrations and row-level security policies." },
  { title: "Google Gemini AI + speech", detail: "Server-side structured coaching and transcription; browser speech recognition and synthesis remain available where supported." },
  { title: "External scheduled work", detail: "Daily question refresh and deadline-finalization handlers; an operator-controlled scheduler is active only after explicit registration and verification." },
];

const aiPipeline = [
  "User goal and permitted context",
  "Resume/profile signals (only when available)",
  "Role-aware question generation",
  "Interview turn and persisted answer",
  "Schema-validated AI coaching evaluation",
  "Performance and skill-gap summaries",
  "Personalized practice recommendations",
];

const mlPipeline = [
  "Historical interview data",
  "Feature engineering (planned)",
  "Model (not currently trained)",
  "Training (not yet available)",
  "Validation (no holdout evaluation yet)",
  "Prediction (not available)",
  "Readiness score (transparent baseline only)",
];

function Pipeline({ title, steps, tone }: { title: string; steps: string[]; tone: "ai" | "ml" }) {
  return (
    <div className={`insight-pipeline insight-pipeline-${tone}`} role="img" aria-label={`${title}: ${steps.join("; then ")}`}>
      {steps.map((step, index) => (
        <div className="insight-pipeline-step" key={step}>
          <span className="insight-pipeline-index">{String(index + 1).padStart(2, "0")}</span>
          <b>{step}</b>
          {index < steps.length - 1 && <span className="insight-pipeline-arrow" aria-hidden="true">→</span>}
        </div>
      ))}
    </div>
  );
}

export default function ProjectInsightsPage() {
  return (
    <div className="page-stack project-insights-page">
      <PageHeading
        eyebrow="PROJECT NOTES · IMPLEMENTATION OVERVIEW"
        title="Project Insights"
        description="A transparent guide to how SMART INTERVIEW is structured, how its coaching pipeline works, and which model and deployment capabilities are not yet verified."
      />

      <Panel title="Project Overview" subtitle="An interview-practice and learning platform; it is not a hiring decision system.">
        <p>SMART INTERVIEW helps learners practise role-specific interviews, preserve answers and reports, review evidence-linked coaching, and plan further study. The Simple Interview, spoken Live Interview and optional Behavioral Interview remain distinct practice modes.</p>
        <div className="insight-chip-row"><Tag>Education-first coaching</Tag><Tag>Supabase-centered data</Tag><Tag>Evidence over guesses</Tag></div>
      </Panel>

      <Panel title="Problem Statement" subtitle="Interview preparation often lacks role-specific repetition and useful feedback.">
        <p>Learners need a safe way to practise relevant questions, retain their own interview history and see what to improve. Model feedback can be incomplete or wrong, so every score is framed as approximate coaching, tied to available evidence, and kept separate from any hiring decision.</p>
      </Panel>

      <Panel title="Objectives" subtitle="Practice, understand, improve and return to real saved work.">
        <ul className="insight-list"><li>Support independently usable written and spoken interview practice.</li><li>Save the learner's real answers and reports for later review.</li><li>Generate role-aware questions and constructive, bounded coaching.</li><li>Use optional behavioral signals conservatively and only as practice context.</li><li>Keep account data owner-scoped and disclose unavailable external services clearly.</li></ul>
      </Panel>

      <Panel title="System Architecture" subtitle="A modular web application with Supabase as its identity and application-data platform.">
        <div className="insight-architecture" role="img" aria-label="Client to Express and tRPC backend, using Supabase and server-side model services with scheduled work">
          {layers.map((layer, index) => (
            <article className="insight-architecture-node" key={layer.title}>
              <span className="insight-pipeline-index">0{index + 1}</span><div><b>{layer.title}</b><p>{layer.detail}</p></div>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="AI Architecture / Pipeline" subtitle="Only validated, bounded model outputs are persisted as coaching; the source answer remains the evidence.">
        <Pipeline title="AI coaching pipeline" steps={aiPipeline} tone="ai" />
        <p className="muted-copy">The server sends only task-relevant context. The model is not an authority on truth, candidate quality or hiring outcomes. Invalid output, timeouts and provider failures must remain visible and retryable.</p>
      </Panel>

      <Panel title="ML Architecture / Pipeline" subtitle="No trained predictive model or accuracy result is claimed in the current implementation.">
        <Pipeline title="Machine-learning readiness pipeline" steps={mlPipeline} tone="ml" />
        <div className="notice notice-warning">The current readiness indicator is a transparent baseline from saved product data, not a trained classifier. Accuracy, precision, recall, F1 and confusion matrices are intentionally absent until a trained model and suitable evaluation data exist.</div>
      </Panel>

      <Panel title="Database Design" subtitle="Supabase PostgreSQL stores durable application records; browser frames and raw camera video are not uploaded for local analysis.">
        <div className="insight-card-grid">
          <article><Database size={18} /><b>Identity and learning</b><p>Profiles, preferences, course/catalog data, skills and role requirements.</p></article>
          <article><Activity size={18} /><b>Practice records</b><p>Sessions, selected questions, accepted answers, evaluations, reports, performance and study plans.</p></article>
          <article><ShieldCheck size={18} /><b>Privacy controls</b><p>Owner-scoped policies and authorization; optional local camera inference saves only bounded summaries where the mode permits.</p></article>
        </div>
        <p className="muted-copy">Schema migrations and operational status are tracked separately; this page does not imply an unapplied migration has been verified or that a scheduler is running.</p>
      </Panel>

      <Panel title="Technology Stack" subtitle="The application preserves the supplied project's React and TypeScript architecture.">
        <div className="insight-chip-row"><Tag>React 19</Tag><Tag>TypeScript</Tag><Tag>Vite</Tag><Tag>Express</Tag><Tag>tRPC</Tag><Tag>Supabase Auth</Tag><Tag>Supabase PostgreSQL</Tag><Tag>MediaPipe Tasks Vision</Tag><Tag>Server-managed AI</Tag></div>
      </Panel>

      <Panel title="AI Workflow" subtitle="A request is not complete until its actual answer and result are saved.">
        <ol className="insight-list"><li>Build a role-aware prompt from the learner's explicit goal and permitted saved context.</li><li>Call the configured server-side model with a schema, size limits, timeout and bounded retry policy.</li><li>Validate question/evaluation fields, evidence references and score bounds before saving.</li><li>Preserve source answers and report status; surface service failures without inventing a transcript or score.</li><li>Display approximate feedback as coaching and allow retry where the action is safe to repeat.</li></ol>
      </Panel>

      <Panel title="ML Workflow" subtitle="Historical data is not treated as a trained prediction merely because it can be charted.">
        <ol className="insight-list"><li>Use only authorized, owner-scoped historical records and documented features.</li><li>Keep current readiness indicators traceable to saved interview evidence and disclose the baseline logic.</li><li>Introduce a trained model only after privacy review, appropriate training/holdout data and real evaluation.</li><li>Publish standard evaluation metrics only when computed from that real evaluation, with limitations.</li></ol>
      </Panel>

      <Panel title="Model Evaluation" subtitle="The product refuses to manufacture performance metrics.">
        <div className="notice notice-info"><BrainCircuit size={17} /> Model evaluation will populate after training. No trained-model accuracy, precision, recall, F1 score or confusion matrix is available to display.</div>
        <p className="muted-copy">Current tests establish software behavior and schema guards; they do not establish objective model accuracy or predictive validity.</p>
      </Panel>

      <Panel title="Security" subtitle="Protected actions must be authorized at both the request and data layers.">
        <ul className="insight-list"><li>Supabase Auth provides user identity; server procedures verify the authenticated context.</li><li>RLS and owner filters isolate private profiles, interview sessions, answers, transcripts, reports and saved work.</li><li>Provider credentials and privileged database credentials remain server-only.</li><li>AI inputs are bounded; provider/database errors are sanitized in the learner interface.</li><li>Camera inference runs locally in an isolated worker; raw video, frames and landmark coordinates are not uploaded.</li></ul>
      </Panel>

      <Panel title="Limitations" subtitle="Supported behavior depends on configured services, browser permissions and hardware.">
        <ul className="insight-list"><li>Speech recognition is turn-based rather than a guaranteed streaming transcript; speech synthesis quality and language vary by browser.</li><li>MediaPipe assets may require network access and camera inference quality depends on lighting, framing, occlusion, device load and browser support.</li><li>Behavioral measures are approximate practice observations and may be unavailable when the sample threshold is not met.</li><li>Provider, OAuth, database migration, cross-account isolation and scheduled-job claims require verification in the configured production environment.</li></ul>
      </Panel>

      <Panel title="Future Scope" subtitle="Potential work, clearly separated from current verified capabilities.">
        <ul className="insight-list"><li>Run curated answer-rubric evaluation with human-reviewed reference cases.</li><li>Expand catalog breadth and reporting based on verified course and role data.</li><li>Consider a trained readiness model only after data-governance review and a representative validation set.</li><li>Improve multilingual speech support and measure latency/cost before making stronger availability claims.</li></ul>
      </Panel>
    </div>
  );
}
