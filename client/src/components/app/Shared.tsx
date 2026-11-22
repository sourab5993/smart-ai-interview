import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, Sparkles } from "lucide-react";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}
export function Panel({
  children,
  className = "",
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-heading">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function ScoreRing({
  score,
  size = 128,
  label = "readiness",
}: {
  score: number | null | undefined;
  size?: number;
  label?: string;
}) {
  const isAvailable =
    score !== null && score !== undefined && Number.isFinite(Number(score));
  const numericScore = isAvailable
    ? Math.max(0, Math.min(100, Math.round(Number(score))))
    : 0;
  return (
    <div
      className="score-ring"
      style={
        {
          width: size,
          height: size,
          "--score": `${numericScore}%`,
        } as React.CSSProperties
      }
      role="img"
      aria-label={
        isAvailable
          ? `${numericScore} percent ${label}`
          : `No ${label} available`
      }
    >
      <div>
        <b>
          {isAvailable ? numericScore : "—"}
          {isAvailable && <small>%</small>}
        </b>
        <span>{label}</span>
      </div>
    </div>
  );
}
export function ProgressBar({
  value,
  color = "cyan",
}: {
  value: number;
  color?: string;
}) {
  return (
    <div
      className={`progress-track progress-${color}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export function Tag({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}
export function EmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  action,
  href,
}: {
  icon?: typeof Sparkles;
  title: string;
  description: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={21} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && href && (
        <Link href={href} className="button button-secondary">
          {action}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
export function StatTile({
  icon: Icon,
  label,
  value,
  change,
  tone = "cyan",
}: {
  icon: typeof Sparkles;
  label: string;
  value: string | number;
  change?: string;
  tone?: string;
}) {
  return (
    <div className="stat-tile">
      <span className={`stat-icon ${tone}`}>
        <Icon size={17} />
      </span>
      <span className="stat-label">{label}</span>
      <b className="stat-value">{value}</b>
      {change && <span className="stat-change">{change}</span>}
    </div>
  );
}
export function LoadingState({
  text = "Loading your workspace…",
}: {
  text?: string;
}) {
  return (
    <div className="loading-state">
      <span className="spinner" />
      {text}
    </div>
  );
}
