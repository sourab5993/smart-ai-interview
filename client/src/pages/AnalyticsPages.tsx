import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bookmark,
  Check,
  Clock3,
  GitCompareArrows,
  Mic2,
  Target,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSupabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  EmptyState,
  LoadingState,
  PageHeading,
  Panel,
  ProgressBar,
  ScoreRing,
  StatTile,
  Tag,
} from "@/components/app/Shared";

type Session = {
  id: string;
  course: string;
  target_role: string;
  interview_type: string;
  difficulty: string;
  status: string;
  overall_score: number | null;
  created_at: string;
  duration_seconds: number | null;
  question_count: number;
};
type Metric = {
  session_id: string | null;
  metric_name: string;
  metric_value: number;
  category: string;
  created_at: string;
};
function avg(values: number[]) {
  return values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : 0;
}

export function PerformancePage() {
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        if (!userId) return;
        const c = await getSupabase();
        const [s, m] = await Promise.all([
          c
            .from("interview_sessions")
            .select(
              "id,course,target_role,interview_type,difficulty,status,overall_score,created_at,duration_seconds,question_count"
            )
            .eq("owner_id", userId)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(100),
          c
            .from("performance_metrics")
            .select("session_id,metric_name,metric_value,category,created_at")
            .eq("owner_id", userId)
            .order("created_at", { ascending: false })
            .limit(1000),
        ]);
        if (!live) return;
        if (s.error) throw s.error;
        setSessions(((s.data || []) as Session[]).reverse());
        setMetrics(((m.data || []) as Metric[]).reverse());
      } catch {
        if (live)
          setError(
            "We couldn't load your performance history. Your saved practice remains private."
          );
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [userId]);
  const overall = avg(sessions.map(s => s.overall_score || 0));
  const latest = sessions.at(-1);
  const trend = sessions.map((s, i) => ({
    index: i + 1,
    date: new Date(s.created_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    score: s.overall_score || 0,
    role: s.target_role,
  }));
  const names = Array.from(new Set(metrics.map(m => m.metric_name)));
  const byName = names
    .map(name => ({
      name,
      score: avg(
        metrics
          .filter(m => m.metric_name === name)
          .map(m => Number(m.metric_value))
      ),
      count: metrics.filter(m => m.metric_name === name).length,
    }))
    .sort((a, b) => b.score - a.score);
  const radar = byName.map(x => ({
    subject: x.name,
    value: x.score,
    fullMark: 100,
  }));
  const difficulties = Array.from(new Set(sessions.map(s => s.difficulty)));
  const difficultyRows = difficulties.map(d => ({
    difficulty: d,
    avg: avg(
      sessions.filter(s => s.difficulty === d).map(s => s.overall_score || 0)
    ),
    count: sessions.filter(s => s.difficulty === d).length,
  }));
  const recentMean = sessions.slice(-3).length
    ? avg(sessions.slice(-3).map(s => s.overall_score || 0))
    : 0;
  const priorMean = sessions.slice(-6, -3).length
    ? avg(sessions.slice(-6, -3).map(s => s.overall_score || 0))
    : 0;
  if (loading) return <LoadingState text="Loading your performance signals…" />;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="PERFORMANCE SIGNALS"
        title="Progress you can actually interpret."
        description="Your trends use saved practice answers—not a hiring likelihood or hidden model score."
        action={
          <Link href="/history" className="button button-secondary">
            Interview history <ArrowRight size={13} />
          </Link>
        }
      />
      {error && <div className="notice notice-warning">{error}</div>}
      {!sessions.length ? (
        <Panel>
          <EmptyState
            icon={BarChart3}
            title="No interviews yet. Your first mock interview is one click away."
            description="Complete a practice session to start collecting personal performance signals."
            action="Start a mock interview"
            href="/practice"
          />
        </Panel>
      ) : (
        <>
          <section className="metric-cards">
            <StatTile
              icon={Target}
              label="Practice readiness"
              value={`${overall}%`}
              change="Transparent session average"
              tone="cyan"
            />
            <StatTile
              icon={Activity}
              label="Completed sessions"
              value={sessions.length}
              tone="violet"
            />
            <StatTile
              icon={TrendingUp}
              label="Recent direction"
              value={
                sessions.length >= 4
                  ? recentMean > priorMean
                    ? `+${recentMean - priorMean} pts`
                    : recentMean < priorMean
                      ? `${recentMean - priorMean} pts`
                      : "Steady"
                  : "Building"
              }
              change={
                sessions.length >= 4
                  ? "Last 3 vs prior 3"
                  : "Need 4 sessions for comparison"
              }
              tone="green"
            />
            <StatTile
              icon={Trophy}
              label="Best session"
              value={`${Math.max(...sessions.map(s => s.overall_score || 0))}%`}
              tone="blue"
            />
          </section>
          <div className="analytics-grid">
            <Panel
              className="span-two"
              title="Score trend"
              subtitle="Completed interview scores by date; only saved sessions are included."
            >
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trend}>
                    <CartesianGrid stroke="#ffffff10" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#7d8ba0", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "#718097", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ChartTooltip
                      contentStyle={{
                        background: "#121722",
                        border: "1px solid #ffffff20",
                        borderRadius: 8,
                        color: "#e7eff9",
                        fontSize: 10,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#63dcf6"
                      strokeWidth={2}
                      dot={{ fill: "#85edff", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel
              title="Practice average"
              subtitle="Across completed sessions."
            >
              <div className="performance-score-center">
                <ScoreRing score={overall} size={137} label="average" />
                <div>
                  <b>
                    {sessions.length} session{sessions.length === 1 ? "" : "s"}
                  </b>
                  <small>
                    Most recent:{" "}
                    {latest
                      ? new Date(latest.created_at).toLocaleDateString()
                      : "—"}
                  </small>
                  <small>Last score: {latest?.overall_score ?? "—"}%</small>
                </div>
              </div>
              <p className="baseline-note">
                Transparent baseline from your actual completed practice.
              </p>
            </Panel>
            <Panel
              title="Dimension breakdown"
              subtitle="Average stored score by evaluated dimension."
            >
              {radar.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radar} outerRadius="73%">
                    <PolarGrid stroke="#ffffff18" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "#98a6ba", fontSize: 9 }}
                    />
                    <Radar
                      dataKey="value"
                      stroke="#9c8fff"
                      fill="#9c8fff"
                      fillOpacity={0.22}
                    />
                    <ChartTooltip
                      contentStyle={{
                        background: "#121722",
                        border: "1px solid #ffffff20",
                        borderRadius: 8,
                        color: "#e7eff9",
                        fontSize: 10,
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={Target}
                  title="No answer-level dimensions yet."
                  description="Dimension trends appear after the interviewer evaluates an answer."
                />
              )}
            </Panel>
            <Panel
              title="Where you are strongest"
              subtitle="Current average across saved evaluation notes."
            >
              <div className="dimension-list">
                {byName.length ? (
                  byName.map((d, i) => (
                    <div className="dimension-bar-row" key={d.name}>
                      <span>{d.name}</span>
                      <ProgressBar
                        value={d.score}
                        color={i === 0 ? "green" : i > 4 ? "violet" : "cyan"}
                      />
                      <b>{d.score}%</b>
                      <small>{d.count} signals</small>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No metrics yet"
                    description="Complete an interview to see dimension-level feedback."
                  />
                )}
              </div>
            </Panel>
            <Panel
              title="Difficulty progression"
              subtitle="Compare actual scores in each difficulty you tried."
            >
              {difficultyRows.length ? (
                <div className="difficulty-grid">
                  {difficultyRows.map(d => (
                    <div className="difficulty-cell" key={d.difficulty}>
                      <Tag
                        tone={
                          d.difficulty === "Hard" || d.difficulty === "Expert"
                            ? "amber"
                            : "cyan"
                        }
                      >
                        {d.difficulty}
                      </Tag>
                      <b>{d.avg}%</b>
                      <span>
                        {d.count} session{d.count === 1 ? "" : "s"}
                      </span>
                      <ProgressBar value={d.avg} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Difficulty trends will appear here"
                  description="Choose different difficulty levels as you practice."
                />
              )}
              <Link href="/practice" className="text-link">
                Try a new difficulty <ArrowRight size={13} />
              </Link>
            </Panel>
          </div>
          <Panel
            title="Course-aware skill signals"
            subtitle={
              latest
                ? `${latest.course} → ${latest.target_role}`
                : "Derived from your completed evaluation dimensions."
            }
          >
            <div className="heatmap-grid">
              {byName.map((d, i) => (
                <Link
                  href="/skill-gap"
                  className={`heat-cell heat-${d.score >= 80 ? "strong" : d.score >= 60 ? "steady" : "focus"}`}
                  key={d.name}
                >
                  <span>{d.name}</span>
                  <b>{d.score}</b>
                  <small>{d.score >= 80 ? "Strong" : "Practice"}</small>
                </Link>
              ))}
            </div>
            <div className="heatmap-legend">
              <span>
                <i className="heat-green" /> Strong evidence
              </span>
              <span>
                <i className="heat-blue" /> Building
              </span>
              <span>
                <i className="heat-amber" /> Focus area
              </span>
            </div>
          </Panel>
        </>
      )}
      <div className="disclaimer-line">
        <span className="tiny-orb" /> The readiness summary is a descriptive
        preparation signal. It is not a trained ML accuracy claim or a
        probability of employment.
      </div>
    </div>
  );
}

export function SkillGapPage() {
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [rows, setRows] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        if (!userId) return;
        const c = await getSupabase();
        const [g, p] = await Promise.all([
          c
            .from("skill_gaps")
            .select(
              "skill_name,current_score,required_score,priority,updated_at,course,target_role"
            )
            .eq("owner_id", userId)
            .order("current_score", { ascending: true })
            .limit(200),
          c
            .from("profiles")
            .select("course,target_role,skills")
            .eq("id", userId)
            .maybeSingle(),
        ]);
        if (!live) return;
        if (g.error) throw g.error;
        setRows(
          (g.data || [])
            .filter(
              (row: any) =>
                (!p.data?.course || row.course === p.data.course) &&
                (!p.data?.target_role || row.target_role === p.data.target_role)
            )
            .slice(0, 60)
        );
        setProfile(p.data);
      } catch {
        if (live)
          setError(
            "Skill gap data isn't available right now. Complete a session to generate private practice signals."
          );
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [userId]);
  if (loading)
    return <LoadingState text="Reviewing your saved practice signals…" />;
  const prioritized = rows
    .slice()
    .sort(
      (a, b) =>
        ({ High: 0, Medium: 1, Low: 2 })[
          a.priority as "High" | "Medium" | "Low"
        ] -
          { High: 0, Medium: 1, Low: 2 }[
            b.priority as "High" | "Medium" | "Low"
          ] ||
        a.current_score / a.required_score - b.current_score / b.required_score
    );
  const top = prioritized.slice(0, 3);
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR NEXT PRACTICE PRIORITIES"
        title="Find the gap. Pick one next step."
        description="Priorities are calculated from your observed answer scores compared with the target benchmark for practice."
        action={
          <Link href="/study-plan" className="button button-primary">
            Build a study plan <ArrowRight size={13} />
          </Link>
        }
      />
      {error && <div className="notice notice-warning">{error}</div>}
      {profile?.course && (
        <div className="path-banner">
          <GraduationIcon />{" "}
          <span>
            {profile.course} → {profile.target_role || "Career path"}
          </span>
          <small>Course-aware signals</small>
        </div>
      )}
      {!rows.length ? (
        <Panel>
          <EmptyState
            icon={Target}
            title="No skill gaps detected yet. Complete an interview to unlock your analysis."
            description="As you practice, your coach will compare your answer dimensions with target scores and suggest clear priorities."
            action="Start a mock interview"
            href="/practice"
          />
        </Panel>
      ) : (
        <>
          <Panel
            title="Top 3 skills you should improve"
            subtitle="Prioritized by gap size and focus level; based on evidence in your saved practice."
          >
            <div className="top-three-grid">
              {top.map((r, i) => (
                <div className="top-skill-card" key={r.skill_name}>
                  <span className="top-skill-num">0{i + 1}</span>
                  <b>{r.skill_name}</b>
                  <div>
                    <span>Current</span>
                    <strong>{r.current_score}</strong>
                    <i />
                    <span>Target</span>
                    <strong>{r.required_score}</strong>
                  </div>
                  <Tag tone={r.priority === "High" ? "amber" : "violet"}>
                    {r.priority} priority
                  </Tag>
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="All observed skill signals"
            subtitle="A gap is the difference between the current score and the target benchmark."
          >
            <div className="skill-gap-table-head">
              <span>SKILL</span>
              <span>CURRENT → REQUIRED</span>
              <span>GAP</span>
              <span>PRIORITY</span>
            </div>
            {rows.map(r => {
              const gap = Math.max(0, r.required_score - r.current_score);
              return (
                <div className="skill-gap-row" key={r.skill_name}>
                  <b>{r.skill_name}</b>
                  <div className="gap-progress">
                    <div className="gap-labels">
                      <span>Current {r.current_score}</span>
                      <span>Target {r.required_score}</span>
                    </div>
                    <ProgressBar
                      value={r.current_score}
                      color={gap <= 10 ? "green" : gap <= 25 ? "cyan" : "amber"}
                    />
                  </div>
                  <small>{gap} pts</small>
                  <span
                    className={`gap-label gap-${String(r.priority).toLowerCase()}`}
                  >
                    {r.priority}
                  </span>
                </div>
              );
            })}
          </Panel>
          <Panel
            title="Use one gap as your next prompt"
            subtitle="Practice helps turn a score into a repeatable skill."
          >
            <div className="next-gap-actions">
              {top.map(r => (
                <Link href="/practice" className="gap-next" key={r.skill_name}>
                  <span>
                    <Target size={15} />
                  </span>
                  <b>{r.skill_name}</b>
                  <small>Practice a role-aligned question</small>
                  <ArrowRight size={13} />
                </Link>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
function GraduationIcon() {
  return <Target size={15} />;
}

export function HistoryPage() {
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [compare, setCompare] = useState<any>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        if (!userId) return;
        const c = await getSupabase();
        const [s, m] = await Promise.all([
          c
            .from("interview_sessions")
            .select(
              "id,course,target_role,interview_type,difficulty,status,overall_score,created_at,duration_seconds,question_count"
            )
            .eq("owner_id", userId)
            .order("created_at", { ascending: false })
            .limit(100),
          c
            .from("performance_metrics")
            .select("session_id,metric_name,metric_value,category,created_at")
            .eq("owner_id", userId)
            .limit(1000),
        ]);
        if (!live) return;
        if (s.error) throw s.error;
        setSessions((s.data || []) as Session[]);
        setMetrics((m.data || []) as Metric[]);
      } catch {
        if (live)
          setError(
            "We couldn't load your interview history. Please try again."
          );
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [userId]);
  function choose(id: string) {
    setSelected(curr =>
      curr.includes(id)
        ? curr.filter(x => x !== id)
        : curr.length < 2
          ? [...curr, id]
          : [curr[1], id]
    );
  }
  function runCompare() {
    if (selected.length !== 2) return;
    const [a, b] = selected
      .map(id => sessions.find(s => s.id === id)!)
      .sort(
        (x, y) =>
          new Date(x.created_at).getTime() - new Date(y.created_at).getTime()
      );
    const names = Array.from(
      new Set(
        metrics
          .filter(m => selected.includes(m.session_id || ""))
          .map(m => m.metric_name)
      )
    );
    const dimensions = names.map(name => {
      const first = avg(
        metrics
          .filter(m => m.session_id === a.id && m.metric_name === name)
          .map(m => Number(m.metric_value))
      );
      const second = avg(
        metrics
          .filter(m => m.session_id === b.id && m.metric_name === name)
          .map(m => Number(m.metric_value))
      );
      return { name, before: first, after: second, delta: second - first };
    });
    setCompare({ a, b, dimensions });
  }
  if (loading) return <LoadingState text="Loading saved interview history…" />;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR PRACTICE RECORD"
        title="Every session leaves a useful signal."
        description="Review reports, repeat an interview or compare two completed sessions to see what actually changed."
        action={
          <Link href="/practice" className="button button-primary">
            Start practice <ArrowRight size={13} />
          </Link>
        }
      />
      {error && <div className="notice notice-warning">{error}</div>}
      {!sessions.length ? (
        <Panel>
          <EmptyState
            icon={Clock3}
            title="No interviews yet. Your first mock interview is one click away."
            description="Your session history and comparisons will appear here after you practice."
            action="Start a mock interview"
            href="/practice"
          />
        </Panel>
      ) : (
        <>
          <Panel
            title="Compare two sessions"
            subtitle="Choose any two completed sessions. Changes are calculated from their saved overall and dimension scores."
          >
            <div className="compare-picker">
              {sessions
                .filter(s => s.status === "completed")
                .map(s => (
                  <label
                    className={`compare-option ${selected.includes(s.id) ? "selected" : ""}`}
                    key={s.id}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={() => choose(s.id)}
                    />
                    <span>
                      <b>{s.target_role}</b>
                      <small>
                        {s.course} ·{" "}
                        {new Date(s.created_at).toLocaleDateString()} ·{" "}
                        {s.overall_score ?? "—"}%
                      </small>
                    </span>
                    <Tag>{s.interview_type}</Tag>
                  </label>
                ))}
            </div>
            <div className="compare-actions">
              <span className="muted-small">
                {selected.length} of 2 selected
              </span>
              <button
                className="button button-secondary"
                onClick={runCompare}
                disabled={selected.length !== 2}
              >
                <GitCompareArrows size={14} /> Compare selected
              </button>
            </div>
            {compare && (
              <div className="comparison-result">
                <div className="comparison-summary">
                  <div>
                    <span>EARLIER SESSION</span>
                    <b>{compare.a.overall_score ?? "—"}%</b>
                    <small>
                      {new Date(compare.a.created_at).toLocaleDateString()}
                    </small>
                  </div>
                  <div className="compare-arrow">
                    <ArrowRight />
                  </div>
                  <div>
                    <span>LATER SESSION</span>
                    <b>{compare.b.overall_score ?? "—"}%</b>
                    <small>
                      {new Date(compare.b.created_at).toLocaleDateString()}
                    </small>
                  </div>
                  <p>
                    {compare.b.overall_score > compare.a.overall_score
                      ? `Your overall score improved by ${compare.b.overall_score - compare.a.overall_score} points between these two sessions.`
                      : compare.b.overall_score < compare.a.overall_score
                        ? `Your overall score changed by ${compare.b.overall_score - compare.a.overall_score} points between these two sessions. Review the answer-level feedback for context.`
                        : "Your overall scores were unchanged between these two sessions."}
                  </p>
                </div>
                {compare.dimensions.length > 0 && (
                  <div className="compare-dimensions">
                    {compare.dimensions.map((d: any) => (
                      <div key={d.name}>
                        <span>{d.name}</span>
                        <b>
                          {d.before} → {d.after}
                        </b>
                        <strong
                          className={
                            d.delta > 0
                              ? "positive"
                              : d.delta < 0
                                ? "negative"
                                : "neutral"
                          }
                        >
                          {d.delta > 0 ? `+${d.delta}` : d.delta}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Panel>
          <Panel
            title="Interview history"
            subtitle={`${sessions.length} recent saved session${sessions.length === 1 ? "" : "s"} · ordered by date.`}
          >
            <div className="table-wrap">
              <table className="history-table history-full">
                <thead>
                  <tr>
                    <th>SESSION / DATE</th>
                    <th>COURSE</th>
                    <th>TYPE</th>
                    <th>LEVEL</th>
                    <th>DURATION</th>
                    <th>SCORE</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id}>
                      <td>
                        <b>{s.target_role}</b>
                        <br />
                        <span>{new Date(s.created_at).toLocaleString()}</span>
                      </td>
                      <td>{s.course}</td>
                      <td>
                        <Tag tone="cyan">{s.interview_type}</Tag>
                      </td>
                      <td>
                        <Tag
                          tone={
                            s.difficulty === "Hard" || s.difficulty === "Expert"
                              ? "amber"
                              : "default"
                          }
                        >
                          {s.difficulty}
                        </Tag>
                      </td>
                      <td>
                        {s.duration_seconds
                          ? `${Math.round(s.duration_seconds / 60)} min`
                          : "—"}
                      </td>
                      <td>
                        <b>
                          {s.status === "completed"
                            ? `${s.overall_score ?? 0}%`
                            : "In progress"}
                        </b>
                      </td>
                      <td>
                        <div className="history-actions">
                          <Link
                            href={
                              s.status === "completed"
                                ? `/report/${s.id}`
                                : `/practice/${s.id}`
                            }
                            className="text-link"
                          >
                            {s.status === "completed" ? "Report" : "Resume"}{" "}
                            <ArrowRight size={11} />
                          </Link>
                          <button
                            className="button button-ghost"
                            onClick={() => window.location.assign("/practice")}
                          >
                            Practice again
                          </button>
                          <label title="Select for comparison">
                            <input
                              type="checkbox"
                              checked={selected.includes(s.id)}
                              onChange={() => choose(s.id)}
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

export function BookmarksPage() {
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [tab, setTab] = useState("question");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        if (!userId) return;
        const c = await getSupabase();
        const { data, error: e } = await c
          .from("bookmarks")
          .select("*")
          .eq("owner_id", userId)
          .eq("target_type", tab)
          .order("created_at", { ascending: false })
          .limit(100);
        if (e) throw e;
        if (live) setRows(data || []);
      } catch {
        if (live) setError("We couldn't load your saved items.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [userId, tab]);
  async function remove(id: string) {
    const c = await getSupabase();
    const { error: e } = await c
      .from("bookmarks")
      .delete()
      .eq("id", id)
      .eq("owner_id", user!.id);
    if (e) setError("That saved item couldn't be removed. Try again.");
    else setRows(r => r.filter(x => x.id !== id));
  }
  const tabs = [
    { id: "question", label: "Questions" },
    { id: "report", label: "Reports" },
    { id: "study", label: "Study" },
    { id: "resource", label: "Resources" },
  ];
  const href = (row: any) =>
    row.target_type === "question"
      ? "/questions"
      : row.target_type === "report"
        ? `/report/${row.target_id}`
        : row.target_type === "study"
          ? "/study-plan"
          : "/questions";
  if (loading) return <LoadingState text="Loading your saved items…" />;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR PERSONAL COLLECTION"
        title="Keep the useful bits close."
        description="Saved questions, reports, study-plan steps and resources live here—only for your account."
      />
      <div className="bookmark-tabs">
        {tabs.map(t => (
          <button
            className={tab === t.id ? "active" : ""}
            key={t.id}
            onClick={() => setTab(t.id)}
          >
            <Bookmark size={14} />
            {t.label}
            <span>{tab === t.id ? rows.length : ""}</span>
          </button>
        ))}
      </div>
      {error && <div className="notice notice-error">{error}</div>}
      {!rows.length ? (
        <Panel>
          <EmptyState
            icon={Bookmark}
            title={`No saved ${tabs.find(x => x.id === tab)?.label.toLowerCase()} yet.`}
            description={
              tab === "question"
                ? "Bookmark any question you want to revisit in the Question Bank."
                : "Save a report or plan item when it gives you a useful next step."
            }
            action={
              tab === "question" ? "Explore questions" : "View your study plan"
            }
            href={tab === "question" ? "/questions" : "/study-plan"}
          />
        </Panel>
      ) : (
        <Panel title={`${tabs.find(x => x.id === tab)?.label} collection`}>
          <div className="bookmark-list">
            {rows.map(row => (
              <div className="bookmark-row" key={row.id}>
                <span className="bookmark-type-icon">
                  <Bookmark size={14} />
                </span>
                <div>
                  <b>{row.title}</b>
                  <small>
                    {row.detail ||
                      new Date(row.created_at).toLocaleDateString()}
                  </small>
                </div>
                <Link href={href(row)} className="text-link">
                  Open <ArrowRight size={12} />
                </Link>
                <button
                  className="icon-button"
                  onClick={() => void remove(row.id)}
                  aria-label="Remove saved item"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
