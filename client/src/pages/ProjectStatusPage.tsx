import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Database,
  ExternalLink,
  Laptop,
  ShieldCheck,
} from "lucide-react";
import { PageHeading, Panel } from "@/components/app/Shared";
import { gateLabels, projectOutcomes, type ProjectOutcome } from "@/lib/project-status-data";

const completed = projectOutcomes.filter(outcome => outcome.status === "complete");
const open = projectOutcomes.filter(outcome => outcome.status === "open");
const supabaseBlocked = open.filter(outcome => outcome.gate === "supabase");
const completionPercent = Math.round((completed.length / projectOutcomes.length) * 100);

function OutcomeCard({ outcome }: { outcome: ProjectOutcome }) {
  const isComplete = outcome.status === "complete";
  const Icon = isComplete ? CheckCircle2 : CircleDashed;
  return (
    <article className={`project-status-item ${isComplete ? "is-complete" : "is-open"}`}>
      <div className="project-status-item-icon" aria-hidden="true">
        <Icon size={18} />
      </div>
      <div className="project-status-item-body">
        <div className="project-status-item-meta">
          <span className="project-status-id">{outcome.id}</span>
          <span className={`project-status-badge ${isComplete ? "badge-complete" : "badge-open"}`}>
            {isComplete ? "Complete" : "Still open"}
          </span>
          {!isComplete && (
            <span className={`project-status-gate gate-${outcome.gate}`}>
              {gateLabels[outcome.gate]}
            </span>
          )}
        </div>
        <h3>{outcome.title}</h3>
        <p>{outcome.note}</p>
      </div>
    </article>
  );
}

export default function ProjectStatusPage() {
  return (
    <main className="project-status-page">
      <PageHeading
        eyebrow="PROJECT TRACKER · LOCAL / INTEGRATION STATUS"
        title="What’s done—and what remains"
        description="A transparent progress snapshot for SMART INTERVIEW. An open outcome can have working local code, but it stays open until all of its acceptance criteria have evidence."
        action={
          <Link href="/" className="button button-ghost">
            <ArrowLeft size={15} /> Back to SMART INTERVIEW
          </Link>
        }
      />

      <section className="project-status-summary" aria-label="Project outcome summary">
        <article className="project-status-summary-card summary-complete">
          <CheckCircle2 size={19} aria-hidden="true" />
          <span>Completed outcomes</span>
          <strong>{completed.length}</strong>
          <small>Tracked as complete in the acceptance checklist</small>
        </article>
        <article className="project-status-summary-card summary-open">
          <CircleDashed size={19} aria-hidden="true" />
          <span>Still open</span>
          <strong>{open.length}</strong>
          <small>Includes partially implemented work and unverified gates</small>
        </article>
        <article className="project-status-summary-card summary-gated">
          <Database size={19} aria-hidden="true" />
          <span>Supabase-dependent</span>
          <strong>{supabaseBlocked.length}</strong>
          <small>Left untouched; no credentials, queries or migrations used here</small>
        </article>
      </section>

      <div className="project-status-progress" aria-label={`${completionPercent}% of tracked outcomes are marked complete`}>
        <div className="project-status-progress-label">
          <span>Acceptance outcomes marked complete</span>
          <b>{completed.length} of {projectOutcomes.length} · {completionPercent}%</b>
        </div>
        <div className="project-status-progress-track" role="progressbar" aria-valuenow={completionPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Completed acceptance outcomes">
          <span style={{ width: `${completionPercent}%` }} />
        </div>
      </div>

      <div className="notice-info project-status-notice" role="note">
        <ShieldCheck size={18} aria-hidden="true" />
        <p><b>Scope of this update:</b> local code, tests, documentation and the requested status page only. Supabase credentials, database state, migrations, RLS, Auth settings and scheduled-job registration were not accessed or changed. Live provider and real-device behavior are not claimed as verified.</p>
      </div>

      <Panel title={`Completed (${completed.length})`} subtitle="These outcome groups are marked complete in TODO.md; some external settings remain explicitly noted as unverified.">
        <div className="project-status-list">
          {completed.map(outcome => <OutcomeCard key={outcome.id} outcome={outcome} />)}
        </div>
      </Panel>

      <Panel title={`Still open (${open.length})`} subtitle="The gate label identifies the main kind of remaining work; it does not imply no code exists yet.">
        <div className="project-status-list">
          {open.map(outcome => <OutcomeCard key={outcome.id} outcome={outcome} />)}
        </div>
      </Panel>

      <Panel title="How to read this page" subtitle="Acceptance status is intentionally conservative.">
        <div className="project-status-guidance">
          <p><Laptop size={16} aria-hidden="true" /> <b>Local work</b> can be checked with source review, tests, docs and a local production build.</p>
          <p><ExternalLink size={16} aria-hidden="true" /> <b>Browser/device or provider checks</b> require real microphones, cameras, browser permissions or a live configured provider.</p>
          <p><Database size={16} aria-hidden="true" /> <b>Supabase gates</b> require the owner’s project settings and live data layer. They stay open until explicitly verified.</p>
        </div>
        <p className="muted-copy">This tracker reflects the project acceptance list, not an independent certification of product readiness. A successful local test or deployment does not prove authentication, row-level isolation, persistence, model quality or scheduled execution.</p>
        <div className="project-status-links">
          <Link className="button button-secondary" href="/project-insights">Project Insights <ArrowUpRight size={14} /></Link>
          <Link className="text-link" href="/">Visit the public landing page <ArrowUpRight size={14} /></Link>
        </div>
      </Panel>
      <p className="project-status-updated">Snapshot: 6 November 2026 · Counts are aligned with the current TODO acceptance headings.</p>
    </main>
  );
}
