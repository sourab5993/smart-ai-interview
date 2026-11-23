import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  Activity,
  ArrowRight,
  AudioLines,
  BarChart3,
  Bookmark,
  BookOpen,
  Check,
  Clock3,
  GraduationCap,
  Lightbulb,
  Mic,
  MicOff,
  Orbit,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Target,
  TrendingUp,
  Video,
  Volume2,
} from "lucide-react";
import {
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
} from "recharts";
import { getSupabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import {
  courseGroups,
  disciplineFor,
  difficulties,
  interviewTypes,
  readinessLabel,
  roleOptions,
  skillCatalog,
  specializationsByCourse,
} from "@/data/taxonomy";
import { notifyUser, notifyWeeklyProgress } from "@/lib/notifications";
import { safeStorage } from "@/lib/safeStorage";
import {
  evaluationCriteriaFromContext,
  persistInterviewCompletion,
} from "@/lib/interview-completion";
import { completionAdjustedScore } from "@/lib/scoring";
import { isSilenceHallucination } from "@shared/scoring";
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

type Profile = {
  id: string;
  full_name: string;
  course: string;
  specialization: string;
  semester: string;
  target_career: string;
  target_role: string;
  experience_level: string;
  skills: string[];
  interests: string[];
  interview_preference: string;
  language: string;
  onboarding_complete: boolean;
};
type SessionRow = {
  id: string;
  owner_id: string;
  course: string;
  specialization: string;
  semester: string;
  context_notes: string;
  target_role: string;
  target_career: string;
  experience_level: string;
  skills: string[];
  interview_type: string;
  difficulty: string;
  language: string;
  question_count: number;
  duration_minutes: number;
  status: string;
  overall_score: number | null;
  created_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
};
type InterviewQuestion = {
  id: string;
  session_id: string;
  question_text: string;
  topic: string;
  difficulty: string;
  rationale: string;
  sort_order: number;
};
type Eval = {
  overall_score: number;
  communication_score?: number | null;
  dimensions: {
    name: string;
    score: number;
    note: string;
    evidence?: string;
    weight?: number;
    measure?: "answer-quality" | "communication";
  }[];
  strengths: string[];
  weaknesses: string[];
  missing_points: string[];
  better_answer: string;
  improvement_tip: string;
  source: "ai" | "baseline" | "unknown";
  modelVersion?: string;
  promptVersion?: string;
  rubricVersion?: string;
};
type AnswerRow = {
  id: string;
  question_id: string;
  answer_text: string;
  answer_mode: string;
  created_at: string;
};

export function Dashboard() {
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [metricRows, setMetricRows] = useState<any[]>([]);
  const [gapRows, setGapRows] = useState<any[]>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [answeredBySession, setAnsweredBySession] = useState<
    Record<string, number>
  >({});
  const [completedCount, setCompletedCount] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!userId) {
      setBusy(false);
      return;
    }
    let live = true;
    void (async () => {
      try {
        const s = await getSupabase();
        const [p, history, metrics, gaps, answers, completedTotal] =
          await Promise.all([
            s.from("profiles").select("*").eq("id", userId).maybeSingle(),
            s
              .from("interview_sessions")
              .select(
                "id,owner_id,course,specialization,target_role,target_career,experience_level,skills,interview_type,difficulty,language,question_count,duration_minutes,status,overall_score,created_at,completed_at,duration_seconds"
              )
              .eq("owner_id", userId)
              .order("created_at", { ascending: false })
              .limit(200),
            s
              .from("performance_metrics")
              .select("metric_name,metric_value,category,created_at")
              .eq("owner_id", userId)
              .order("created_at", { ascending: false })
              .limit(1000),
            s
              .from("skill_gaps")
              .select(
                "skill_name,current_score,required_score,priority,updated_at,course,target_role"
              )
              .eq("owner_id", userId)
              .limit(200),
            s
              .from("interview_answers")
              .select("session_id,answer_text")
              .eq("owner_id", userId),
            s
              .from("interview_sessions")
              .select("id", { count: "exact", head: true })
              .eq("owner_id", userId)
              .eq("status", "completed"),
          ]);
        if (!live) return;
        if (
          p.error ||
          history.error ||
          metrics.error ||
          gaps.error ||
          answers.error ||
          completedTotal.error
        )
          throw (
            p.error ||
            history.error ||
            metrics.error ||
            gaps.error ||
            answers.error ||
            completedTotal.error
          );
        if (p.data) setProfile(p.data as Profile);
        setSessions((history.data || []) as SessionRow[]);
        setMetricRows(metrics.data || []);
        const currentCourse = p.data?.course;
        const currentRole = p.data?.target_role;
        setGapRows(
          (gaps.data || []).filter(
            (row: any) =>
              (!currentCourse || row.course === currentCourse) &&
              (!currentRole || row.target_role === currentRole)
          )
        );
        const answeredRows = (answers.data || []).filter((row: any) =>
          String(row.answer_text || "").trim()
        );
        const counts = answeredRows.reduce(
          (map: Record<string, number>, row: any) => {
            map[row.session_id] = (map[row.session_id] || 0) + 1;
            return map;
          },
          {}
        );
        setAnsweredBySession(counts);
        setAnswerCount(answeredRows.length);
        setCompletedCount(completedTotal.count || 0);
      } catch {
        if (live)
          setError(
            "We couldn't load your saved practice right now. Your account and answers remain private."
          );
      } finally {
        if (live) setBusy(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [userId]);
  useEffect(() => {
    if (userId) void notifyWeeklyProgress(userId);
  }, [userId]);
  const completed = sessions.filter(
    s => s.status === "completed" && s.overall_score !== null
  );
  const scoreForSession = (session: SessionRow): number | null => {
    if (session.overall_score === null || session.overall_score === undefined) return null;
    const num = Number(session.overall_score);
    return Number.isFinite(num) && num >= 0 && num <= 100 ? Math.round(num) : null;
  };
  const scoredSessions = completed
    .map(s => scoreForSession(s))
    .filter((score): score is number => score !== null);
  const avg = scoredSessions.length
    ? Math.round(
        scoredSessions.reduce((a, s) => a + s, 0) / scoredSessions.length
      )
    : null;
  const best = scoredSessions.length
    ? scoredSessions.reduce((max, s) => Math.max(max, s), 0)
    : null;
  const name =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "there";
  const hour = new Date().getHours();
  const greet =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const course = profile?.course || "Your course";
  const role = profile?.target_role || "your next role";
  const days = new Set(
    completed.map(s => new Date(s.created_at).toLocaleDateString("en-CA"))
  );
  let streak = 0;
  const cursor = new Date();
  if (!days.has(cursor.toLocaleDateString("en-CA")))
    cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toLocaleDateString("en-CA"))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const metricMap = new Map<string, number[]>();
  for (const row of metricRows) {
    const values = metricMap.get(row.metric_name) || [];
    values.push(Number(row.metric_value));
    metricMap.set(row.metric_name, values);
  }
  const signals = gapRows.length
    ? gapRows
        .slice()
        .sort(
          (a, b) =>
            (a.priority === "High" ? 0 : a.priority === "Medium" ? 1 : 2) -
              (b.priority === "High" ? 0 : b.priority === "Medium" ? 1 : 2) ||
            Number(a.current_score) - Number(b.current_score)
        )
        .slice(0, 6)
        .map(row => ({
          name: row.skill_name,
          score: Number(row.current_score),
          required: Number(row.required_score),
          priority: row.priority,
        }))
    : Array.from(metricMap.entries())
        .slice(0, 6)
        .map(([name, values]) => ({
          name,
          score: Math.round(
            values.reduce((sum, value) => sum + value, 0) / values.length
          ),
          required: null,
          priority: "Practice",
        }));
  if (busy) return <LoadingState text="Gathering your practice history…" />;
  return (
    <div className="page-stack">
      <div className="dashboard-welcome">
        <div>
          <span className="eyebrow">
            <span className="tiny-orb" /> YOUR PRACTICE SPACE
          </span>
          <h1>
            {greet}, {name}.
          </h1>
          <p>Ready to improve your interview performance?</p>
        </div>
        <div className="welcome-path">
          <GraduationCap size={15} />
          <span>
            {profile?.onboarding_complete
              ? `${course} → ${role}`
              : "Build a profile for course-aware practice"}
          </span>
          <Link
            href={profile?.onboarding_complete ? "/settings" : "/onboarding"}
          >
            {profile?.onboarding_complete ? "Edit" : "Set up"}
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
      {error && <div className="notice notice-warning">{error}</div>}
      {!profile?.onboarding_complete && (
        <div className="onboard-nudge">
          <span>
            <Sparkles size={17} />
          </span>
          <div>
            <b>Make practice more personal.</b>
            <small>
              Add your course, specialization and target role so the coach can
              ask questions from your field.
            </small>
          </div>
          <Link className="button button-secondary" href="/onboarding">
            Build my profile <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <section className="dashboard-hero">
        <div className="readiness-card">
          <div className="readiness-summary">
            <span className="eyebrow">
              <Orbit size={13} /> YOUR INTERVIEW READINESS
            </span>
            <h2>
              {avg !== null
                ? readinessLabel(avg)
                : "A baseline begins here"}
            </h2>
            <p>
              {completed.length
                ? "A transparent summary of your recent completed sessions—not a hiring prediction."
                : "Complete your first mock interview to build a meaningful readiness signal."}
            </p>
            <Link className="button button-primary" href="/practice">
              Start practice <ArrowRight size={14} />
            </Link>
          </div>
          <div className="readiness-ring">
            <ScoreRing
              score={avg}
              size={122}
              label={completed.length ? "readiness" : "to begin"}
            />
          </div>
        </div>
        <div className="stat-grid">
          <StatTile
            icon={Activity}
            label="Interviews completed"
            value={completedCount}
            tone="cyan"
          />
          <StatTile
            icon={BarChart3}
            label="Recent average"
            value={avg !== null ? `${avg}%` : "—"}
            tone="violet"
          />
          <StatTile
            icon={TrendingUp}
            label="Best recent score"
            value={best !== null ? `${best}%` : "—"}
            tone="green"
          />
          <StatTile
            icon={BookOpen}
            label="Answers submitted"
            value={answerCount}
            tone="blue"
          />
          <StatTile
            icon={Clock3}
            label="Practice streak"
            value={streak}
            change="consecutive days"
            tone="amber"
          />
        </div>
      </section>
      <section className="dashboard-bottom">
        <Panel
          title="Your signal over time"
          subtitle="Scores from completed interviews. Practice records stay private to your account."
          action={
            <Link className="text-link" href="/performance">
              View performance <ArrowRight size={13} />
            </Link>
          }
        >
          {completed.length ? (
            <>
              <div className="sparkline-wrap">
                <div className="chart-y-mini">
                  <span>100</span>
                  <span>50</span>
                  <span>0</span>
                </div>
                <svg
                  className="trend-spark"
                  viewBox="0 0 600 140"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Your interview score trend"
                >
                  <defs>
                    <linearGradient id="dash-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#5fdcf5" stopOpacity=".2" />
                      <stop offset="1" stopColor="#5fdcf5" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={sparkArea(
                      completed
                        .slice()
                        .reverse()
                        .map(s => scoreForSession(s) ?? 0)
                    )}
                    fill="url(#dash-fill)"
                  />
                  <path
                    d={sparkPath(
                      completed
                        .slice()
                        .reverse()
                        .map(s => scoreForSession(s) ?? 0)
                    )}
                    fill="none"
                    stroke="#67dff6"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
              <div className="chart-caption">
                <span>OLDEST</span>
                <span>
                  {completed.length} saved session
                  {completed.length === 1 ? "" : "s"}
                </span>
                <span>MOST RECENT</span>
              </div>
            </>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="Your first data point is waiting."
              description="Finish a practice interview to see how your answers develop over time."
              action="Start a mock interview"
              href="/practice"
            />
          )}
        </Panel>
        <Panel
          title="A good next step"
          subtitle="Small, focused practice goes a long way."
        >
          <div className="quick-list">
            <Link href="/practice" className="quick-item">
              <span>
                <Mic size={15} />
              </span>
              <div>
                <b>Practice a course-aware interview</b>
                <small>
                  {profile?.target_role || "Choose a role"} · voice or text
                </small>
              </div>
              <ArrowRight />
            </Link>
            <Link href="/questions" className="quick-item">
              <span>
                <BookOpen size={15} />
              </span>
              <div>
                <b>Explore your question bank</b>
                <small>Find a question worth thinking through</small>
              </div>
              <ArrowRight />
            </Link>
            <Link href="/resume" className="quick-item">
              <span>
                <Target size={15} />
              </span>
              <div>
                <b>Check your resume against a role</b>
                <small>Get a clearer sense of the match</small>
              </div>
              <ArrowRight />
            </Link>
          </div>
        </Panel>
      </section>
      <Panel
        title="Signals to build"
        subtitle="Saved skill-gap targets and evaluated dimensions from your own practice."
        action={<Tag tone="cyan">{profile?.course || "All disciplines"}</Tag>}
      >
        {signals.length ? (
          <div className="skill-signal-grid">
            {signals.map(d => (
              <div key={d.name} className="skill-row">
                <span>
                  {d.name}
                  {d.priority === "High" && <small> · priority</small>}
                </span>
                <ProgressBar
                  value={d.score}
                  color={d.priority === "High" ? "amber" : "cyan"}
                />
                <b>
                  {d.score}%
                  {d.required !== null && <small> / {d.required}</small>}
                </b>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Target}
            title="Your first course-aware signal is waiting."
            description="Finish a practice interview to save evaluated skills and role targets here."
            action="Start a mock interview"
            href="/practice"
          />
        )}
        <p className="baseline-note">
          Skill targets are learning benchmarks. Current scores use saved
          practice evidence and may be proxies—not a direct skills examination.
          Readiness is not hiring probability.
        </p>
      </Panel>
      {completed.length > 0 && (
        <Panel
          title="Recent interviews"
          action={
            <Link href="/history" className="text-link">
              View history <ArrowRight size={13} />
            </Link>
          }
        >
          <div className="table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>ROLE / COURSE</th>
                  <th>TYPE</th>
                  <th>DATE</th>
                  <th>SCORE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {completed.slice(0, 5).map(s => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.target_role}</b>
                      <br />
                      <span>{s.course}</span>
                    </td>
                    <td>
                      <Tag>{s.interview_type}</Tag>
                    </td>
                    <td>{new Date(s.created_at).toLocaleDateString()}</td>
                    <td>
                      <b>{scoreForSession(s)}%</b>
                    </td>
                    <td>
                      <Link href={`/report/${s.id}`} className="text-link">
                        Report <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
function sparkPath(values: number[]) {
  const data = values.length ? values : [0];
  const points = data.map((v, i) => {
    const x = data.length === 1 ? 300 : (i * 600) / (data.length - 1);
    const y = 125 - v * 1.08;
    return `${i ? "L" : "M"}${x} ${y}`;
  });
  return points.join(" ");
}
function sparkArea(values: number[]) {
  return `${sparkPath(values)} L600 140 L0 140 Z`;
}

export function PracticeSetup() {
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courseRows, setCourseRows] = useState<any[]>([]);
  const [specializationRows, setSpecializationRows] = useState<any[]>([]);
  const [careerRows, setCareerRows] = useState<any[]>([]);
  const [roleRows, setRoleRows] = useState<any[]>([]);
  const [typeRows, setTypeRows] = useState<any[]>([]);
  const [difficultyRows, setDifficultyRows] = useState<any[]>([]);
  const [criterionRows, setCriterionRows] = useState<any[]>([]);
  const [resumeEvidence, setResumeEvidence] = useState<any>(null);
  const [jobEvidence, setJobEvidence] = useState<any>(null);
  const [priorMetrics, setPriorMetrics] = useState<any[]>([]);
  const [course, setCourse] = useState("");
  const [customCourse, setCustomCourse] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [semester, setSemester] = useState("");
  const [career, setCareer] = useState("");
  const [role, setRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [experience, setExperience] = useState("Student");
  const [type, setType] = useState("Mixed");
  const [difficulty, setDifficulty] = useState("Medium");
  const [count, setCount] = useState(5);
  const [duration, setDuration] = useState(20);
  const [language, setLanguage] = useState("English");
  const [focusSkills, setFocusSkills] = useState("");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const startMutation = trpc.ai.generateQuestions.useMutation();
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void (async () => {
      try {
        const c = await getSupabase();
        const [
          p,
          courses,
          specs,
          careers,
          roles,
          types,
          difficultiesData,
          criteria,
          resume,
          match,
          metrics,
        ] = await Promise.all([
          c.from("profiles").select("*").eq("id", userId).maybeSingle(),
          c
            .from("courses")
            .select("id,name,category_id")
            .eq("active", true)
            .order("name")
            .limit(500),
          c
            .from("specializations")
            .select("name,course_id")
            .eq("active", true)
            .limit(1000),
          c
            .from("careers")
            .select("id,name,course_category_id")
            .eq("active", true)
            .order("name")
            .limit(500),
          c
            .from("job_roles")
            .select("id,name,career_id,category,interview_types")
            .eq("active", true)
            .order("name")
            .limit(500),
          c
            .from("interview_types")
            .select("name")
            .eq("active", true)
            .order("sort_order")
            .limit(100),
          c
            .from("difficulty_levels")
            .select("name")
            .eq("active", true)
            .order("sort_order")
            .limit(20),
          c
            .from("evaluation_criteria")
            .select(
              "scope_type,scope_name,interview_type,name,description,weight"
            )
            .eq("active", true)
            .order("sort_order")
            .limit(200),
          c
            .from("resume_analysis")
            .select("result")
            .eq("owner_id", userId)
            .order("created_at", { ascending: false })
            .limit(1),
          c
            .from("job_matches")
            .select("result")
            .eq("owner_id", userId)
            .order("created_at", { ascending: false })
            .limit(1),
          c
            .from("performance_metrics")
            .select("metric_name,metric_value,category,created_at")
            .eq("owner_id", userId)
            .order("created_at", { ascending: false })
            .limit(30),
        ]);
        if (!live) return;
        if (p.error) throw p.error;
        const value = p.data as Profile | null;
        setProfile(value);
        setCourseRows(courses.data || []);
        setSpecializationRows(specs.data || []);
        setCareerRows(careers.data || []);
        setRoleRows(roles.data || []);
        setTypeRows(types.data || []);
        setDifficultyRows(difficultiesData.data || []);
        setCriterionRows(criteria.data || []);
        setResumeEvidence(resume.data?.[0]?.result || null);
        setJobEvidence(match.data?.[0]?.result || null);
        setPriorMetrics(metrics.data || []);
        if (value) {
          const known = [
            ...courseGroups.flatMap(g => g.courses),
            ...(courses.data || []).map((x: any) => x.name),
          ];
          if (
            value.course &&
            !known.some(x => x.toLowerCase() === value.course.toLowerCase())
          ) {
            setCourse("Other / Custom Course");
            setCustomCourse(value.course);
          } else setCourse(value.course || "");
          setSpecialization(value.specialization || "");
          setSemester(value.semester || "");
          setCareer(value.target_career || "");
          setRole(value.target_role || "");
          setExperience(value.experience_level || "Student");
          setType(value.interview_preference || "Mixed");
          setLanguage(value.language || "English");
          setFocusSkills((value.skills || []).join(", "));
        }
        const qp = new URLSearchParams(window.location.search).get("role");
        if (qp) setRole(qp);
      } catch {
        /* The form remains usable with local catalogs if optional queries are unavailable. */
      }
    })();
    return () => {
      live = false;
    };
  }, [userId]);
  const catalogCourses = useMemo(
    () =>
      Array.from(
        new Set([
          ...courseGroups.flatMap(g => g.courses),
          ...courseRows.map(x => x.name),
          ...(profile?.course ? [profile.course] : []),
        ])
      ),
    [courseRows, profile?.course]
  );
  const selectedCourse =
    course === "Other / Custom Course"
      ? customCourse.trim() || "Other / Custom Course"
      : course;
  const courseRecord = courseRows.find(x => x.name === selectedCourse);
  const specializations = Array.from(
    new Set([
      ...specializationRows
        .filter(x => x.course_id === courseRecord?.id)
        .map(x => x.name),
      ...(specializationsByCourse[selectedCourse] || []),
      ...(specializationsByCourse[course] || []),
      ...(specialization ? [specialization] : []),
    ])
  );
  const roleOptionsDynamic = Array.from(
    new Set([
      ...roleRows.map(x => x.name),
      ...roleOptions,
      ...(role ? [role] : []),
    ])
  );
  const careersDynamic = Array.from(
    new Set([...careerRows.map(x => x.name), ...(career ? [career] : [])])
  );
  const typeOptions = Array.from(
    new Set([
      ...typeRows.map(x => x.name),
      ...interviewTypes,
      ...(type ? [type] : []),
    ])
  );
  const difficultyOptions = Array.from(
    new Set([
      ...difficultyRows.map(x => x.name),
      ...difficulties,
      ...(difficulty ? [difficulty] : []),
    ])
  );
  const skillOptions = useMemo(
    () =>
      Array.from(new Set([...(profile?.skills || []), ...skillCatalog])).slice(
        0,
        60
      ),
    [profile?.skills]
  );
  const pickedSkills = focusSkills
    .split(",")
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 30);
  const discipline = disciplineFor(`${selectedCourse} ${specialization}`);
  const roleText =
    (role === "Other / custom role" ? customRole.trim() : role) || role;
  const suggestedType =
    /financial|account|audit|tax|pharmac|legal|nurse|research|teacher|design|agricultur|engineering/i.test(
      `${roleText} ${selectedCourse} ${specialization}`
    )
      ? "Domain"
      : discipline === "management"
        ? "Case Study"
        : discipline === "medical"
          ? "Domain"
          : discipline === "law"
            ? "Case Study"
            : discipline === "arts"
              ? "Communication"
              : "Technical";
  function scopedCriteria() {
    const familyNames: Record<string, string> = {
      engineering: "Engineering & Technology",
      mechanical: "Engineering & Technology",
      civil: "Engineering & Technology",
      electrical: "Engineering & Technology",
      chemical: "Engineering & Technology",
      technology: "Engineering & Technology",
      commerce: "Commerce",
      management: "Management & Business",
      medical: "Medical & Healthcare",
      pharmacy: "Medical & Healthcare",
      law: "Law",
      arts: "Arts & Humanities",
      science: "Science",
      design: "Design & Creative",
      education: "Education",
      agriculture: "Agriculture",
      hospitality: "Hospitality & Tourism",
      default: "Other / Custom",
    };
    const scopes = [
      specialization,
      selectedCourse,
      familyNames[discipline] || "",
    ].map(x => x.toLowerCase());
    const global = criterionRows
      .filter(x => x.scope_type === "global")
      .slice(0, 3);
    const typeSpecific = criterionRows
      .filter(
        x =>
          x.scope_type === "interview_type" &&
          String(x.interview_type || x.scope_name).toLowerCase() ===
            type.toLowerCase()
      )
      .slice(0, 2);
    const courseSpecific = criterionRows
      .filter(
        x =>
          x.scope_type === "course" &&
          scopes.some(scope => {
            const name = String(x.scope_name).toLowerCase();
            return (
              scope &&
              (scope === name || scope.includes(name) || name.includes(scope))
            );
          })
      )
      .slice(0, 4);
    const roleSpecific = criterionRows
      .filter(
        x =>
          x.scope_type === "role" &&
          String(x.scope_name).toLowerCase() === roleText.toLowerCase()
      )
      .slice(0, 4);
    const unique = new Map<string, any>();
    for (const row of [
      ...global,
      ...typeSpecific,
      ...courseSpecific,
      ...roleSpecific,
    ])
      if (!unique.has(String(row.name).toLowerCase()))
        unique.set(String(row.name).toLowerCase(), {
          name: row.name,
          description: row.description || "",
          weight: Number(row.weight) || 1,
        });
    return Array.from(unique.values()).slice(0, 12);
  }
  async function start() {
    if (!user || !selectedCourse || !roleText) {
      setError(
        "Choose your course and target role to build a personalized session."
      );
      return;
    }
    if (course === "Other / Custom Course" && !customCourse.trim()) {
      setError(
        "Enter your course or specialization so the coach can stay relevant."
      );
      return;
    }
    if (role === "Other / custom role" && !customRole.trim()) {
      setError("Enter the target job role you want to practice for.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const rubric = scopedCriteria();
      const contextData = {
        learner: {
          specialization,
          semester,
          experience,
          targetCareer: career || profile?.target_career || "",
          profileSkills: pickedSkills,
          interests: profile?.interests || [],
        },
        resumeEvidence: resumeEvidence
          ? {
              skills: (resumeEvidence.skills || []).slice(0, 12),
              projects: (resumeEvidence.projects || [])
                .slice(0, 2)
                .map((x: string) => x.slice(0, 250)),
              experience: (resumeEvidence.experience || [])
                .slice(0, 2)
                .map((x: string) => x.slice(0, 250)),
              strengths: (resumeEvidence.strengths || []).slice(0, 3),
            }
          : null,
        jobMatchEvidence: jobEvidence
          ? {
              matchingSkills: (jobEvidence.matching_skills || []).slice(0, 8),
              missingSkills: (jobEvidence.missing_skills || []).slice(0, 8),
              preparationTopics: (jobEvidence.preparation_topics || []).slice(
                0,
                8
              ),
            }
          : null,
        priorDimensionScores: priorMetrics
          .slice(0, 12)
          .map(x => ({ dimension: x.metric_name, score: x.metric_value })),
        evaluationCriteria: rubric.map(x => ({
          name: x.name,
          description: x.description.slice(0, 120),
          weight: x.weight,
        })),
        learnerNotes: extra.slice(0, 500),
      };
      let context = JSON.stringify(contextData);
      if (context.length > 2900) {
        contextData.resumeEvidence = null;
        contextData.jobMatchEvidence = null;
        contextData.priorDimensionScores =
          contextData.priorDimensionScores.slice(0, 6);
        contextData.learnerNotes = extra.slice(0, 200);
        context = JSON.stringify(contextData);
      }
      const generated = await startMutation.mutateAsync({
        course: selectedCourse,
        specialization,
        semester,
        role: roleText,
        type,
        difficulty,
        skills: pickedSkills,
        count,
        language: language as "English" | "Hindi" | "Hinglish",
        context,
      });
      const generatedQuestions = ((Array.isArray(generated)
        ? generated
        : (generated as any).questions) || []) as {
        question: string;
        topic: string;
        difficulty: string;
        rationale: string;
      }[];
      if (!generatedQuestions.length) throw new Error("No questions returned");
      const client = await getSupabase();
      const { data: created, error: sessionError } = await client
        .from("interview_sessions")
        .insert({
          owner_id: user.id,
          course: selectedCourse,
          specialization,
          semester,
          target_career: career || profile?.target_career || "",
          target_role: roleText,
          experience_level: experience,
          skills: pickedSkills,
          context_notes: JSON.stringify({
            learnerNotes: extra.slice(0, 1000),
            evaluationCriteria: rubric,
          }),
          interview_type: type,
          difficulty,
          language,
          question_count: generatedQuestions.length,
          duration_minutes: duration,
          status: "in_progress",
        })
        .select("id")
        .single();
      if (sessionError || !created) throw sessionError || new Error("session");
      const rows = generatedQuestions.slice(0, count).map((q, i) => ({
        owner_id: user.id,
        session_id: created.id,
        question_text: q.question,
        topic: q.topic,
        difficulty: q.difficulty || difficulty,
        rationale: q.rationale,
        sort_order: i,
      }));
      const { error: qError } = await client
        .from("interview_questions")
        .insert(rows);
      if (qError) {
        await client
          .from("interview_sessions")
          .delete()
          .eq("id", created.id)
          .eq("owner_id", user.id);
        throw qError;
      }
      void notifyUser(
        user.id,
        "practice",
        "Your practice session is ready",
        `${type} interview · ${selectedCourse} · ${"source" in generated && generated.source === "ai" ? "Personalized by AI" : "Course-specific question bank fallback"}`
      );
      navigate(`/practice/${created.id}`);
    } catch {
      setError(
        "Something went wrong while generating your interview. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="PRACTICE, WITH PURPOSE"
        title="Set up your interview"
        description="Your course, target role, optional resume/JD evidence and past practice shape a session that belongs to your path."
      />
      <Link className="behavioral-launch-card" href="/live-interview">
        <span className="behavioral-launch-icon">
          <Mic size={22} />
        </span>
        <span>
          <b>Live Interview</b>
          <small>
            Role-aware spoken interview with adaptive follow-ups and a saved
            report. Choose only a target role and duration.
          </small>
        </span>
        <ArrowRight size={17} />
      </Link>
      <Link className="behavioral-launch-card" href="/behavioral-interview">
        <span className="behavioral-launch-icon">
          <Video size={22} />
        </span>
        <span>
          <b>Behavioral Interview Analysis</b>
          <small>
            Practise speaking your answers while analysing your observable
            interview behavior.
          </small>
        </span>
        <ArrowRight size={17} />
      </Link>
      <div className="setup-grid">
        <Panel
          title="Shape this practice session"
          subtitle="Course, role and stage keep your questions relevant."
        >
          <div className="setup-form">
            <label>
              Course / degree
              <select
                className="field"
                value={course}
                onChange={e => {
                  setCourse(e.target.value);
                  setSpecialization("");
                }}
              >
                <option value="">Select course</option>
                {catalogCourses.map((x: string) => (
                  <option key={x}>{x}</option>
                ))}
                <option>Other / Custom Course</option>
              </select>
            </label>
            {course === "Other / Custom Course" && (
              <label>
                Enter your course
                <input
                  className="field"
                  value={customCourse}
                  maxLength={120}
                  onChange={e => setCustomCourse(e.target.value)}
                  placeholder="Course name / qualification"
                />
              </label>
            )}
            <label>
              Specialization
              {specializations.length ? (
                <select
                  className="field"
                  value={specialization}
                  onChange={e => setSpecialization(e.target.value)}
                >
                  <option value="">Select or enter below</option>
                  {specializations.map((x: string) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              ) : null}
              <input
                className="field"
                value={specialization}
                maxLength={160}
                onChange={e => setSpecialization(e.target.value)}
                placeholder="e.g. Accounting & Finance"
              />
            </label>
            <label>
              Year / semester
              <input
                className="field"
                value={semester}
                maxLength={80}
                onChange={e => setSemester(e.target.value)}
                placeholder="e.g. Final year / Semester 8"
              />
            </label>
            <label>
              Target career
              <select
                className="field"
                value={career}
                onChange={e => setCareer(e.target.value)}
              >
                <option value="">Use my profile preference</option>
                {careersDynamic.map((x: string) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Target role
              <select
                className="field"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                <option value="">Select a role</option>
                {roleOptionsDynamic.map((x: string) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            {role === "Other / custom role" && (
              <label>
                Enter your target role
                <input
                  className="field"
                  value={customRole}
                  maxLength={160}
                  onChange={e => setCustomRole(e.target.value)}
                  placeholder="e.g. Community Health Officer"
                />
              </label>
            )}
            <label>
              Experience level
              <select
                className="field"
                value={experience}
                onChange={e => setExperience(e.target.value)}
              >
                {Array.from(
                  new Set([
                    "Student",
                    "Recent graduate",
                    "Entry level",
                    "1–2 years",
                    "3–5 years",
                    "Experienced",
                    experience,
                  ])
                ).map(x => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Interview type
              <select
                className="field"
                value={type}
                onChange={e => setType(e.target.value)}
              >
                {typeOptions.map(x => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <button
                type="button"
                className="text-link rubric-recommend"
                onClick={() => setType(suggestedType)}
              >
                Use recommendation: {suggestedType}
              </button>
            </label>
            <label>
              Difficulty
              <select
                className="field"
                value={difficulty}
                onChange={e => setDifficulty(e.target.value)}
              >
                {difficultyOptions.map(x => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Questions
              <select
                className="field"
                value={count}
                onChange={e => setCount(Number(e.target.value))}
              >
                {[3, 5, 7, 10].map(x => (
                  <option key={x} value={x}>
                    {x} questions
                  </option>
                ))}
              </select>
            </label>
            <label>
              Duration
              <select
                className="field"
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
              >
                {[10, 15, 20, 30, 45].map(x => (
                  <option key={x} value={x}>
                    {x} minutes
                  </option>
                ))}
              </select>
            </label>
            <label>
              Language
              <select
                className="field"
                value={language}
                onChange={e => setLanguage(e.target.value)}
              >
                {["English", "Hindi", "Hinglish"].map(x => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="full">
              Skills to focus
              <input
                className="field"
                value={focusSkills}
                onChange={e => setFocusSkills(e.target.value)}
                maxLength={900}
                placeholder="Select below or add skills separated by commas"
              />
              {skillOptions.length > 0 && (
                <span className="setup-skill-pills">
                  {skillOptions.slice(0, 18).map((skill: string) => (
                    <button
                      type="button"
                      key={skill}
                      className={`skill-pill ${pickedSkills.some(x => x.toLowerCase() === skill.toLowerCase()) ? "selected" : ""}`}
                      onClick={() =>
                        setFocusSkills(
                          pickedSkills.some(
                            x => x.toLowerCase() === skill.toLowerCase()
                          )
                            ? pickedSkills
                                .filter(
                                  x => x.toLowerCase() !== skill.toLowerCase()
                                )
                                .join(", ")
                            : [...pickedSkills, skill].slice(0, 30).join(", ")
                        )
                      }
                    >
                      {skill}
                    </button>
                  ))}
                </span>
              )}
            </label>
            <label className="full">
              Additional interview context
              <textarea
                className="field"
                rows={3}
                maxLength={1000}
                value={extra}
                onChange={e => setExtra(e.target.value)}
                placeholder="Add a project, experience or topic you'd like to discuss."
              />
            </label>
            <div className="full">
              {error && (
                <div className="notice notice-error" role="alert">
                  {error}
                </div>
              )}
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => void start()}
              >
                {busy ? (
                  <>
                    <span className="spinner" /> Building your questions…
                  </>
                ) : (
                  <>
                    Start interview <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        </Panel>
        <aside className="setup-summary">
          <span className="eyebrow">
            <Sparkles size={13} /> COURSE-AWARE COACH
          </span>
          <h3>Your path, not a template.</h3>
          <p>
            The coach can use your course, stage, resume/JD signals, configured
            evaluation criteria and previous answers. Prior context is sent only
            with your authenticated request.
          </p>
          <ul>
            <li>
              <Check />
              Course context:{" "}
              {selectedCourse || profile?.course || "choose your course"}
            </li>
            <li>
              <Check />
              Recommended type: {suggestedType}
            </li>
            <li>
              <Check />
              Voice input when your browser supports it
            </li>
            <li>
              <Check />
              Text mode always available
            </li>
          <li>
            <Check />
            {scopedCriteria().length
              ? `${scopedCriteria().length} configured evaluation criteria`
              : `Course-specific evaluation rubric`}
          </li>
          </ul>
          <div className="notice notice-warning">
            Practice feedback supports learning, not diagnosis, hiring decisions
            or outcome predictions.
          </div>
        </aside>
      </div>
    </div>
  );
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

export function InterviewRoom() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [, navigate] = useLocation();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, Eval>>({});
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const textRef = useRef("");
  textRef.current = text;
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [latestEval, setLatestEval] = useState<Eval | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const recognition = useRef<any>(null);
  const startTime = useRef<number>(Date.now());
  const [recordElapsed, setRecordElapsed] = useState(0);
  const [adaptiveNote, setAdaptiveNote] = useState("");
  const recordingStarted = useRef<number>(0);
  const finalizing = useRef(false);
  const expiryHandled = useRef(false);
  const evaluate = trpc.ai.evaluateAnswer.useMutation();
  const analyze = trpc.ai.analyzeInterview.useMutation();
  const adapt = trpc.ai.generateQuestions.useMutation();
  const transcribe = trpc.voice.transcribeStoredAudio.useMutation();
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const submittingRef = useRef(false);
  const interimRef = useRef("");
  const voiceRestartTimer = useRef<any>(null);
  const stopVoiceRef = useRef<() => void>(() => {});
  const [transcribing, setTranscribing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [micVolume, setMicVolume] = useState(0);
  const speechRecognitionTextRef = useRef("");
  const recordingSessionIdRef = useRef(0);
  const initialTextRef = useRef("");
  const userEditedDuringRecordingRef = useRef(false);
  const speechSessionFinalsRef = useRef<string[]>([]);
  const speechSessionInterimRef = useRef("");
  const finish = useCallback(async () => {
    if (!session || !userId || finalizing.current) return;
    finalizing.current = true;
    setSending(true);
    setError("");
    try {
      const c = await getSupabase();
      if (session.status === "completed") {
        navigate(`/report/${session.id}`);
        return;
      }
      try {
        await persistInterviewCompletion({
          client: c,
          ownerId: userId,
          session,
          questions,
          answers,
          evaluations,
          summarize: payload => analyze.mutateAsync(payload),
        });
        navigate(`/report/${session.id}`);
      } catch (completionErr) {
        const { data: refreshed } = await c
          .from("interview_sessions")
          .select("status")
          .eq("id", session.id)
          .eq("owner_id", userId)
          .maybeSingle();
        if (refreshed?.status === "completed") {
          navigate(`/report/${session.id}`);
          return;
        }
        throw completionErr;
      }
    } catch {
      setError(
        "We couldn't finish the report just yet. Your submitted answers are safe—please retry to complete the same interview."
      );
    } finally {
      finalizing.current = false;
      setSending(false);
    }
  }, [analyze, answers, evaluations, navigate, questions, session, userId]);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void (async () => {
      try {
        const c = await getSupabase();
        const { sdata, qdata, adata } = await fetchSession(c, id, userId);
        if (!live) return;
        if (!sdata) throw new Error();
        setSession(sdata);
        setQuestions(qdata);
        setAnswers(adata);
        startTime.current = new Date(sdata.created_at).getTime();
        const evalRows = await c
          .from("answer_evaluations")
          .select("*,interview_answers!inner(question_id)")
          .eq("owner_id", userId)
          .eq("interview_answers.session_id", id);
        if (evalRows.data) {
          const mapped: Record<string, Eval> = {};
          for (const e of evalRows.data as any[]) {
            const qid = e.interview_answers?.question_id;
            if (qid)
              mapped[qid] = {
                overall_score: e.overall_score,
                dimensions: e.dimensions || [],
                strengths: e.strengths || [],
                weaknesses: e.weaknesses || [],
                missing_points: e.missing_points || [],
                better_answer: e.better_answer || "",
                improvement_tip: e.improvement_tip || "",
                source: e.source || "ai",
                modelVersion: e.model_version || undefined,
                promptVersion: e.prompt_version || undefined,
                rubricVersion: e.rubric_version || undefined,
              };
          }
          setEvaluations(mapped);
        }
        const first = qdata.findIndex(
          q => !adata.some(a => a.question_id === q.id)
        );
        setIndex(first < 0 ? qdata.length : first);
      } catch {
        if (live)
          setError(
            "We couldn't open this interview. It may have expired or may not belong to your account."
          );
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
      if (voiceRestartTimer.current) clearTimeout(voiceRestartTimer.current);
      recognition.current?.stop?.();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          void audioContextRef.current.close();
        } catch {}
        audioContextRef.current = null;
      }
      const stream = audioStream.current;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        audioStream.current = null;
      }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [id, userId]);
  useEffect(() => {
    if (!session || session.status !== "in_progress") return;
    const timer = window.setInterval(
      () =>
        setElapsed(
          Math.max(0, Math.floor((Date.now() - startTime.current) / 1000))
        ),
      1000
    );
    return () => window.clearInterval(timer);
  }, [session]);
  useEffect(() => {
    if (!session || session.status !== "in_progress") return;
    const allocatedSeconds = Math.max(1, session.duration_minutes || 20) * 60;
    if (elapsed < allocatedSeconds || expiryHandled.current || sending) return;
    expiryHandled.current = true;
    recognition.current?.stop?.();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setText("");
    setIndex(questions.length);
    setLatestEval(null);
    void finish();
  }, [elapsed, session, sending, questions.length, finish]);
  useEffect(() => {
    if (!recording) return;
    const checkLimit = () => {
      if (Date.now() - recordingStarted.current >= 180_000) {
        stopVoiceRef.current();
      }
    };
    const timer = window.setInterval(() => {
      setRecordElapsed(
        Math.max(0, Math.floor((Date.now() - recordingStarted.current) / 1000))
      );
      checkLimit();
    }, 1000);
    const handleVis = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        checkLimit();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVis);
    }
    return () => {
      window.clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVis);
      }
    };
  }, [recording]);
  const current = questions[index];

  useEffect(() => {
    if (!session?.id || !current?.id) return;
    const userScope = user?.id
      ? `practice_draft_${user.id}_${session.id}_${current.id}`
      : "";
    const key = `practice_draft_${session.id}_${current.id}`;
    if (text.trim()) {
      if (userScope) safeStorage.setItem(userScope, text);
      safeStorage.setItem(key, text);
    }
  }, [text, session?.id, current?.id, user?.id]);

  useEffect(() => {
    if (isRecordingRef.current) {
      void stopVoiceRef.current?.();
    }
    interimRef.current = "";
    setInterim("");
    audioChunks.current = [];

    if (!session?.id || !current?.id) return;
    const userScope = user?.id
      ? `practice_draft_${user.id}_${session.id}_${current.id}`
      : "";
    const saved =
      (userScope ? safeStorage.getItem(userScope) : null) ||
      safeStorage.getItem(`practice_draft_${session.id}_${current.id}`);
    const initial = saved || "";
    setText(initial);
    textRef.current = initial;
  }, [current?.id, session?.id, user?.id]);

  const minutesLeft = Math.max(
    0,
    Math.ceil((session?.duration_minutes || 20) * 60 - elapsed)
  );
  const timeLabel = `${String(Math.floor(minutesLeft / 60)).padStart(2, "0")}:${String(minutesLeft % 60).padStart(2, "0")}`;
  async function beginVoice() {
    setError("");
    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setError(
        "Microphone access requires a secure connection (HTTPS). Please open this site using HTTPS or type your answer."
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Audio recording is not supported in this browser. Please use Chrome, Edge, Safari, or type your answer above."
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (constraintErr) {
      console.warn("Advanced mic constraints rejected, retrying with simple audio:", constraintErr);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micErr: any) {
        console.error("Microphone getUserMedia failed:", micErr);
        isRecordingRef.current = false;
        setRecording(false);
        if (
          micErr?.name === "NotAllowedError" ||
          micErr?.name === "PermissionDeniedError"
        ) {
          setError(
            "Microphone permission was denied. Please allow microphone access in your browser settings to use voice mode, or type your answer."
          );
        } else if (
          micErr?.name === "NotFoundError" ||
          micErr?.name === "DevicesNotFoundError"
        ) {
          setError(
            "No microphone was found on this device. Please connect a microphone or type your answer above."
          );
        } else {
          setError(
            `Could not access your microphone (${micErr?.message || "device error"}). Please check your microphone settings or type your answer above.`
          );
        }
        return;
      }
    }

    const sessionId = ++recordingSessionIdRef.current;
    initialTextRef.current = textRef.current;
    userEditedDuringRecordingRef.current = false;
    speechSessionFinalsRef.current = [];
    speechSessionInterimRef.current = "";
    audioChunks.current = [];
    speechRecognitionTextRef.current = "";

    audioStream.current = stream;
    isRecordingRef.current = true;
    setRecording(true);
    setMode("voice");
    recordingStarted.current = Date.now();
    setRecordElapsed(0);

    // 1. Audio Visualizer using Web Audio API
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const actx = new AudioCtx();
        audioContextRef.current = actx;
        const src = actx.createMediaStreamSource(stream);
        const analyser = actx.createAnalyser();
        analyser.fftSize = 128;
        src.connect(analyser);
        analyserRef.current = analyser;
        const dataArr = new Uint8Array(analyser.frequencyBinCount);

        const updateVolume = () => {
          if (!isRecordingRef.current || !analyserRef.current) return;
          analyser.getByteFrequencyData(dataArr);
          let sum = 0;
          for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
          const avg = sum / dataArr.length;
          setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(updateVolume);
        };
        animFrameRef.current = requestAnimationFrame(updateVolume);
      }
    } catch (actxErr) {
      console.warn("AudioContext init warning:", actxErr);
    }

    // 2. Hardware recording with MediaRecorder
    const supportedMimes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/wav",
    ];
    let chosenMime = "";
    for (const candidate of supportedMimes) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
        chosenMime = candidate;
        break;
      }
    }

    try {
      const recOptions: MediaRecorderOptions = {};
      if (chosenMime) recOptions.mimeType = chosenMime;
      const rec = new MediaRecorder(stream, recOptions);
      mediaRecorder.current = rec;
      rec.ondataavailable = e => {
        if (e.data && e.data.size > 0) audioChunks.current.push(e.data);
      };
      rec.onerror = (e: any) => {
        console.warn("MediaRecorder runtime error:", e);
      };
      rec.start(250);
    } catch (recErr) {
      console.warn("MediaRecorder start warning:", recErr);
    }

    // 3. Web Speech Recognition for live preview ONLY (never authoritative over real recording)
    const Speech =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (Speech) {
      const startSpeechEngine = () => {
        if (!isRecordingRef.current || recordingSessionIdRef.current !== sessionId) return;
        try {
          if (recognition.current) {
            try {
              recognition.current.abort();
            } catch {}
            recognition.current = null;
          }
          const r = new Speech();
          recognition.current = r;
          const speechLang =
            session?.language === "Hindi"
              ? "hi-IN"
              : (navigator.language || "en-IN");
          r.lang = speechLang.startsWith("hi")
            ? "hi-IN"
            : (speechLang.includes("IN") ? "en-IN" : "en-US");
          r.continuous = true;
          r.interimResults = true;
          r.onresult = (event: any) => {
            if (recordingSessionIdRef.current !== sessionId || !isRecordingRef.current) return;
            let currentFinal = "";
            let currentInterim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i];
              const transcriptChunk = res[0]?.transcript || "";
              if (res.isFinal) {
                currentFinal += `${transcriptChunk} `;
              } else {
                currentInterim += `${transcriptChunk} `;
              }
            }
            if (currentFinal.trim()) {
              const cleaned = currentFinal.trim();
              if (!isSilenceHallucination(cleaned)) {
                speechSessionFinalsRef.current.push(cleaned);
              }
            }
            speechSessionInterimRef.current = currentInterim.trim();
            setInterim(currentInterim.trim());

            // Live preview only: update the text area if the user has not manually edited it
            if (!userEditedDuringRecordingRef.current) {
              const previewSpeech = [
                ...speechSessionFinalsRef.current,
                currentInterim.trim(),
              ]
                .filter(Boolean)
                .join(" ")
                .trim();
              const base = initialTextRef.current.trim();
              const fullPreview = base
                ? (previewSpeech ? `${base} ${previewSpeech}` : base)
                : previewSpeech;
              setText(fullPreview);
              textRef.current = fullPreview;
              speechRecognitionTextRef.current = previewSpeech;
            }
          };
          r.onerror = (event: any) => {
            if (recordingSessionIdRef.current !== sessionId || !isRecordingRef.current) return;
            if (event?.error === "no-speech") return;
            console.warn("Speech error notice:", event?.error);
          };
          r.onend = () => {
            if (recordingSessionIdRef.current !== sessionId || !isRecordingRef.current) return;
            if (voiceRestartTimer.current) clearTimeout(voiceRestartTimer.current);
            voiceRestartTimer.current = setTimeout(() => {
              if (isRecordingRef.current && recordingSessionIdRef.current === sessionId) {
                startSpeechEngine();
              }
            }, 150);
          };
          r.start();
        } catch (err) {
          console.warn("Speech recognition start warning:", err);
        }
      };
      startSpeechEngine();
    }
  }
  async function stopVoice(): Promise<void> {
    if (voiceRestartTimer.current) {
      clearTimeout(voiceRestartTimer.current);
      voiceRestartTimer.current = null;
    }
    const sessionId = recordingSessionIdRef.current;
    const wasRecording = isRecordingRef.current;
    isRecordingRef.current = false;
    setRecording(false);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        void audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setMicVolume(0);

    // Stop recognition cleanly and harvest any pending interim text
    try {
      recognition.current?.stop?.();
    } catch {}
    recognition.current = null;

    if (speechSessionInterimRef.current.trim()) {
      const pending = speechSessionInterimRef.current.trim();
      if (!isSilenceHallucination(pending)) {
        speechSessionFinalsRef.current.push(pending);
      }
      speechSessionInterimRef.current = "";
    }
    setInterim("");

    // Stop MediaRecorder and wait for onstop BEFORE stopping media tracks
    let audioBlob: Blob | null = null;
    const rec = mediaRecorder.current;
    if (rec && rec.state !== "inactive") {
      const audioBlobPromise = new Promise<Blob | null>(resolve => {
        const timeout = setTimeout(() => {
          const blob =
            audioChunks.current.length > 0
              ? new Blob(audioChunks.current, { type: rec.mimeType || "audio/webm" })
              : null;
          resolve(blob);
        }, 1200);

        rec.onstop = () => {
          clearTimeout(timeout);
          const blob =
            audioChunks.current.length > 0
              ? new Blob(audioChunks.current, { type: rec.mimeType || "audio/webm" })
              : null;
          resolve(blob);
        };
      });

      try {
        if (rec.state === "recording") {
          rec.requestData();
        }
        rec.stop();
      } catch (e) {
        console.warn("MediaRecorder stop error:", e);
      }

      audioBlob = await audioBlobPromise;
    } else if (audioChunks.current.length > 0) {
      audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
    }
    mediaRecorder.current = null;

    // NOW stop audio tracks after MediaRecorder has completely finalized
    const stream = audioStream.current;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      audioStream.current = null;
    }

    const durationMs = recordingStarted.current
      ? Date.now() - recordingStarted.current
      : 0;

    // Verify session guard
    if (recordingSessionIdRef.current !== sessionId) return;

    const browserCandidate = speechSessionFinalsRef.current
      .join(" ")
      .trim();
    const hasBrowserSpeech =
      browserCandidate.length > 0 &&
      !isSilenceHallucination(browserCandidate);

    const baseText = initialTextRef.current.trim();

    // 1. Authoritative Backend Transcription
    if (audioBlob && audioBlob.size > 200 && durationMs >= 500) {
      setTranscribing(true);
      try {
        const arrayBuf = await audioBlob.arrayBuffer();
        const result = await transcribe.mutateAsync({
          audioBase64: bytesToBase64(new Uint8Array(arrayBuf)),
          mimeType: audioBlob.type || "audio/webm",
          language: session?.language === "Hindi" ? "hi" : "en",
        });

        if (recordingSessionIdRef.current !== sessionId) return;

        const authoritativeText = result?.text?.trim() || "";
        if (authoritativeText && !isSilenceHallucination(authoritativeText)) {
          // Authoritative backend transcript accepted
          if (!userEditedDuringRecordingRef.current) {
            const finalAnswer = baseText
              ? `${baseText} ${authoritativeText}`
              : authoritativeText;
            setText(finalAnswer);
            textRef.current = finalAnswer;
          }
          setError("");
        } else if (hasBrowserSpeech) {
          // Backend returned empty but browser recognition had genuine words from this session
          if (!userEditedDuringRecordingRef.current) {
            const finalAnswer = baseText
              ? `${baseText} ${browserCandidate}`
              : browserCandidate;
            setText(finalAnswer);
            textRef.current = finalAnswer;
          }
          setError("");
        } else {
          // No clear speech detected from either source
          if (!userEditedDuringRecordingRef.current) {
            setText(initialTextRef.current);
            textRef.current = initialTextRef.current;
          }
          setError(
            "No clear speech was detected. Please speak into your microphone or type your answer above."
          );
        }
      } catch (sttErr: any) {
        console.warn("Backend transcription failed:", sttErr);
        if (recordingSessionIdRef.current !== sessionId) return;

        if (hasBrowserSpeech) {
          // Fallback to browser transcript for this session
          if (!userEditedDuringRecordingRef.current) {
            const finalAnswer = baseText
              ? `${baseText} ${browserCandidate}`
              : browserCandidate;
            setText(finalAnswer);
            textRef.current = finalAnswer;
          }
          setError("");
        } else {
          // Preserve existing text and show honest error
          if (!userEditedDuringRecordingRef.current) {
            setText(initialTextRef.current);
            textRef.current = initialTextRef.current;
          }
          setError(
            sttErr?.message ||
              "Audio transcription could not be completed. Please try again or type your answer above."
          );
        }
      } finally {
        if (recordingSessionIdRef.current === sessionId) {
          setTranscribing(false);
        }
      }
    } else if (wasRecording) {
      if (durationMs < 500 || !audioBlob || audioBlob.size <= 200) {
        if (!userEditedDuringRecordingRef.current) {
          setText(initialTextRef.current);
          textRef.current = initialTextRef.current;
        }
        setError(
          "Recording was too short. Please speak after clicking 'Start answer' or type your answer above."
        );
      } else if (hasBrowserSpeech) {
        if (!userEditedDuringRecordingRef.current) {
          const finalAnswer = baseText
            ? `${baseText} ${browserCandidate}`
            : browserCandidate;
          setText(finalAnswer);
          textRef.current = finalAnswer;
        }
        setError("");
      } else {
        if (!userEditedDuringRecordingRef.current) {
          setText(initialTextRef.current);
          textRef.current = initialTextRef.current;
        }
        setError(
          "No clear speech was detected. Please speak into your microphone or type your answer above."
        );
      }
    }
  }
  stopVoiceRef.current = stopVoice;
  async function adaptNextQuestion(
    score: number,
    feedback: string[],
    client: any
  ) {
    const next = questions[index + 1];
    if (
      !next ||
      answers.some(a => a.question_id === next.id) ||
      (score >= 55 && score < 80)
    )
      return;
    const levels = ["Easy", "Medium", "Hard", "Expert"];
    const currentLevel = levels.indexOf(next.difficulty);
    if (currentLevel < 0) return;
    const targetLevel = Math.max(
      0,
      Math.min(levels.length - 1, currentLevel + (score >= 80 ? 1 : -1))
    );
    if (targetLevel === currentLevel) return;
    const targetDifficulty = levels[targetLevel];
    try {
      const context = JSON.stringify({
        priorQuestion: current?.question_text,
        priorTopic: current?.topic,
        priorScore: score,
        priorFeedback: feedback.slice(0, 2),
        adjustment:
          score >= 80
            ? "Increase challenge one level while keeping the same course and target role."
            : "Reduce difficulty one level and scaffold the same discipline without making it generic.",
        learnerContext: (session?.context_notes || "").slice(0, 600),
      });
      const generated = await adapt.mutateAsync({
        course: session!.course,
        specialization: session!.specialization,
        semester: session!.semester,
        role: session!.target_role,
        type: session!.interview_type,
        difficulty: targetDifficulty,
        skills: session!.skills || [],
        count: 1,
        language: session!.language as "English" | "Hindi" | "Hinglish",
        context: context.slice(0, 1500),
      });
      const candidates = ((Array.isArray(generated)
        ? generated
        : (generated as any)?.questions) || []) as {
        question: string;
        topic: string;
        difficulty: string;
        rationale: string;
      }[];
      const revised = candidates[0];
      if (!revised?.question?.trim()) return;
      const { error: updateError } = await client
        .from("interview_questions")
        .update({
          question_text: revised.question.slice(0, 1200),
          topic: (revised.topic || next.topic).slice(0, 120),
          difficulty: targetDifficulty,
          rationale: (revised.rationale || next.rationale).slice(0, 500),
        })
        .eq("id", next.id)
        .eq("session_id", session!.id)
        .eq("owner_id", user!.id);
      if (updateError) return;
      setQuestions(old =>
        old.map(q =>
          q.id === next.id
            ? {
                ...q,
                question_text: revised.question,
                topic: revised.topic || next.topic,
                difficulty: targetDifficulty,
                rationale: revised.rationale || next.rationale,
              }
            : q
        )
      );
      setAdaptiveNote(
        score >= 80
          ? `You scored ${score}/100, so the next question has been raised to ${targetDifficulty}.`
          : `You scored ${score}/100, so the next question has been scaffolded at ${targetDifficulty}.`
      );
    } catch {
      /* Keep the already saved, course-specific question if optional recalibration is unavailable. */
    }
  }
  async function submitAnswer() {
    if (!current || !session || !user || sending || submittingRef.current) return;

    if (isRecordingRef.current) {
      await stopVoice();
    }

    if (interimRef.current.trim()) {
      const pending = interimRef.current.trim();
      if (!isSilenceHallucination(pending)) {
        const updated = textRef.current ? `${textRef.current} ${pending}` : pending;
        textRef.current = updated;
        setText(updated);
      }
      interimRef.current = "";
      setInterim("");
    }

    let answerText = textRef.current.trim();
    const existingAnswer = answers.find(a => a.question_id === current.id);
    if (!answerText && existingAnswer && !latestEval) {
      answerText = existingAnswer.answer_text;
    }

    if (!answerText || isSilenceHallucination(answerText) || answerText.length < 2) {
      setError("Please speak into your microphone or type your answer before submitting.");
      return;
    }
    if (answerText.length > 12000) {
      setError("Please keep this answer under 12,000 characters.");
      return;
    }
    submittingRef.current = true;
    setSending(true);
    setError("");

    let savedAnswerRow = existingAnswer;
    const c = await getSupabase();

    // Step 1: Save Answer if not already persisted with identical text
    if (!savedAnswerRow || savedAnswerRow.answer_text !== answerText) {
      try {
        const { data: answer, error: answerError } = await c.rpc(
          "save_simple_interview_answer",
          {
            p_session_id: session.id,
            p_question_id: current.id,
            p_answer_text: answerText,
            p_answer_mode: mode,
          }
        );
        if (answerError || !answer) {
          throw (
            answerError ||
            new Error(
              "This interview no longer accepts answers or its server deadline has elapsed."
            )
          );
        }
        savedAnswerRow = answer as AnswerRow;
        setAnswers(a => [
          ...a.filter(x => x.id !== answer.id && x.question_id !== current.id),
          savedAnswerRow!,
        ]);
      } catch (err: any) {
        submittingRef.current = false;
        setSending(false);
        setError(
          err?.message ||
            "We couldn't save this answer. Your text is still here—please try again."
        );
        return;
      }
    }

    // Step 2: AI Evaluation
    const criteria = evaluationCriteriaFromContext(
      session.context_notes || ""
    );
    let result: Eval | null = null;
    let evalSuccess = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const evalRes = await evaluate.mutateAsync({
          question: current.question_text,
          answer: answerText,
          course: session.course,
          specialization: session.specialization,
          semester: session.semester,
          role: session.target_role,
          type: session.interview_type,
          skills: session.skills || [],
          criteria,
          language: session.language as "English" | "Hindi" | "Hinglish",
        });
        if (evalRes?.source === "ai") {
          result = evalRes;
          evalSuccess = true;
          break;
        }
      } catch (evalAttemptErr) {
        console.warn(`Evaluation attempt ${attempt + 1} failed:`, evalAttemptErr);
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 800));
        }
      }
    }
    if (!result || !evalSuccess) {
      console.warn("Evaluation step failed after retries");
      submittingRef.current = false;
      setSending(false);
      setError(
        "Your answer was saved successfully, but coaching evaluation is temporarily unavailable. You can retry evaluation or move to the next question."
      );
      if (session?.id && current?.id) {
        if (user?.id) {
          safeStorage.removeItem(
            `practice_draft_${user.id}_${session.id}_${current.id}`
          );
        }
        safeStorage.removeItem(`practice_draft_${session.id}_${current.id}`);
      }
      return;
    }
    try {
      const { data: savedEvaluation, error: evalError } = await c.rpc(
        "save_simple_answer_evaluation",
        {
          p_session_id: session.id,
          p_answer_id: savedAnswerRow.id,
          p_evaluation: result,
        }
      );
      if (evalError) throw evalError;
      if (savedEvaluation !== true) {
        throw new Error(
          "This interview began finalizing before the evaluation could be saved."
        );
      }
      setEvaluations(e => ({ ...e, [current.id]: result! }));
      setLatestEval(result);
    } catch (evalErr: any) {
      console.warn("Evaluation step failed:", evalErr);
      submittingRef.current = false;
      setSending(false);
      setError(
        "Your answer was saved successfully, but coaching evaluation is temporarily unavailable. You can retry evaluation or move to the next question."
      );
      if (session?.id && current?.id) {
        if (user?.id) {
          safeStorage.removeItem(
            `practice_draft_${user.id}_${session.id}_${current.id}`
          );
        }
        safeStorage.removeItem(`practice_draft_${session.id}_${current.id}`);
      }
      return;
    }

    // Step 3: Success state cleanup & optional question adaptation
    try {
      setText("");
      textRef.current = "";
      setInterim("");
      if (session?.id && current?.id) {
        if (user?.id) {
          safeStorage.removeItem(
            `practice_draft_${user.id}_${session.id}_${current.id}`
          );
        }
        safeStorage.removeItem(`practice_draft_${session.id}_${current.id}`);
      }
      setAdaptiveNote("");
      await adaptNextQuestion(result.overall_score, result.weaknesses, c);
    } catch (adaptErr) {
      console.warn("Question adaptation notice:", adaptErr);
    } finally {
      submittingRef.current = false;
      setSending(false);
    }
  }
  async function skipQuestion() {
    if (isRecordingRef.current) {
      void stopVoiceRef.current?.();
    }
    interimRef.current = "";
    setInterim("");
    audioChunks.current = [];
    if (current) {
      setIndex(i => Math.min(i + 1, questions.length));
      setLatestEval(null);
      setText("");
      textRef.current = "";
    }
  }
  function repeatQuestion() {
    if (!current) return;
    if (!("speechSynthesis" in window)) {
      setError("Question audio playback is unavailable in this browser. Read the question on screen and continue.");
      return;
    }
    window.speechSynthesis.cancel();
    setSpeaking(false);
    const utter = new SpeechSynthesisUtterance(current.question_text);
    utter.lang = session?.language === "Hindi" ? "hi-IN" : "en-US";
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => {
      setSpeaking(false);
      setError("Question audio playback failed. Read the question on screen and continue.");
    };
    window.speechSynthesis.speak(utter);
  }
  async function endInterviewEarly() {
    if (
      text.trim() &&
      !window.confirm(
        "Your current answer has not been submitted. End the interview and discard that unsaved answer?"
      )
    )
      return;
    stopVoice();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setText("");
    setIndex(questions.length);
    setLatestEval(null);
    await finish();
  }
  if (loading) return <LoadingState text="Preparing your interview room…" />;
  if (error && !session)
    return (
      <div className="interview-room">
        <div className="notice notice-error">{error}</div>
        <Link href="/practice" className="button button-secondary">
          Back to practice setup
        </Link>
      </div>
    );
  if (!session) return null;
  if (session.status === "completed")
    return (
      <div className="center-screen">
        <span className="tiny-orb" />
        <h2>Interview complete</h2>
        <p>Your report is ready.</p>
        <Link className="button button-primary" href={`/report/${session.id}`}>
          View report <ArrowRight size={14} />
        </Link>
      </div>
    );
  if (index >= questions.length || minutesLeft === 0)
    return (
      <div className="interview-room">
        <div className="panel finish-panel">
          <span className="eyebrow">
            <Check size={13} /> ALL QUESTIONS REACHED
          </span>
          <h2>Ready to wrap up?</h2>
          <p className="muted">
            You evaluated{" "}
            {
              Object.keys(evaluations).filter(
                k =>
                  evaluations[k] != null &&
                  typeof evaluations[k].overall_score === "number" &&
                  !isNaN(evaluations[k].overall_score)
              ).length
            }{" "}
            of {questions.length} questions. Your report will summarize
            completed answers and highlight useful next steps.
          </p>
          {error && <div className="notice notice-error">{error}</div>}
          <button
            className="button button-primary"
            disabled={sending}
            onClick={finish}
          >
            {sending ? (
              <>
                <span className="spinner" /> Preparing report…
              </>
            ) : (
              <>
                Complete interview <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    );
  return (
    <div className="interview-room page-stack">
      <div className="room-head">
        <div className="room-meta">
          <Link href="/app" className="text-link">
            Workspace
          </Link>
          <span>/</span>
          <b>{session.target_role}</b>
          <Tag tone="violet">{session.interview_type}</Tag>
        </div>
        <div className="room-progress">
          <span>
            QUESTION {index + 1} / {questions.length}
          </span>
          <div className="progress-track">
            <i
              style={{ width: `${((index + 1) / questions.length) * 100}%` }}
            />
          </div>
          <span className={minutesLeft < 120 ? "time-warn" : ""}>
            <Clock3 size={12} /> {timeLabel}
          </span>
        </div>
      </div>
      <div className="room-layout">
        <Panel className="interviewer-card">
          <div
            className={`interviewer-orb ${recording ? "listening" : sending ? "thinking" : speaking ? "speaking" : ""}`}
          >
            <Orbit size={49} />
          </div>
          <div className={`room-status ${recording ? "recording" : ""}`}>
            <i />
            {recording
              ? "AI LISTENING"
              : sending
                ? "AI THINKING & EVALUATING"
                : speaking
                  ? "AI SPEAKING"
                  : "YOUR COACH IS READY"}
          </div>
          <div className="room-course">
            <span className="tiny-orb" /> {session.course} ·{" "}
            {session.specialization || session.experience_level}
          </div>
        </Panel>
        <Panel className="question-panel">
          <span className="question-kicker">
            {current?.topic?.toUpperCase() || "INTERVIEW QUESTION"}{" "}
            <span className="question-dot">·</span>{" "}
            {current?.difficulty?.toUpperCase()}
          </span>
          <h2>{current?.question_text}</h2>
          {current?.rationale && <p>Focus: {current.rationale}</p>}
          <div className="answer-mode-tabs">
            <button
              className={mode === "text" ? "active" : ""}
              onClick={() => {
                if (recording) stopVoice();
                setMode("text");
              }}
            >
              TEXT
            </button>
            <button
              className={mode === "voice" ? "active" : ""}
              onClick={() => setMode("voice")}
            >
              VOICE
            </button>
            <button
              className="repeat-btn"
              onClick={repeatQuestion}
              title="Read question aloud"
            >
              <Volume2 size={14} /> Repeat
            </button>
          </div>
          <textarea
            className="answer-box"
            maxLength={12000}
            value={recording && interim ? (text ? `${text} ${interim}` : interim) : text}
            onChange={e => {
              setError("");
              interimRef.current = "";
              setInterim("");
              speechSessionInterimRef.current = "";
              userEditedDuringRecordingRef.current = true;
              setText(e.target.value);
              textRef.current = e.target.value;
            }}
            placeholder={
              recording
                ? "Speak naturally — your transcript will appear here (you can also edit or type directly)…"
                : "Type your answer here. Aim for a clear point, your reasoning, and one example."
            }
            aria-label="Your answer"
            disabled={sending || transcribing}
          />
          <div className="record-row">
            {transcribing ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span className="spinner" /> AI is transcribing your spoken answer…
              </span>
            ) : recording ? (
              <>
                <span className="record-indicator" />
                <span>Recording · {formatTime(recordElapsed)}</span>
                <div className="waveform" aria-label="Recording waveform">
                  {Array.from({ length: 14 }, (_, i) => {
                    const dynamicHeight = Math.max(
                      5,
                      Math.min(
                        22,
                        Math.round(5 + ((i * 13) % 10) + (micVolume / 100) * 12)
                      )
                    );
                    return (
                      <i
                        key={i}
                        style={
                          {
                            "--h": `${dynamicHeight}px`,
                          } as React.CSSProperties
                        }
                      />
                    );
                  })}
                </div>
                <button className="button button-secondary" onClick={stopVoice}>
                  <Square size={12} /> Stop
                </button>
              </>
            ) : (
              <>
                <span>
                  Voice input is optional. You can speak or type your answer above.
                </span>
                <button
                  className="button button-secondary"
                  onClick={beginVoice}
                  disabled={sending || transcribing}
                >
                  <Mic size={13} /> Start answer
                </button>
              </>
            )}
          </div>
          {error && <div className="notice notice-error">{error}</div>}
          <div className="room-actions">
            <button
              className="button button-primary"
              onClick={submitAnswer}
              disabled={
                sending ||
                transcribing ||
                (!text.trim() &&
                  !answers.some(a => a.question_id === current?.id))
              }
            >
              {sending ? (
                <>
                  <span className="spinner" /> Evaluating…
                </>
              ) : transcribing ? (
                <>
                  <span className="spinner" /> Transcribing…
                </>
              ) : answers.some(a => a.question_id === current?.id) && !latestEval ? (
                <>
                  Retry evaluation <Send size={13} />
                </>
              ) : (
                <>
                  Submit answer <Send size={13} />
                </>
              )}
            </button>
            {answers.some(a => a.question_id === current?.id) && !latestEval && (
              <button
                className="button button-secondary"
                onClick={() => {
                  setError("");
                  if (index + 1 >= questions.length) setIndex(questions.length);
                  else setIndex(i => i + 1);
                }}
                disabled={sending}
              >
                Next question <ArrowRight size={13} />
              </button>
            )}
            <button
              className="button button-ghost"
              onClick={skipQuestion}
              disabled={sending}
            >
              <ArrowRight size={13} /> Skip
            </button>
            <button
              className="button button-ghost"
              onClick={endInterviewEarly}
              disabled={sending}
            >
              End interview
            </button>
          </div>
          {latestEval && (
            <div className="feedback-panel">
              <div className="feedback-top">
                <div>
                  <span className="eyebrow">AI COACHING · NOT VERIFIED</span>
                  <h4>
                    Answer signal{" "}
                    <b className="feedback-score">
                      {typeof latestEval.overall_score === "number" && !isNaN(latestEval.overall_score)
                        ? latestEval.overall_score
                        : "—"}
                      <small>/100</small>
                    </b>
                  </h4>
                </div>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setLatestEval(null);
                    setError("");
                    setAdaptiveNote("");
                    if (index + 1 >= questions.length)
                      setIndex(questions.length);
                    else setIndex(i => i + 1);
                  }}
                >
                  {index + 1 >= questions.length
                    ? "Review & finish"
                    : "Next question"}
                  <ArrowRight size={13} />
                </button>
              </div>
              {typeof latestEval.communication_score === "number" && (
                <p className="report-eval-meta">
                  Separate transcript communication-structure observation: {latestEval.communication_score}/100. It does not contribute to the answer-quality score and does not measure vocal confidence, accent or personality.
                </p>
              )}
              <div className="feedback-list">
                <p>
                  <b>Strong points</b>
                  {latestEval.strengths.slice(0, 2).map(s => (
                    <span key={s}>
                      • {s}
                      <br />
                    </span>
                  ))}
                </p>
                <p>
                  <b>Could improve</b>
                  {latestEval.weaknesses.slice(0, 2).map(s => (
                    <span key={s}>
                      • {s}
                      <br />
                    </span>
                  ))}
                </p>
              </div>
              <p className="tip-line">
                <Lightbulb size={13} />
                {latestEval.improvement_tip}
              </p>
              {adaptiveNote && (
                <div className="notice notice-success">{adaptiveNote}</div>
              )}
              <details className="detailed-feedback">
                <summary>View detailed feedback</summary>
                <p>{latestEval.better_answer}</p>
                {latestEval.missing_points.map(x => (
                  <span key={x} className="missing-point">
                    {x}
                  </span>
                ))}
                {latestEval.dimensions.map(d => (
                  <div className="dimension-result" key={d.name}>
                    <span>{d.name}</span>
                    <ProgressBar value={d.score} />
                    <b>{d.score}</b>
                    <small>
                      {typeof d.weight === "number"
                        ? `Weight ${d.weight}% · `
                        : ""}
                      {d.note}
                    </small>
                    <small className="dimension-evidence">
                      <b>Exact answer evidence:</b>{" "}
                      {d.evidence || "No exact evidence quote returned."}
                    </small>
                  </div>
                ))}
              </details>
            </div>
          )}
        </Panel>
      </div>
      <div className="room-foot">
        <span>
          <ShieldCheckIcon /> Your answer is private to this account
        </span>
        <span>Educational practice · Not a hiring decision</span>
      </div>
    </div>
  );
}
async function fetchSession(c: any, id: string, userId: string) {
  const [s, q, a] = await Promise.all([
    c
      .from("interview_sessions")
      .select("*")
      .eq("id", id)
      .eq("owner_id", userId)
      .maybeSingle(),
    c
      .from("interview_questions")
      .select("*")
      .eq("session_id", id)
      .eq("owner_id", userId)
      .order("sort_order"),
    c
      .from("interview_answers")
      .select("*")
      .eq("session_id", id)
      .eq("owner_id", userId),
  ]);
  return {
    sdata: s.data as SessionRow | null,
    qdata: (q.data || []) as InterviewQuestion[],
    adata: (a.data || []) as AnswerRow[],
  };
}
function formatTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function ShieldCheckIcon() {
  return <Check size={12} />;
}

export function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [session, setSession] = useState<SessionRow | null>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [bookmarkError, setBookmarkError] = useState("");
  const [, navigate] = useLocation();
  async function toggleReportBookmark() {
    if (!user || !session || bookmarkBusy) return;
    setBookmarkBusy(true);
    setBookmarkError("");
    try {
      const c = await getSupabase();
      const result = saved
        ? await c
            .from("bookmarks")
            .delete()
            .eq("owner_id", user.id)
            .eq("target_type", "report")
            .eq("target_id", id)
        : await c.from("bookmarks").upsert(
            {
              owner_id: user.id,
              target_type: "report",
              target_id: id,
              title: `${session.target_role} · ${session.course}`,
              detail: `${session.interview_type} interview report`,
            },
            { onConflict: "owner_id,target_type,target_id" }
          );
      if (result.error) throw result.error;
      setSaved(!saved);
    } catch {
      setBookmarkError(
        "We couldn't update your saved reports. Please try again."
      );
    } finally {
      setBookmarkBusy(false);
    }
  }
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let live = true;
    void (async () => {
      try {
        const c = await getSupabase();
        const [s, q, a, r, b] = await Promise.all([
          c
            .from("interview_sessions")
            .select("*")
            .eq("id", id)
            .eq("owner_id", userId)
            .maybeSingle(),
          c
            .from("interview_questions")
            .select("*")
            .eq("session_id", id)
            .eq("owner_id", userId)
            .order("sort_order"),
          c
            .from("interview_answers")
            .select("*,answer_evaluations(*)")
            .eq("session_id", id)
            .eq("owner_id", userId),
          c
            .from("interview_reports")
            .select("analysis")
            .eq("session_id", id)
            .eq("owner_id", userId)
            .maybeSingle(),
          c
            .from("bookmarks")
            .select("id")
            .eq("owner_id", userId)
            .eq("target_type", "report")
            .eq("target_id", id)
            .maybeSingle(),
        ]);
        if (!live) return;
        setSession(s.data as SessionRow | null);
        const arr = [];
        for (const qrow of q.data || []) {
          const ar = (a.data || []).find((x: any) => x.question_id === qrow.id);
          const storedEvaluation = ar?.answer_evaluations?.[0];
          const evaluation = storedEvaluation?.source === "ai"
            ? {
                ...storedEvaluation,
                source: "ai",
                modelVersion:
                  storedEvaluation.model_version ??
                  storedEvaluation.modelVersion ??
                  undefined,
                promptVersion:
                  storedEvaluation.prompt_version ??
                  storedEvaluation.promptVersion ??
                  undefined,
                rubricVersion:
                  storedEvaluation.rubric_version ??
                  storedEvaluation.rubricVersion ??
                  undefined,
              }
            : null;
          arr.push({
            ...qrow,
            answer: ar?.answer_text || "",
            evaluation,
            evaluationUnavailable: Boolean(
              storedEvaluation && storedEvaluation.source !== "ai"
            ),
          });
        }
        setAnswers(arr);
        setReport(r.data?.analysis || null);
        setSaved(Boolean(b.data));
      } catch {
        /* show report unavailable state */
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [id, userId]);
  if (loading) return <LoadingState text="Putting your report together…" />;
  if (!session)
    return (
      <div className="page-stack">
        <EmptyState
          title="Report not found"
          description="This report may not belong to your account or the session may not be complete."
          action="View interview history"
          href="/history"
        />
      </div>
    );
  const evaluated = answers.filter(a => a.evaluation?.source === "ai");
  const answeredCount = answers.filter(a => a.answer.trim().length > 0).length;
  const answerQuality = evaluated.length
    ? Math.round(
        evaluated.reduce((s, a) => s + a.evaluation.overall_score, 0) /
          evaluated.length
      )
    : null;
  const score =
    answerQuality === null
      ? null
      : completionAdjustedScore(answerQuality, evaluated.length, answers.length);
  const reportHasTrustedSource = report?.analysisSource === "ai";
  const savedReportSummary =
    reportHasTrustedSource && typeof report?.summary === "string"
      ? report.summary
      : null;
  const reportSummary =
    score === null
      ? savedReportSummary ||
        (answeredCount
          ? `${answeredCount} responses were saved, but none has a supported AI evaluation. No score is available.`
          : "No answers were evaluated. No score is available.")
      : evaluated.length < answers.length
        ? `You saved ${answeredCount} of ${answers.length} responses; ${evaluated.length} received AI evaluation. Answer quality was ${answerQuality}/100, and the session score is ${score}/100 after accounting for completion.`
        : savedReportSummary ||
          `You completed ${evaluated.length} AI-evaluated answer${evaluated.length === 1 ? "" : "s"}. Use the notes below to choose your next practice step.`;
  const dimensionMap = new Map<string, number[]>();
  for (const answer of evaluated)
    for (const d of answer.evaluation.dimensions || []) {
      dimensionMap.set(d.name, [...(dimensionMap.get(d.name) || []), d.score]);
    }
  const radar = Array.from(dimensionMap.entries()).map(([subject, values]) => ({
    subject,
    score: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    fullMark: 100,
  }));
  const repeatedMistakes =
    reportHasTrustedSource && Array.isArray(report?.repeated_mistakes)
    ? report.repeated_mistakes
    : [];
  const missingConcepts =
    reportHasTrustedSource && Array.isArray(report?.missing_concepts)
    ? report.missing_concepts
    : [];
  const savedCommunication =
    reportHasTrustedSource && Array.isArray(report?.communication_issues)
    ? report.communication_issues
    : [];
  const reportStrengths =
    reportHasTrustedSource && Array.isArray(report?.strengths)
      ? report.strengths
      : evaluated.flatMap(a => a.evaluation?.strengths || []).slice(0, 3);
  const reportWeaknesses =
    reportHasTrustedSource && Array.isArray(report?.weaknesses)
      ? report.weaknesses
      : evaluated.flatMap(a => a.evaluation?.weaknesses || []).slice(0, 3);
  const savedNextStep =
    reportHasTrustedSource && Array.isArray(report?.next_steps)
      ? report.next_steps[0]
      : null;
  const observedCommunication = evaluated.flatMap((answer: any) =>
    (answer.evaluation?.dimensions || [])
      .filter(
        (dimension: any) =>
          dimension.measure === "communication" && Number(dimension.score) < 70
      )
      .map(
        (dimension: any) =>
          `${dimension.name}: ${dimension.note || `${dimension.score}/100`}`
      )
  );
  const communicationIssues = Array.from(
    new Set([...savedCommunication, ...observedCommunication])
  ).slice(0, 5);
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR SESSION REPORT"
        title="A useful next step starts here."
        description={`${session.course} · ${session.target_role} · ${session.interview_type} interview`}
        action={
          <>
            <button
              className={
                saved ? "button button-primary" : "button button-secondary"
              }
              onClick={() => void toggleReportBookmark()}
              disabled={bookmarkBusy}
              aria-label={
                saved ? "Remove report from saved items" : "Save report"
              }
            >
              <Bookmark size={14} />{" "}
              {bookmarkBusy ? "Saving…" : saved ? "Saved" : "Save report"}
            </button>
            <Link className="button button-secondary" href="/practice">
              Practice again <RotateCcw size={14} />
            </Link>
            <button
              className="button button-primary"
              onClick={() => navigate("/study-plan")}
            >
              Build a study plan <ArrowRight size={14} />
            </button>
          </>
        }
      />
      {bookmarkError && (
        <div className="notice notice-error" role="alert">
          {bookmarkError}
        </div>
      )}
      <section className="report-hero">
        <div className="report-score">
          {score === null ? (
            <div
              className="report-score-unavailable"
              aria-label="No overall score available"
            >
              <strong>—</strong>
              <span>NOT SCORED</span>
            </div>
          ) : (
            <ScoreRing score={score} size={143} label="overall score" />
          )}
          <div>
            <span className="eyebrow">
              <Sparkles size={13} /> SESSION SUMMARY
            </span>
            <h2>
              {score === null
                ? "Not scored"
                : score >= 82
                ? "Strong performance"
                : score >= 65
                  ? "Good progress"
                  : "A clear place to grow"}
            </h2>
            <p>{reportSummary}</p>
            {reportHasTrustedSource && (
              <p className="report-eval-meta">
                `AI report analysis · prompt ${report.analysisPromptVersion || report.promptVersion || "version not recorded"}`
              </p>
            )}
            <div className="report-tags">
              {score !== null && (
                <Tag tone="cyan">{readinessLabel(score)}</Tag>
              )}
              {answerQuality !== null && (
                <Tag tone="violet">Answer quality: {answerQuality}/100</Tag>
              )}
              <Tag>
                {answeredCount} / {answers.length} answered
              </Tag>
              <Tag>{evaluated.length} AI-evaluated</Tag>
              {session.duration_seconds && (
                <Tag>{formatTime(session.duration_seconds)}</Tag>
              )}
            </div>
          </div>
        </div>
        <div className="report-privacy">
          <ShieldCheckIcon />
          {score === null
            ? "No AI coaching score is available for this report; saved answers are preserved without heuristic feedback."
            : "AI-generated coaching estimates are educational, not independently verified facts or hiring decisions."}
        </div>
      </section>
      <div className="report-grid">
        <Panel
          title="Your answer dimensions"
          subtitle="Average of the saved evaluation signals from this session."
        >
          {radar.length ? (
            <ResponsiveContainer width="100%" height={255}>
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke="#ffffff18" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "#9eacc0", fontSize: 9 }}
                />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#69def5"
                  fill="#69def5"
                  fillOpacity={0.2}
                />
                <ChartTooltip
                  contentStyle={{
                    background: "#121722",
                    border: "1px solid #ffffff20",
                    borderRadius: 8,
                    color: "#e7eff9",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="Dimension detail will appear after answers."
              description="This session did not return dimension-level scores."
            />
          )}
        </Panel>
        <Panel
          title="Coach's takeaways"
          subtitle="Based on your saved answers, not personal characteristics."
        >
          <div className="insight-columns">
            <div>
              <b className="takeaway-label positive">STRENGTHS</b>
              {reportStrengths.length ? (
                reportStrengths.map((x: string, i: number) => (
                  <p className="takeaway-item" key={`${x}-${i}`}>
                    <Check size={13} />
                    {x}
                  </p>
                ))
              ) : (
                <p className="muted-small">
                  Your first insight will appear after an answer is evaluated.
                </p>
              )}
            </div>
            <div>
              <b className="takeaway-label needs">AREAS TO PRACTICE</b>
              {reportWeaknesses.length ? (
                reportWeaknesses.map((x: string, i: number) => (
                  <p className="takeaway-item" key={`${x}-${i}`}>
                    <Target size={13} />
                    {x}
                  </p>
                ))
              ) : (
                <p className="muted-small">
                  No answer feedback was saved for this session.
                </p>
              )}
            </div>
          </div>
          <div className="next-step-card">
            <span>
              <Lightbulb size={14} />
            </span>
            <p>
              {savedNextStep ||
                "Try a short answer with one concrete example, then make the outcome explicit."}
            </p>
            <Link href="/skill-gap" className="text-link">
              See skill gaps <ArrowRight size={13} />
            </Link>
          </div>
        </Panel>
      </div>
      <Panel
        title="Patterns, concepts & communication"
        subtitle="Session synthesis and saved rubric signals from your answers."
      >
        <div className="report-pattern-grid">
          <article className="report-pattern-card">
            <span>REPEATED MISTAKES</span>
            {repeatedMistakes.length ? (
              <ul>
                {repeatedMistakes.slice(0, 5).map((item: string, i: number) => (
                  <li key={`${item}-${i}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No repeated-mistake summary was available for this session.</p>
            )}
          </article>
          <article className="report-pattern-card">
            <span>MISSING CONCEPTS</span>
            {missingConcepts.length ? (
              <ul>
                {missingConcepts.slice(0, 5).map((item: string, i: number) => (
                  <li key={`${item}-${i}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No missing-concept summary was recorded.</p>
            )}
          </article>
          <article className="report-pattern-card">
            <span>COMMUNICATION ISSUES</span>
            {communicationIssues.length ? (
              <ul>
                {communicationIssues.map((item: string, i: number) => (
                  <li key={`${item}-${i}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>
                {evaluated.length
                  ? "No low communication or clarity dimensions were recorded."
                  : "No evaluated answer data was available to assess communication."}
              </p>
            )}
          </article>
        </div>
      </Panel>
      <Panel
        title="Question-by-question"
        subtitle="Open a question to revisit the feedback and suggested structure."
      >
        <div className="report-questions">
          {answers.map((a, i) => (
            <details className="report-question" key={a.id || a.id}>
              <summary>
                <span className="report-q-no">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="report-q-text">{a.question_text}</span>
                <span className="report-q-score">
                  {a.evaluation?.source === "ai"
                    ? `${a.evaluation.overall_score}/100`
                    : a.evaluationUnavailable
                      ? "Coaching unavailable"
                      : a.answer.trim()
                        ? "Not evaluated"
                        : "Skipped"}
                </span>
              </summary>
              <div className="report-answer">
                <b>Your response</b>
                <p>{a.answer || "No response submitted."}</p>
                {a.evaluationUnavailable && (
                  <p className="report-eval-meta">
                    AI coaching was unavailable for this answer. No heuristic
                    score or feedback is shown; the saved response is preserved.
                  </p>
                )}
                {a.evaluation && (
                  <>
                    <p className="report-eval-meta">
                      {a.evaluation.source === "ai"
                        ? `AI coaching · prompt ${a.evaluation.promptVersion || "version not recorded"} · rubric ${a.evaluation.rubricVersion || "version not recorded"}`
                        : a.evaluation.source === "baseline"
                          ? "Transparent baseline feedback; not an AI evaluation."
                          : "Evaluation origin was not recorded; it is excluded from the session score."}
                    </p>
                    {typeof a.evaluation.communication_score === "number" && (
                      <p className="report-eval-meta">
                        Separate transcript communication-structure observation: {a.evaluation.communication_score}/100; excluded from answer-quality scoring.
                      </p>
                    )}
                    <b>Suggestion</b>
                    <p>{a.evaluation.better_answer}</p>
                    <div className="report-mini-dims">
                      {(a.evaluation.dimensions || []).map((d: any) => (
                        <span key={d.name}>
                          {d.name}
                          <b>
                            {d.score}
                            {typeof d.weight === "number" && (
                              <small> · {d.weight}%</small>
                            )}
                          </b>
                        </span>
                      ))}
                    </div>
                    {(a.evaluation.dimensions || []).map((d: any) => (
                      <p className="report-dimension-evidence" key={`evidence-${d.name}`}>
                        <b>{d.name} evidence:</b>{" "}
                        {d.evidence || "No exact evidence quote returned."}
                      </p>
                    ))}
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
      </Panel>
      <div className="disclaimer-line">
        <span className="tiny-orb" /> Scores are practice indicators from saved
        answers. The readiness baseline is transparent and has not been trained
        as a hiring model.
      </div>
    </div>
  );
}
