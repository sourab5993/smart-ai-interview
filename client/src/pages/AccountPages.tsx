import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Database,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  LockKeyhole,
  LogOut,
  Mail,
  Mic2,
  Plus,
  Save,
  Settings,
  Shield,
  Sparkles,
  Target,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSupabase } from "@/lib/supabase";
import { authRedirectUrl } from "@/lib/auth-redirect";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import {
  EmptyState,
  LoadingState,
  PageHeading,
  Panel,
  ProgressBar,
  StatTile,
  Tag,
} from "@/components/app/Shared";

export function NotificationsPage() {
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!userId) return;
        const c = await getSupabase();
        const { data, error: e } = await c
          .from("notifications")
          .select("*")
          .eq("owner_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (e) throw e;
        if (active) setRows(data || []);
      } catch {
        if (active)
          setError(
            "We couldn't load your notifications. Please refresh the page."
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);
  async function mark(id: string) {
    const c = await getSupabase();
    const { error: e } = await c
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", user!.id);
    if (e) setError("That notification couldn't be updated.");
    else {
      setRows(r =>
        r.map(n =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      window.dispatchEvent(new Event("app-notification-changed"));
    }
  }
  async function markAll() {
    const c = await getSupabase();
    const { error: e } = await c
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("owner_id", user!.id)
      .is("read_at", null);
    if (e) setError("We couldn't mark all notifications as read.");
    else {
      setRows(r =>
        r.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      window.dispatchEvent(new Event("app-notification-changed"));
    }
  }
  if (loading) return <LoadingState text="Checking your notifications…" />;
  const unread = rows.filter(r => !r.read_at).length;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR UPDATES"
        title="Useful reminders, never noise."
        description="Practice, report and plan updates stay private to your account."
        action={
          unread > 0 ? (
            <button
              className="button button-secondary"
              onClick={() => void markAll()}
            >
              Mark all read <Check size={13} />
            </button>
          ) : undefined
        }
      />
      {error && <div className="notice notice-error">{error}</div>}
      {!rows.length ? (
        <Panel>
          <EmptyState
            icon={Bell}
            title="You're all caught up."
            description="Interview reports and plan updates will show up here."
            action="Start a practice session"
            href="/practice"
          />
        </Panel>
      ) : (
        <Panel
          title={`${unread ? `${unread} unread` + " · " : ""}Recent notifications`}
        >
          <div className="notice-list">
            {rows.map(n => (
              <article
                key={n.id}
                className={`notification-row ${n.read_at ? "" : "notification-unread"}`}
              >
                <span className="notification-icon">
                  <Bell size={14} />
                </span>
                <div className="notification-copy">
                  <b>{n.title}</b>
                  <p>{n.body}</p>
                  <time>{new Date(n.created_at).toLocaleString()}</time>
                </div>
                {!n.read_at && (
                  <button
                    className="button button-ghost"
                    onClick={() => void mark(n.id)}
                  >
                    Mark read
                  </button>
                )}
              </article>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { user, logout } = useSupabaseAuth();
  const userId = user?.id;
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState("Profile");
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({
    full_name: "",
    college: "",
    course: "",
    specialization: "",
    semester: "",
    graduation_year: "",
    interests: "",
    target_career: "",
    target_role: "",
    experience_level: "",
    preferred_industry: "",
    language: "English",
    interview_preference: "Mixed",
    default_difficulty: "Medium",
    feedback_detail: "Detailed",
    voice_enabled: true,
    email_notifications: true,
    notifications_enabled: true,
    theme_preference: "dark",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    void (async () => {
      try {
        if (!userId) return;
        const c = await getSupabase();
        const { data, error: e } = await c
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (e) throw e;
        if (data) {
          setProfile(data);
          setForm(f => ({
            ...f,
            ...data,
            graduation_year: data.graduation_year
              ? String(data.graduation_year)
              : "",
            full_name: data.full_name || "",
            college: data.college || "",
            course: data.course || "",
            specialization: data.specialization || "",
            semester: data.semester || "",
            target_career: data.target_career || "",
            target_role: data.target_role || "",
            experience_level: data.experience_level || "",
            preferred_industry: data.preferred_industry || "",
            interests: Array.isArray(data.interests)
              ? data.interests.join(", ")
              : "",
            language: data.language || "English",
            interview_preference: data.interview_preference || "Mixed",
            default_difficulty: data.default_difficulty || "Medium",
            feedback_detail: data.feedback_detail || "Detailed",
            voice_enabled: data.voice_enabled ?? true,
            email_notifications: data.email_notifications ?? true,
            notifications_enabled: data.notifications_enabled ?? true,
            theme_preference: data.theme_preference || "dark",
          }));
          if (data.theme_preference === "system") setTheme("system");
          else setTheme("dark");
        }
      } catch {
        setError("We couldn't load your settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, setTheme]);
  function change(name: string, value: any) {
    setForm(f => ({ ...f, [name]: value }));
    setSuccess("");
  }
  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const c = await getSupabase();
      const { error: e } = await c
        .from("profiles")
        .update({
          ...form,
          interests: String(form.interests)
            .split(",")
            .map(x => x.trim())
            .filter(Boolean)
            .slice(0, 20),
          graduation_year: Number(form.graduation_year) || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user!.id);
      if (e) throw e;
      setProfile({ ...profile, ...form });
      setTheme(form.theme_preference === "system" ? "system" : "dark");
      setSuccess("Your preferences have been saved.");
    } catch {
      setError(
        "We couldn't save these settings. Your account remains unchanged; please retry."
      );
    } finally {
      setSaving(false);
    }
  }
  async function resetPassword() {
    setError("");
    try {
      const c = await getSupabase();
      const { error: e } = await c.auth.resetPasswordForEmail(
        user?.email || "",
        { redirectTo: authRedirectUrl("/reset-password", window.location.origin) }
      );
      if (e) throw e;
      setSuccess(
        "If this address is verified, a secure password-reset link is on its way."
      );
    } catch {
      setError("We couldn't request a password-reset email right now.");
    }
  }
  if (loading) return <LoadingState text="Loading your account preferences…" />;
  const tabs = [
    { name: "Profile", icon: Users },
    { name: "Account", icon: KeyRound },
    { name: "Notifications", icon: Bell },
    { name: "Security", icon: Shield },
    { name: "Appearance", icon: Layers },
    { name: "AI Preferences", icon: Sparkles },
  ];
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR ACCOUNT"
        title="Settings that stay yours."
        description="Manage your learner profile, practice preferences and account safeguards."
        action={
          <button
            className="button button-primary"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner" /> Saving…
              </>
            ) : (
              <>
                Save changes <Save size={14} />
              </>
            )}
          </button>
        }
      />
      {error && <div className="notice notice-error">{error}</div>}
      {success && <div className="notice notice-success">{success}</div>}
      <div className="settings-grid">
        <nav className="settings-nav" aria-label="Settings sections">
          {tabs.map(({ name, icon: Icon }) => (
            <button
              className={tab === name ? "active" : ""}
              key={name}
              onClick={() => setTab(name)}
            >
              <Icon size={14} />
              {name}
              <ChevronRight size={13} />
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {tab === "Profile" && (
            <Panel
              title="Profile & career direction"
              subtitle="Used to make interview questions and recommendations more relevant."
            >
              <div className="settings-fields">
                {[
                  ["full_name", "Full name"],
                  ["college", "College / institution"],
                  ["course", "Course"],
                  ["specialization", "Specialization"],
                  ["semester", "Year / semester"],
                  ["graduation_year", "Graduation year"],
                  ["target_career", "Target career"],
                  ["target_role", "Target role"],
                  ["experience_level", "Experience level"],
                  ["preferred_industry", "Preferred industry"],
                  ["interests", "Areas of interest (comma-separated)"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      className="field"
                      value={(form[key as keyof typeof form] as string) || ""}
                      onChange={e => change(key, e.target.value)}
                      maxLength={160}
                    />
                  </label>
                ))}
              </div>
              <div className="settings-readonly">
                <span>Email</span>
                <b>{user?.email || "—"}</b>
                <Tag tone="green">Supabase Auth</Tag>
              </div>
            </Panel>
          )}
          {tab === "Account" && (
            <Panel
              title="Account details"
              subtitle="Your Supabase identity is used to scope private practice data and storage."
            >
              <div className="security-row">
                <span className="security-icon">
                  <Mail />
                </span>
                <div>
                  <b>Signed-in email</b>
                  <small>{user?.email || "Not available"}</small>
                </div>
                <Tag tone={user?.email_confirmed_at ? "green" : "amber"}>
                  {user?.email_confirmed_at
                    ? "Verified"
                    : "Verification pending"}
                </Tag>
              </div>
              <div className="security-row">
                <span className="security-icon">
                  <Shield />
                </span>
                <div>
                  <b>Data boundary</b>
                  <small>
                    Your session is authenticated. PostgreSQL row-level policies
                    protect personal records and resume objects.
                  </small>
                </div>
                <Tag tone="green">RLS enabled</Tag>
              </div>
              <div className="security-row">
                <span className="security-icon">
                  <LogOut />
                </span>
                <div>
                  <b>Sign out</b>
                  <small>End this authenticated session on this device.</small>
                </div>
                <button
                  className="button button-secondary"
                  onClick={() => void logout()}
                >
                  Sign out <ArrowRight size={13} />
                </button>
              </div>
            </Panel>
          )}
          {tab === "Notifications" && (
            <Panel
              title="Notification preferences"
              subtitle="Control in-app reminders for your preparation activity."
            >
              <ToggleRow
                title="In-app notifications"
                description="Interview reports, plan updates and practice reminders."
                checked={form.notifications_enabled}
                onClick={() =>
                  change("notifications_enabled", !form.notifications_enabled)
                }
              />
              <ToggleRow
                title="Email reminders"
                description="Preference saved for future email delivery support."
                checked={form.email_notifications}
                onClick={() =>
                  change("email_notifications", !form.email_notifications)
                }
              />
              <p className="muted-small">
                Email delivery is not configured in this project; this
                preference is stored but won't send external email
                notifications.
              </p>
            </Panel>
          )}
          {tab === "Security" && (
            <Panel
              title="Account security"
              subtitle="Supabase manages account verification, sessions and secure password updates."
            >
              <div className="security-row">
                <span className="security-icon">
                  <Mail />
                </span>
                <div>
                  <b>Verified email</b>
                  <small>{user?.email || "Not available"}</small>
                </div>
                <Tag tone={user?.email_confirmed_at ? "green" : "amber"}>
                  {user?.email_confirmed_at
                    ? "Verified"
                    : "Pending verification"}
                </Tag>
              </div>
              <div className="security-row">
                <span className="security-icon">
                  <KeyRound />
                </span>
                <div>
                  <b>Password</b>
                  <small>Request a secure reset link by email.</small>
                </div>
                <button
                  className="button button-secondary"
                  onClick={() => void resetPassword()}
                >
                  Send reset link <ArrowRight size={13} />
                </button>
              </div>
              <div className="security-row">
                <span className="security-icon">
                  <LockKeyhole />
                </span>
                <div>
                  <b>Private interview data</b>
                  <small>
                    Rows are protected by Supabase RLS and an authenticated
                    account token.
                  </small>
                </div>
                <Tag tone="green">Row-level security</Tag>
              </div>
            </Panel>
          )}
          {tab === "Appearance" && (
            <Panel
              title="Appearance"
              subtitle="Dark is the default. System follows your device's appearance setting."
            >
              <div className="appearance-options">
                {[
                  {
                    key: "dark",
                    label: "Dark",
                    detail: "Quiet, focused workspace",
                    preview: "appearance-dark",
                  },
                  {
                    key: "system",
                    label: "System",
                    detail: "Follow your device preference",
                    preview: "appearance-system",
                  },
                ].map(x => (
                  <button
                    type="button"
                    className={`appearance-option ${form.theme_preference === x.key ? "selected" : ""}`}
                    key={x.key}
                    onClick={() => {
                      change("theme_preference", x.key);
                      setTheme(x.key as "dark" | "system");
                    }}
                  >
                    <span className={`appearance-preview ${x.preview}`}>
                      <i />
                      <i />
                      <i />
                    </span>
                    <b>{x.label}</b>
                    <small>{x.detail}</small>
                    <span className="appearance-check">
                      {form.theme_preference === x.key ? (
                        <Check size={12} />
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
          )}
          {tab === "AI Preferences" && (
            <Panel
              title="Practice preferences"
              subtitle="Tune the coach to your preparation style."
            >
              <label className="preference-select">
                Default difficulty
                <select
                  className="field"
                  value={form.default_difficulty}
                  onChange={e => change("default_difficulty", e.target.value)}
                >
                  {["Easy", "Medium", "Hard", "Expert"].map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="preference-select">
                Feedback detail
                <select
                  className="field"
                  value={form.feedback_detail}
                  onChange={e => change("feedback_detail", e.target.value)}
                >
                  {["Concise", "Balanced", "Detailed"].map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <ToggleRow
                title="Enable voice practice"
                description="Voice transcription is browser-provided and optional; text always works."
                checked={form.voice_enabled}
                onClick={() => change("voice_enabled", !form.voice_enabled)}
              />
              <label className="preference-select">
                Preferred language
                <select
                  className="field"
                  value={form.language}
                  onChange={e => change("language", e.target.value)}
                >
                  {["English", "Hindi", "Hinglish"].map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <div className="notice notice-warning">
                AI feedback is educational preparation—not a hiring decision or
                guarantee. Medical responses do not provide diagnosis or
                treatment advice.
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
function ToggleRow({
  title,
  description,
  checked,
  onClick,
}: {
  title: string;
  description: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <div className="toggle-row">
      <div>
        <b>{title}</b>
        <small>{description}</small>
      </div>
      <button
        type="button"
        className={`toggle ${checked ? "on" : ""}`}
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={onClick}
      >
        {checked ? <ToggleRight size={0} /> : <ToggleLeft size={0} />}
      </button>
    </div>
  );
}

type Field = {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
};
type Catalog = {
  key: string;
  table: string;
  label: string;
  fields: Field[];
  select: string;
  defaultOrder?: string;
};
const catalogConfig: Catalog[] = [
  {
    key: "categories",
    table: "course_categories",
    label: "Course families",
    select: "id,slug,name,sort_order,active",
    fields: [
      { key: "name", label: "Category name", required: true },
      { key: "slug", label: "Slug", required: true },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
  },
  {
    key: "courses",
    table: "courses",
    label: "Courses",
    select: "id,slug,name,level,category_id,active",
    fields: [
      { key: "name", label: "Course name", required: true },
      { key: "slug", label: "Slug", required: true },
      {
        key: "category_id",
        label: "Course family",
        type: "select",
        required: true,
      },
      { key: "level", label: "Level", placeholder: "Undergraduate / Diploma" },
    ],
  },
  {
    key: "specializations",
    table: "specializations",
    label: "Specializations",
    select: "id,name,course_id,active",
    fields: [
      {
        key: "course_id",
        label: "Course",
        type: "select",
        options: [],
        required: true,
      },
      { key: "name", label: "Specialization", required: true },
    ],
  },
  {
    key: "course_skills",
    table: "course_skills",
    label: "Course skill requirements",
    select:
      "id,course_id,skill_id,required_score,active,course:courses(name),skill:skills(name)",
    fields: [
      { key: "course_id", label: "Course", type: "select", required: true },
      { key: "skill_id", label: "Skill", type: "select", required: true },
      {
        key: "required_score",
        label: "Required score (0–100)",
        type: "number",
        required: true,
      },
    ],
  },
  {
    key: "careers",
    table: "careers",
    label: "Career paths",
    select: "id,name,description,course_category_id,active",
    fields: [
      { key: "name", label: "Career name", required: true },
      { key: "description", label: "Description" },
      { key: "course_category_id", label: "Course family", type: "select" },
    ],
  },
  {
    key: "roles",
    table: "job_roles",
    label: "Job roles",
    select: "id,name,category,career_id,interview_types,active",
    fields: [
      { key: "name", label: "Job role", required: true },
      {
        key: "category",
        label: "Discipline/category slug",
        type: "select",
        required: true,
      },
      { key: "career_id", label: "Career path", type: "select" },
      {
        key: "interview_types",
        label: "Interview types (comma-separated)",
        placeholder: "Technical, Domain, HR",
      },
    ],
  },
  {
    key: "role_skills",
    table: "role_skills",
    label: "Role skill requirements",
    select:
      "id,role_id,skill_id,required_score,active,role:job_roles(name),skill:skills(name)",
    fields: [
      { key: "role_id", label: "Job role", type: "select", required: true },
      { key: "skill_id", label: "Skill", type: "select", required: true },
      {
        key: "required_score",
        label: "Required score (0–100)",
        type: "number",
        required: true,
      },
    ],
  },
  {
    key: "skills",
    table: "skills",
    label: "Skills",
    select: "id,slug,name,category,description,active",
    fields: [
      { key: "name", label: "Skill", required: true },
      { key: "slug", label: "Slug", required: true },
      { key: "category", label: "Discipline/category" },
      { key: "description", label: "Description" },
    ],
  },
  {
    key: "interview_types",
    table: "interview_types",
    label: "Interview types",
    select: "id,slug,name,description,sort_order,active",
    fields: [
      { key: "name", label: "Type", required: true },
      { key: "slug", label: "Slug", required: true },
      { key: "description", label: "Description" },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
  },
  {
    key: "question_categories",
    table: "question_categories",
    label: "Question categories",
    select: "id,slug,name,description,sort_order,active",
    fields: [
      { key: "name", label: "Category", required: true },
      { key: "slug", label: "Slug", required: true },
      { key: "description", label: "Description" },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
  },
  {
    key: "question_bank",
    table: "question_bank",
    label: "Question bank",
    select:
      "id,course_category,course_names,topic,question_category,question_text,role,interview_type,difficulty,active",
    fields: [
      {
        key: "course_category",
        label: "Course family",
        type: "select",
        required: true,
      },
      {
        key: "course_names",
        label: "Course names (comma-separated)",
        required: true,
      },
      { key: "topic", label: "Topic", required: true },
      {
        key: "question_category",
        label: "Question category",
        type: "select",
        required: true,
      },
      {
        key: "question_text",
        label: "Question",
        type: "textarea",
        required: true,
      },
      { key: "role", label: "Target role", type: "select" },
      {
        key: "interview_type",
        label: "Interview type",
        type: "select",
        required: true,
      },
      {
        key: "difficulty",
        label: "Difficulty",
        type: "select",
        required: true,
      },
    ],
  },
  {
    key: "evaluation_criteria",
    table: "evaluation_criteria",
    label: "Evaluation criteria",
    select:
      "id,scope_type,scope_name,interview_type,name,description,weight,active",
    fields: [
      {
        key: "scope_type",
        label: "Scope",
        type: "select",
        options: ["global", "course", "role", "interview_type"].map(x => ({
          value: x,
          label: x,
        })),
      },
      {
        key: "scope_name",
        label: "Scope name",
        placeholder: "General / Mechanical / Financial Analyst",
        required: true,
      },
      {
        key: "interview_type",
        label: "Interview type",
        type: "select",
      },
      { key: "name", label: "Criterion", required: true },
      { key: "description", label: "Description" },
      { key: "weight", label: "Weight", type: "number" },
    ],
  },
  {
    key: "difficulty_levels",
    table: "difficulty_levels",
    label: "Difficulty levels",
    select: "id,slug,name,description,sort_order,active",
    fields: [
      { key: "name", label: "Difficulty", required: true },
      { key: "slug", label: "Slug", required: true },
      { key: "description", label: "Description" },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
  },
];

export function AdminPage() {
  const access = trpc.admin.access.useQuery(undefined, { retry: false });
  const manualRefresh = trpc.admin.refreshQuestionBank.useMutation();
  const [section, setSection] = useState("overview");
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [configOptions, setConfigOptions] = useState<
    Record<string, { value: string; label: string }[]>
  >({});
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modal, setModal] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const catalog = catalogConfig.find(c => c.key === section);
  async function fetchOptions() {
    const c = await getSupabase();
    const data = await Promise.all(
      [
        c.from("course_categories").select("id,name,slug"),
        c.from("courses").select("id,name,slug"),
        c.from("careers").select("id,name"),
        c.from("job_roles").select("id,name"),
        c.from("skills").select("id,name,slug"),
        c.from("question_categories").select("id,name,slug"),
        c.from("interview_types").select("id,name,slug"),
        c.from("difficulty_levels").select("id,name,slug"),
      ].map(query => query.eq("active", true).order("name").limit(500))
    );
    const failed = data.find(result => result.error);
    if (failed?.error) throw failed.error;
    const opts = (i: number, key: "id" | "slug" | "name" = "id") =>
      (data[i].data || [])
        .map((x: any) => ({ value: x[key], label: x.name }))
        .filter((option: { value?: string }) => Boolean(option.value));
    setConfigOptions({
      course_categories: opts(0),
      category_id: opts(0),
      course_category_id: opts(0),
      course_category: opts(0, "slug"),
      category: opts(0, "slug"),
      courses: opts(1),
      course_id: opts(1),
      careers: opts(2),
      career_id: opts(2),
      roles: opts(3),
      role_id: opts(3),
      skills: opts(4),
      skill_id: opts(4),
      question_categories: opts(5),
      question_category: opts(5, "name"),
      interview_types: opts(6),
      interview_type: opts(6, "name"),
      difficulty_levels: opts(7),
      difficulty: opts(7, "name"),
    });
  }
  function optionsFor(field: Field) {
    return field.options?.length
      ? field.options
      : configOptions[field.key] || [];
  }
  async function loadOverview() {
    const c = await getSupabase();
    const [statsResult, userResult] = await Promise.all([
      c.rpc("admin_dashboard_stats"),
      c.rpc("admin_user_directory"),
    ]);
    if (statsResult.error) throw statsResult.error;
    if (userResult.error) throw userResult.error;
    setStats(statsResult.data);
    setUsers(userResult.data || []);
  }
  const loadCatalog = useCallback(async () => {
    if (!catalog) return;
    const c = await getSupabase();
    const { data, error: e } = await c
      .from(catalog.table)
      .select(catalog.select)
      .limit(catalog.key === "question_bank" ? 150 : 500);
    if (e) throw e;
    setRows(data || []);
  }, [catalog]);
  useEffect(() => {
    if (access.isLoading) return;
    if (access.error) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        await Promise.all([fetchOptions(), loadOverview()]);
      } catch {
        setError(
          "Admin reporting is unavailable. Sign in with the project administrator account and apply the database migrations."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [access.isLoading, access.error]);
  useEffect(() => {
    if (catalog)
      void loadCatalog().catch(() =>
        setError(
          "This catalog isn't available. Apply the catalog migrations and confirm admin access."
        )
      );
  }, [catalog, loadCatalog]);
  async function reload() {
    setBusy(true);
    setError("");
    try {
      if (section === "users") await loadOverview();
      else if (section === "overview")
        await Promise.all([loadOverview(), fetchOptions()]);
      else await loadCatalog();
    } catch {
      setError("We couldn't refresh this admin view.");
    } finally {
      setBusy(false);
    }
  }
  async function runQuestionBankRefresh() {
    setRefreshing(true);
    setError("");
    setSuccess("");
    try {
      const result = await manualRefresh.mutateAsync();
      const inserted = Number(result.inserted) || 0;
      setSuccess(
        inserted
          ? `Question-bank refresh completed. ${inserted} new question${inserted === 1 ? " was" : "s were"} added; existing questions were retained.`
          : "Question-bank refresh completed. No new questions were inserted; existing questions were retained."
      );
      await loadCatalog().catch(() =>
        setError(
          "The refresh completed, but the question list could not be reloaded. Use Refresh to try again."
        )
      );
      void loadOverview().catch(() => undefined);
    } catch {
      setError(
        "The question-bank refresh could not finish. Existing questions remain available; try again later."
      );
    } finally {
      setRefreshing(false);
    }
  }
  function openAdd() {
    const next: Record<string, string> = {};
    catalog?.fields.forEach(f => {
      next[f.key] = "";
    });
    setValues(next);
    setModal(true);
  }
  function slugify(s: string) {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!catalog) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const obj: Record<string, any> = { active: true };
      for (const field of catalog.fields) {
        const v = values[field.key]?.trim();
        if (!v && field.required) throw new Error("REQUIRED");
        if (!v) continue;
        if (field.key === "course_names" || field.key === "interview_types")
          obj[field.key] = v
            .split(",")
            .map(x => x.trim())
            .filter(Boolean);
        else if (field.type === "number") obj[field.key] = Number(v);
        else obj[field.key] = v;
      }
      if (catalog.key === "courses" && !obj.slug) obj.slug = slugify(obj.name);
      if (catalog.key === "skills" && !obj.slug) obj.slug = slugify(obj.name);
      if (
        catalog.key === "question_categories" ||
        catalog.key === "interview_types" ||
        catalog.key === "difficulty_levels"
      )
        if (!obj.slug) obj.slug = slugify(obj.name);
      if (catalog.key === "question_bank" && !obj.course_names)
        obj.course_names = [];
      const c = await getSupabase();
      const { error: e } = await c.from(catalog.table).insert(obj);
      if (e) throw e;
      setModal(false);
      await loadCatalog();
      await fetchOptions();
      setSuccess(
        `${catalog.label.slice(0, -1) || catalog.label} added to the database. The app can read it without a frontend change.`
      );
    } catch (e) {
      setError(
        e instanceof Error && e.message === "REQUIRED"
          ? "Fill in all required fields."
          : "This catalog item couldn't be saved. Check for duplicate slugs or missing required data."
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggleActive(row: any) {
    if (!catalog) return;
    const c = await getSupabase();
    const { error: e } = await c
      .from(catalog.table)
      .update({ active: !row.active })
      .eq("id", row.id);
    if (e) setError("We couldn't update the catalog item.");
    else
      setRows(r =>
        r.map(x => (x.id === row.id ? { ...x, active: !x.active } : x))
      );
  }
  async function changeUserRole(u: any) {
    setError("");
    setSuccess("");
    const role = u.role === "admin" ? "user" : "admin";
    if (u.id === access.data?.userId && role === "user") {
      setError("You cannot remove your own administrator access.");
      return;
    }
    const c = await getSupabase();
    const { error: e } = await c.rpc("admin_set_user_role", {
      target_user: u.id,
      new_role: role,
    });
    if (e)
      setError(
        "That role change wasn't accepted. Only authorized administrators can update roles."
      );
    else {
      setUsers(all => all.map(x => (x.id === u.id ? { ...x, role } : x)));
      setSuccess(`${u.full_name || u.email} is now ${role}.`);
    }
  }
  if (access.isLoading || loading)
    return <LoadingState text="Checking administrator access…" />;
  if (access.error)
    return (
      <div className="page-stack">
        <PageHeading
          eyebrow="RESTRICTED AREA"
          title="Administrator access required."
          description="Platform analytics and catalog management are available to designated administrators only."
        />
        <Panel>
          <div className="admin-denied">
            <Shield size={34} />
            <b>Your account doesn't have administrator access.</b>
            <p>
              Ask the project owner to promote the designated account using the
              one-time instructions in the deployment handoff. No private
              interview answers are exposed through this page.
            </p>
            <Link href="/app" className="button button-secondary">
              Return to workspace <ArrowRight size={13} />
            </Link>
          </div>
        </Panel>
      </div>
    );
  if (loading) return <LoadingState text="Loading admin console…" />;
  const menu = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "User accounts", icon: Users },
    ...catalogConfig.map(c => ({
      id: c.key,
      label: c.label,
      icon: c.key.includes("question")
        ? BookOpen
        : c.key.includes("course")
          ? GraduationCap
          : c.key === "skills"
            ? Target
            : Settings,
    })),
  ];
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="PLATFORM ADMINISTRATION"
        title="Manage the learning system."
        description="Aggregate platform insights and database-driven catalogs. Private interview answers and resume text stay owner-only."
        action={
          <Tag tone="violet">
            <Shield size={11} /> Administrator
          </Tag>
        }
      />
      {error && <div className="notice notice-error">{error}</div>}
      {success && <div className="notice notice-success">{success}</div>}
      <div className="admin-layout">
        <nav className="admin-tabs" aria-label="Admin sections">
          {menu.map(({ id, label, icon: Icon }) => (
            <button
              className={section === id ? "active" : ""}
              key={id}
              onClick={() => {
                setSection(id);
                setError("");
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-view">
          {section === "overview" && (
            <>
              <div className="metric-cards admin-metrics">
                <StatTile
                  icon={Users}
                  label="Total users"
                  value={Number(stats?.total_users || 0)}
                  tone="cyan"
                />
                <StatTile
                  icon={Activity}
                  label="Active users · 30d"
                  value={Number(stats?.active_users_30d || 0)}
                  tone="violet"
                />
                <StatTile
                  icon={Mic2}
                  label="Interviews"
                  value={Number(stats?.interviews || 0)}
                  tone="blue"
                />
                <StatTile
                  icon={BookOpen}
                  label="Question bank"
                  value={Number(stats?.questions || 0)}
                  tone="green"
                />
                <StatTile
                  icon={BarChart3}
                  label="Average score"
                  value={`${Number(stats?.average_score || 0)}%`}
                  tone="amber"
                />
                <StatTile
                  icon={Check}
                  label="Completion rate"
                  value={`${Number(stats?.completion_rate || 0)}%`}
                  tone="green"
                />
              </div>
              <div className="admin-chart-grid">
                <Panel
                  title="Practice activity · 14 days"
                  subtitle="Session counts only—no answer text or per-user performance is shown."
                >
                  <ResponsiveContainer width="100%" height={225}>
                    <BarChart data={stats?.usage_14d || []}>
                      <CartesianGrid stroke="#ffffff10" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tickFormatter={(v: string) =>
                          new Date(v).toLocaleDateString(undefined, {
                            month: "numeric",
                            day: "numeric",
                          })
                        }
                        tick={{ fill: "#7d8ba0", fontSize: 8 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#718097", fontSize: 8 }}
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
                      <Bar
                        dataKey="sessions"
                        fill="#67dff6"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel
                  title="Popular target roles"
                  subtitle="Aggregated session counts."
                >
                  <div className="admin-popular-list">
                    {(stats?.popular_roles || []).map((x: any, i: number) => (
                      <div key={x.role}>
                        <span className="popular-rank">0{i + 1}</span>
                        <b>{x.role}</b>
                        <span>{x.count}</span>
                      </div>
                    ))}
                  </div>
                  {!stats?.popular_roles?.length && (
                    <p className="muted-small">No sessions yet.</p>
                  )}
                </Panel>
              </div>
              <div className="admin-chart-grid">
                <Panel
                  title="Common improvement areas"
                  subtitle="Aggregated current skill-gap scores; lowest averages first."
                >
                  {(stats?.weak_areas || []).map((x: any) => (
                    <div className="admin-weak-row" key={x.skill}>
                      <span>{x.skill}</span>
                      <ProgressBar
                        value={Number(x.average_score) || 0}
                        color="amber"
                      />
                      <b>{x.average_score}</b>
                      <small>{x.learners} learners</small>
                    </div>
                  ))}
                  {!stats?.weak_areas?.length && (
                    <p className="muted-small">
                      No skill-gap data has been generated yet.
                    </p>
                  )}
                </Panel>
                <Panel
                  title="Readiness evaluation"
                  subtitle="This project currently uses a transparent baseline only."
                >
                  <p className="model-wait">
                    Model evaluation will populate after training.
                  </p>
                  <p className="muted-small">
                    Accuracy, precision, recall, F1 and confusion matrix are
                    withheld until computed from a genuinely trained model.
                  </p>
                </Panel>
              </div>
            </>
          )}
          {section === "users" && (
            <Panel
              title="Limited user directory"
              subtitle="Name, verified email, course and role only. Interview answers, reports and private resume text remain owner-only."
            >
              <div className="table-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>ACCOUNT</th>
                      <th>COURSE / ROLE</th>
                      <th>JOINED</th>
                      <th>ACCESS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <b>{u.full_name || "Candidate"}</b>
                          <br />
                          <span>{u.email || "No email"}</span>
                        </td>
                        <td>
                          {u.course || "Course not set"}
                          <br />
                          <span>{u.target_role || "Role not set"}</span>
                        </td>
                        <td>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          <button
                            className="button button-secondary"
                            onClick={() => void changeUserRole(u)}
                          >
                            {u.role === "admin" ? "Demote admin" : "Make admin"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!users.length && (
                <EmptyState
                  title="No signed-up learners yet."
                  description="Verified accounts are listed here after profile creation."
                />
              )}
            </Panel>
          )}
          {catalog && (
            <Panel
              title={`Manage ${catalog.label.toLowerCase()}`}
              subtitle="Changes are stored in PostgreSQL. Future selector reads use the catalog tables rather than hard-coded entries."
              action={
                <div className="admin-catalog-actions">
                  {catalog.key === "question_bank" && (
                    <button
                      className="button button-secondary"
                      onClick={() => void runQuestionBankRefresh()}
                      disabled={refreshing}
                    >
                      {refreshing ? "Refreshing questions…" : "Refresh question bank"}
                    </button>
                  )}
                  <button className="button button-primary" onClick={openAdd}>
                    <Plus size={14} /> Add {catalog.label.replace(/s$/i, "")}
                  </button>
                </div>
              }
            >
              <div className="catalog-count">
                {rows.length} items{" "}
                <button
                  className="button button-ghost"
                  onClick={() => void reload()}
                  disabled={busy}
                >
                  {busy ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              <div className="catalog-list">
                {rows.map(row => (
                  <div
                    className={`catalog-row ${row.active === false ? "inactive" : ""}`}
                    key={row.id}
                  >
                    <div>
                      <b>
                        {row.name ||
                          row.question_text ||
                          row.title ||
                          row.topic}
                      </b>
                      <small>
                        {row.question_text
                          ? `${row.course_category} · ${row.interview_type} · ${row.difficulty}`
                          : row.question_category
                            ? `${row.topic} · ${row.course_names?.join(", ")}`
                            : row.scope_type
                              ? `${row.scope_type}: ${row.scope_name} · ${row.interview_type}`
                              : row.slug
                                ? `${row.slug} · ${row.category || row.level || ""}`
                                : row.description || row.course_id || ""}
                      </small>
                    </div>
                    <Tag tone={row.active === false ? "amber" : "green"}>
                      {row.active === false ? "Archived" : "Active"}
                    </Tag>
                    <button
                      className="button button-ghost"
                      onClick={() => void toggleActive(row)}
                    >
                      {row.active === false ? "Reactivate" : "Archive"}
                    </button>
                  </div>
                ))}
              </div>
              {!rows.length && (
                <EmptyState
                  title="This catalog is empty."
                  description="Add the first entry to make it available to learners."
                />
              )}
            </Panel>
          )}
        </div>
      </div>
      {modal && catalog && (
        <div
          className="simple-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Add ${catalog.label}`}
        >
          <form className="simple-modal-card" onSubmit={addItem}>
            <div className="simple-modal-head">
              <div>
                <span className="eyebrow">CATALOG MANAGEMENT</span>
                <h3>Add to {catalog.label}</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setModal(false)}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
            <div className="catalog-form">
              {catalog.fields.map(f => {
                const options = optionsFor(f);
                return (
                  <label
                    className={f.type === "textarea" ? "full" : ""}
                    key={f.key}
                  >
                    {f.label}
                    {f.type === "textarea" ? (
                      <textarea
                        className="field"
                        rows={4}
                        required={f.required}
                        placeholder={f.placeholder}
                        value={values[f.key] || ""}
                        onChange={e =>
                          setValues(v => ({ ...v, [f.key]: e.target.value }))
                        }
                      />
                    ) : f.type === "select" ? (
                      <select
                        className="field"
                        required={f.required}
                        value={values[f.key] || ""}
                        onChange={e =>
                          setValues(v => ({ ...v, [f.key]: e.target.value }))
                        }
                      >
                        <option value="">Select {f.label.toLowerCase()}</option>
                        {options.map(option => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="field"
                        type={f.type === "number" ? "number" : "text"}
                        required={f.required}
                        placeholder={f.placeholder}
                        value={values[f.key] || ""}
                        onChange={e =>
                          setValues(v => ({ ...v, [f.key]: e.target.value }))
                        }
                      />
                    )}
                  </label>
                );
              })}
            </div>
            <div className="catalog-form-note">
              Catalogs store user-supplied content. Keep question prompts
              constructive and relevant.
            </div>
            <div className="catalog-form-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setModal(false)}
              >
                Cancel
              </button>
              <button className="button button-primary" disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner" /> Saving…
                  </>
                ) : (
                  <>
                    Save to catalog <Save size={13} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function InsightsPage() {
  const aiFlow = [
    "User",
    "Resume",
    "Profile",
    "Question Generator",
    "Interview",
    "Answer",
    "NLP / AI Evaluation",
    "Performance Engine",
    "Skill Gap",
    "Personalized Plan",
  ];
  const mlFlow = [
    "Historical Interview Data",
    "Feature Engineering",
    "Model",
    "Training",
    "Validation",
    "Prediction",
    "Readiness Score",
  ];
  const sections = [
    [
      "01 · Overview",
      "SMART INTERVIEW is a course-aware interview-practice application. It connects candidate context, resume evidence, practice responses and skill feedback into a repeatable learning loop.",
    ],
    [
      "02 · Problem statement",
      "Generic question lists rarely reflect a student's academic discipline or target job. Candidates also lack clear, actionable feedback and a reliable way to track preparation progress.",
    ],
    [
      "03 · Objectives",
      "Support multiple courses and career paths; deliver realistic mock interviews; provide structured, evidence-based feedback; protect private candidate data; and convert weak signals into useful study steps.",
    ],
    [
      "04 · AI architecture",
      "AI question generation, answer evaluation, resume/JD comparison, explanations, interview summaries and study plans run through server-side structured-output functions. Candidate text is treated as untrusted input; AI suggestions are educational and non-discriminatory.",
    ],
    [
      "05 · Database design",
      "Supabase PostgreSQL stores normalized profiles, course catalogs, skills, sessions, questions, answers, evaluations, reports, resume metadata, job descriptions, performance, skill gaps, plans, bookmarks, notifications and transparent baseline predictions. RLS binds learner records to the authenticated user.",
    ],
    [
      "06 · Technology stack",
      "React, TypeScript, Vite, Tailwind CSS, Express, tRPC, Supabase Auth, Supabase PostgreSQL / PostgREST / Storage, Gemini API, Zod and Recharts. Browser speech recognition is optional and has a text fallback.",
    ],
    [
      "07 · AI workflow",
      "Course, specialization, experience, role, skills, language and optional resume/JD context inform questions. Submitted responses are evaluated against relevant course and interview-type criteria; the user sees a structured report and can practice a focused next step.",
    ],
    [
      "08 · ML workflow",
      "The current readiness estimator is a transparent baseline over genuine saved practice scores and is explicitly not a trained predictive model. The model interface can later consume permissioned history, train/validate a classifier and publish only audited evaluation outputs.",
    ],
    [
      "09 · Model evaluation",
      "Model evaluation will populate after training. No fabricated accuracy, precision, recall, F1 score or confusion matrix is displayed. Readiness labels describe preparation evidence only; they are not employment probabilities.",
    ],
    [
      "10 · Security",
      "Supabase Auth verifies bearer tokens on the server. Per-user operations use the user's access token with PostgreSQL RLS. Resume bucket access is private and path-scoped; environment credentials never enter frontend source. Admin aggregates exclude answer text; catalog writes require a database-backed admin role.",
    ],
    [
      "11 · Limitations",
      "Voice transcription depends on browser support and microphone permission. Resume extraction reads text-based PDFs and DOCX; scanned image-only documents require OCR. Career and interview feedback is an estimate for practice, not a hiring decision. Demo cohorts are synthetic and separately labeled.",
    ],
    [
      "12 · Future scope",
      "Train and validate interpretable readiness models after obtaining appropriately consented data; expand localization and domain rubrics; add OCR with clear consent; benchmark structured AI outputs; and integrate certifications and curated learning resources.",
    ],
  ];
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="FINAL-YEAR PROJECT INSIGHTS"
        title="A clear view of how the system works."
        description="Architecture, workflows, privacy boundaries and limitations for the SMART INTERVIEW project."
        action={<Tag tone="cyan">Architecture notes</Tag>}
      />
      <Panel
        title="AI personalization & feedback pipeline"
        subtitle="The generative pipeline is distinct from the readiness baseline; calls stay server-side."
      >
        <div className="insight-flow">
          {aiFlow.map((x, i) => (
            <div className="flow-wrap" key={x}>
              <div className="flow-node">
                <span>0{i + 1}</span>
                {x}
              </div>
              {i < aiFlow.length - 1 && (
                <ArrowRight className="flow-arrow" size={14} />
              )}
            </div>
          ))}
        </div>
      </Panel>
      <Panel
        title="Transparent ML readiness pipeline"
        subtitle="No model-evaluation numbers appear until a real model is trained and validated."
      >
        <div className="insight-flow ml-flow">
          {mlFlow.map((x, i) => (
            <div className="flow-wrap" key={x}>
              <div className="flow-node ml-flow-node">
                <span>0{i + 1}</span>
                {x}
              </div>
              {i < mlFlow.length - 1 && (
                <ArrowRight className="flow-arrow" size={14} />
              )}
            </div>
          ))}
        </div>
        <div className="notice notice-warning">
          Model evaluation will populate after training. The present readiness
          signal is a transparent baseline calculated from completed interview
          sessions.
        </div>
      </Panel>
      <div className="insight-section-grid">
        {sections.map(([title, text]) => (
          <Panel key={title} className="insight-section">
            <span className="eyebrow">{title}</span>
            <p>{text}</p>
          </Panel>
        ))}
      </div>
      <Panel
        title="Core persistent entities"
        subtitle="Learner data is protected by RLS; catalogs are public-read/admin-write; admin reporting functions expose aggregate-only views."
      >
        <div className="stack-grid">
          {[
            "profiles & auth users",
            "courses & specializations",
            "careers & job roles",
            "skills & role requirements",
            "interview sessions / questions / answers",
            "answer evaluations & reports",
            "private resumes & analyses",
            "job descriptions & matches",
            "performance metrics & skill gaps",
            "study plans & activities",
            "question bank & catalogs",
            "bookmarks / notifications / predictions",
          ].map(x => (
            <div className="stack-item" key={x}>
              <b>{x}</b>
              <span>PostgreSQL · foreign keys · ownership policies</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
