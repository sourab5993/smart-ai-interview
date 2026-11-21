import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Bookmark,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CircleHelp,
  Clock3,
  FileSearch,
  Filter,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UploadCloud,
  X,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import {
  courseGroups,
  difficulties,
  interviewTypes,
  roleOptions,
} from "@/data/taxonomy";
import {
  EmptyState,
  LoadingState,
  PageHeading,
  Panel,
  ProgressBar,
  Tag,
} from "@/components/app/Shared";
import { extractResumeText, resumeFileError } from "@/lib/resume";
import { notifyUser } from "@/lib/notifications";

type BankQuestion = {
  id: string;
  course_category: string;
  question_category: string;
  course_names: string[];
  topic: string;
  question_text: string;
  role: string;
  interview_type: string;
  difficulty: string;
  active: boolean;
  source?: "bank" | "ai";
};
type Profile = {
  course: string;
  specialization: string;
  semester: string;
  target_role: string;
  target_career: string;
  language: string;
  skills: string[];
};

export function QuestionsPage() {
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [generatedQuestions, setGeneratedQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("All disciplines");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [difficultyFilter, setDifficultyFilter] = useState("All levels");
  const [saved, setSaved] = useState(new Set<string>());
  const [selected, setSelected] = useState(new Set<string>());
  const [explanation, setExplanation] = useState<any>(null);
  const [explainBusy, setExplainBusy] = useState(false);
  const [, navigate] = useLocation();
  const explain = trpc.ai.explain.useMutation();
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [difficultyOptions, setDifficultyOptions] = useState<string[]>([]);
  const [generateCourse, setGenerateCourse] = useState("");
  const [generateRole, setGenerateRole] = useState("");
  const [generateBusy, setGenerateBusy] = useState(false);
  const generate = trpc.ai.generateQuestions.useMutation();
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let live = true;
    void (async () => {
      try {
        const c = await getSupabase();
        const [q, b, p, cats, types, diffs] = await Promise.all([
          c
            .from("question_bank")
            .select(
              "id,course_category,question_category,course_names,topic,question_text,role,interview_type,difficulty,active"
            )
            .eq("active", true)
            .order("course_category")
            .order("topic")
            .limit(300),
          c
            .from("bookmarks")
            .select("target_id")
            .eq("owner_id", userId)
            .eq("target_type", "question"),
          c
            .from("profiles")
            .select(
              "course,specialization,semester,target_role,target_career,language,skills"
            )
            .eq("id", userId)
            .maybeSingle(),
          c
            .from("question_categories")
            .select("name")
            .eq("active", true)
            .order("sort_order")
            .limit(100),
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
        ]);
        if (!live) return;
        if (q.error) throw q.error;
        setQuestions((q.data || []) as BankQuestion[]);
        setSaved(new Set((b.data || []).map((x: any) => x.target_id)));
        const currentProfile = p.data as Profile | null;
        setProfile(currentProfile);
        setGenerateCourse(
          currentProfile?.course || currentProfile?.specialization || ""
        );
        setGenerateRole(currentProfile?.target_role || "");
        setCategoryOptions(
          Array.from(
            new Set([
              ...(cats.data || []).map((x: any) => x.name),
              ...(q.data || []).map(
                (x: any) => x.question_category || "Conceptual"
              ),
            ])
          )
        );
        setTypeOptions(
          Array.from(
            new Set([
              ...(types.data || []).map((x: any) => x.name),
              ...interviewTypes,
            ])
          )
        );
        setDifficultyOptions(
          Array.from(
            new Set([
              ...(diffs.data || []).map((x: any) => x.name),
              ...difficulties,
            ])
          )
        );
        if (currentProfile?.specialization)
          setCourseFilter(currentProfile.specialization);
        else if (currentProfile?.course) setCourseFilter(currentProfile.course);
        const initial = new URLSearchParams(window.location.search).get(
          "search"
        );
        if (initial) setSearch(initial);
      } catch {
        if (live)
          setError(
            "The question bank is unavailable right now. Please try again in a moment."
          );
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [userId]);
  const allQuestions = useMemo(
    () => [...generatedQuestions, ...questions],
    [generatedQuestions, questions]
  );
  const courses = useMemo(
    () => [
      "All disciplines",
      ...Array.from(
        new Set([
          ...allQuestions.flatMap(q => q.course_names || []),
          ...(profile?.course ? [profile.course] : []),
          ...(profile?.specialization ? [profile.specialization] : []),
        ])
      ).sort(),
    ],
    [allQuestions, profile?.course, profile?.specialization]
  );
  const roles = useMemo(
    () => [
      "All roles",
      ...Array.from(new Set(allQuestions.map(q => q.role).filter(Boolean))).sort(),
    ],
    [allQuestions]
  );
  const visible = allQuestions.filter(
    q =>
      (courseFilter === "All disciplines" ||
        (q.course_names || []).some(
          c =>
            c.toLowerCase().includes(courseFilter.toLowerCase()) ||
            courseFilter.toLowerCase().includes(c.toLowerCase())
        ) ||
        q.course_category === courseFilter.toLowerCase() ||
        q.course_category ===
          courseFilter
            .toLowerCase()
            .replaceAll(" & ", "-")
            .replaceAll(" ", "-")) &&
      (categoryFilter === "All categories" ||
        q.question_category === categoryFilter) &&
      (roleFilter === "All roles" || q.role === roleFilter) &&
      (typeFilter === "All types" || q.interview_type === typeFilter) &&
      (difficultyFilter === "All levels" ||
        q.difficulty === difficultyFilter) &&
      (!search ||
        `${q.question_text} ${q.topic} ${q.role} ${(q.course_names || []).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()))
  );
  async function generateForCourse() {
    const course = generateCourse.trim() || profile?.course || "Any course";
    const role = generateRole.trim() || profile?.target_role || "General interview role";
    setGenerateBusy(true);
    setError("");
    try {
      const result = await generate.mutateAsync({
        course,
        specialization: profile?.specialization || "",
        semester: profile?.semester || "",
        role,
        type: typeFilter === "All types" ? "Mixed" : typeFilter,
        difficulty: difficultyFilter === "All levels" ? "Medium" : difficultyFilter,
        skills: profile?.skills || [],
        count: 6,
        language: (profile?.language || "English") as "English" | "Hindi" | "Hinglish",
        context: "Generate useful interview practice for any academic or professional discipline. Avoid assuming the learner studies computer science.",
      });
      const rows = (result.questions || []).map((item: any, index: number) => ({
        id: `ai-${Date.now()}-${index}`,
        course_category: course.toLowerCase().replaceAll(" ", "-"),
        question_category: "AI generated",
        course_names: [course],
        topic: item.topic || course,
        question_text: item.question,
        role,
        interview_type: typeFilter === "All types" ? "Mixed" : typeFilter,
        difficulty: item.difficulty || (difficultyFilter === "All levels" ? "Medium" : difficultyFilter),
        active: true,
        source: "ai" as const,
      }));
      setGeneratedQuestions(rows);
      setCourseFilter(course);
    } catch {
      setError("Your AI coach could not generate questions right now. Your saved question bank is still available—please retry.");
    } finally {
      setGenerateBusy(false);
    }
  }
  async function toggleBookmark(q: BankQuestion) {
    const c = await getSupabase();
    if (saved.has(q.id)) {
      const { error: e } = await c
        .from("bookmarks")
        .delete()
        .eq("owner_id", user!.id)
        .eq("target_type", "question")
        .eq("target_id", q.id);
      if (!e)
        setSaved(s => {
          const n = new Set(s);
          n.delete(q.id);
          return n;
        });
    } else {
      const { error: e } = await c.from("bookmarks").insert({
        owner_id: user!.id,
        target_type: "question",
        target_id: q.id,
        title: q.question_text,
        detail: `${q.topic} · ${q.role}`,
      });
      if (!e) setSaved(s => new Set(s).add(q.id));
    }
  }
  async function explainQuestion(q: BankQuestion) {
    setExplainBusy(true);
    setExplanation({ question: q, loading: true });
    try {
      const result = await explain.mutateAsync({
        question: q.question_text,
        course: profile?.course || q.course_names?.[0] || "General",
        level: profile?.semester || "Student",
        language: (profile?.language || "English") as
          | "English"
          | "Hindi"
          | "Hinglish",
      });
      setExplanation({ question: q, result });
    } catch {
      setExplanation({
        question: q,
        error: "Your coach couldn't explain that just now. Please try again.",
      });
    } finally {
      setExplainBusy(false);
    }
  }
  async function startSelected(list: BankQuestion[]) {
    if (!list.length || !user) return;
    setError("");
    try {
      const c = await getSupabase();
      const course =
        profile?.course || list[0].course_names?.[0] || "Other / Custom Course";
      const role = profile?.target_role || list[0].role || "Career role";
      const type = list.length === 1 ? list[0].interview_type : "Mixed";
      const difficulty = list[0].difficulty || "Medium";
      const { data: s, error: e } = await c
        .from("interview_sessions")
        .insert({
          owner_id: user.id,
          course,
          specialization: profile?.specialization || "",
          target_career: profile?.target_career || "",
          target_role: role,
          experience_level: "",
          skills: profile?.skills || [],
          interview_type: type,
          difficulty,
          language: profile?.language || "English",
          question_count: list.length,
          duration_minutes: Math.max(5, list.length * 4),
          status: "in_progress",
        })
        .select("id")
        .single();
      if (e || !s) throw e || new Error();
      const { error: qe } = await c.from("interview_questions").insert(
        list.map((q, i) => ({
          owner_id: user.id,
          session_id: s.id,
          question_text: q.question_text,
          topic: q.topic,
          difficulty: q.difficulty,
          rationale: `Question bank · ${q.role}`,
          sort_order: i,
        }))
      );
      if (qe) {
        await c
          .from("interview_sessions")
          .delete()
          .eq("id", s.id)
          .eq("owner_id", user.id);
        throw qe;
      }
      navigate(`/practice/${s.id}`);
    } catch {
      setError(
        "We couldn't create this practice session. Please check the database setup and retry."
      );
    }
  }
  if (loading)
    return <LoadingState text="Loading discipline-aware questions…" />;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="QUESTION BANK"
        title="Find a question worth thinking through."
        description="Explore real prompts across courses, topics, roles and interview types. Each question can become a focused practice session."
        action={<Tag tone="cyan">{allQuestions.length} questions</Tag>}
      />
      {error && <div className="notice notice-error">{error}</div>}
      <Panel className="bank-panel">
        <div className="question-generator">
          <div>
            <span className="eyebrow"><Sparkles size={13} /> AI QUESTION LAB</span>
            <h3>Generate practice for any course</h3>
            <p className="muted-small">Create six focused questions quickly, even when your discipline is not in the seeded bank.</p>
          </div>
          <div className="question-generator-fields">
            <input className="field" value={generateCourse} onChange={e => setGenerateCourse(e.target.value)} placeholder="Course or discipline" aria-label="Course or discipline for generated questions" />
            <input className="field" value={generateRole} onChange={e => setGenerateRole(e.target.value)} placeholder="Target role (optional)" aria-label="Target role for generated questions" />
            <button className="button button-primary" onClick={() => void generateForCourse()} disabled={generateBusy}>
              {generateBusy ? <><LoaderCircle size={14} className="spin" /> Generating…</> : <><Sparkles size={14} /> Generate questions</>}
            </button>
          </div>
        </div>
        <div className="question-toolbar">
          <label className="bank-search">
            <Search size={15} />
            <input
              aria-label="Search questions"
              placeholder="Search a topic, role or question…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <select
            className="field"
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
          >
            <option>All disciplines</option>
            {courses.slice(1).map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            className="field"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option>All categories</option>
            {categoryOptions.map(x => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            className="field"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option>All roles</option>
            {roles.slice(1).map(x => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            className="field"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option>All types</option>
            {typeOptions.map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            className="field"
            value={difficultyFilter}
            onChange={e => setDifficultyFilter(e.target.value)}
          >
            <option>All levels</option>
            {difficultyOptions.map(d => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="bank-result-head">
          <span>
            <Filter size={13} /> {visible.length} result
            {visible.length === 1 ? "" : "s"}
          </span>
          {selected.size > 0 && (
            <button
              className="button button-primary"
              onClick={() =>
                startSelected(questions.filter(q => selected.has(q.id)))
              }
            >
              Build from selected ({selected.size}) <ArrowRight size={13} />
            </button>
          )}
        </div>
        {!visible.length ? (
          <EmptyState
            icon={BookOpen}
            title={
              questions.length
                ? "No questions match these filters."
                : "Question bank is ready for its first seed."
            }
            description={
              questions.length
                ? "Try a different course, topic or difficulty."
                : "The seeded bank appears after the Supabase migration is applied."
            }
          />
        ) : (
          <div className="question-list">
            {visible.map((q, i) => (
              <article key={q.id} className="question-item">
                <div className="question-item-top">
                  <span className="eyebrow">
                    <span className="question-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>{" "}
                    {q.course_category.toUpperCase()} · {q.topic.toUpperCase()}
                  </span>
                  <button
                    className={`bookmark-btn ${saved.has(q.id) ? "saved" : ""}`}
                    onClick={() => void toggleBookmark(q)}
                    aria-label={
                      saved.has(q.id) ? "Remove bookmark" : "Bookmark question"
                    }
                  >
                    <Bookmark
                      size={15}
                      fill={saved.has(q.id) ? "currentColor" : "none"}
                    />
                  </button>
                </div>
                <h3>{q.question_text}</h3>
                <div className="question-item-meta">
                  <Tag tone="cyan">{q.role}</Tag>
                  <Tag>{q.question_category || "Conceptual"}</Tag>
                  <Tag>{q.interview_type}</Tag>
                  <Tag
                    tone={
                      q.difficulty === "Hard" || q.difficulty === "Expert"
                        ? "amber"
                        : "default"
                    }
                  >
                    {q.difficulty}
                  </Tag>
                  <span className="question-courses">
                    {q.course_names?.slice(0, 3).join(" · ")}
                  </span>
                </div>
                <div className="question-item-actions">
                  <button
                    className="button button-secondary"
                    onClick={() => void startSelected([q])}
                  >
                    <PlayIcon /> Practice this question
                  </button>
                  <button
                    className="button button-ghost"
                    onClick={() => void explainQuestion(q)}
                    disabled={explainBusy}
                  >
                    <Sparkles size={13} /> Explain with AI
                  </button>
                  <label className="select-for-custom">
                    <input
                      type="checkbox"
                      checked={selected.has(q.id)}
                      onChange={() =>
                        setSelected(s => {
                          const n = new Set(s);
                          if (n.has(q.id)) n.delete(q.id);
                          else n.add(q.id);
                          return n;
                        })
                      }
                    />{" "}
                    Add to interview
                  </label>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
      {explanation && (
        <div
          className="simple-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Question explanation"
        >
          <div className="simple-modal-card">
            <div className="simple-modal-head">
              <div>
                <span className="eyebrow">
                  <Sparkles size={13} /> AI QUESTION EXPLANATION
                </span>
                <h3>{explanation.question.topic}</h3>
              </div>
              <button
                className="icon-button"
                aria-label="Close explanation"
                onClick={() => setExplanation(null)}
              >
                <X size={17} />
              </button>
            </div>
            <blockquote className="explain-question-text">
              {explanation.question.question_text}
            </blockquote>
            {explanation.loading || explainBusy ? (
              <LoadingState text="Preparing a course-level explanation…" />
            ) : explanation.error ? (
              <div className="notice notice-error">{explanation.error}</div>
            ) : (
              explanation.result && (
                <div className="explanation-content">
                  <h4>{explanation.result.concept}</h4>
                  <p>{explanation.result.simple_explanation}</p>
                  <h4>Approach</h4>
                  <p>{explanation.result.approach}</p>
                  <h4>Example</h4>
                  <p>{explanation.result.example}</p>
                  <h4>Common mistakes</h4>
                  <ul>
                    {(explanation.result.common_mistakes || []).map(
                      (x: string) => (
                        <li key={x}>{x}</li>
                      )
                    )}
                  </ul>
                  <div className="notice notice-success">
                    Interview tip: {explanation.result.interview_tip}
                  </div>
                  {explanation.result.complexity && (
                    <p className="muted-small">
                      Complexity / additional context:{" "}
                      {explanation.result.complexity}
                    </p>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function PlayIcon() {
  return <ArrowRight size={13} />;
}

export function ResumePage() {
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [resumeRows, setResumeRows] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [jdTitle, setJdTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [matchBusy, setMatchBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const analyzeResume = trpc.ai.analyzeResume.useMutation();
  const matchJob = trpc.ai.matchJob.useMutation();
  const reload = useCallback(async () => {
    if (!userId) return;
    const c = await getSupabase();
    const [r, a, j] = await Promise.all([
      c
        .from("resumes")
        .select("id,file_name,course,target_role,created_at,storage_path")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false }),
      c
        .from("resume_analysis")
        .select("result,created_at,resume_id")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
      c
        .from("job_matches")
        .select("result,created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    setResumeRows(r.data || []);
    if (a.data?.[0]) {
      setAnalysis(a.data[0].result);
      setResumeId(a.data[0].resume_id || "");
    }
    if (j.data?.[0]) setMatch(j.data[0].result);
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        const c = await getSupabase();
        const { data } = await c
          .from("profiles")
          .select(
            "course,specialization,semester,target_role,target_career,language,skills"
          )
          .eq("id", userId)
          .maybeSingle();
        setProfile(data as Profile | null);
        await reload();
      } catch {
        /* keep upload page usable */
      }
    })();
  }, [reload, userId]);
  async function runAnalysis() {
    if (!file || !user) {
      setError("Choose a PDF or DOCX resume first.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    let extracted: string;
    try {
      extracted = await extractResumeText(file);
    } catch (parseError) {
      setError(resumeFileError(parseError));
      setBusy(false);
      return;
    }
    setText(extracted);
    try {
      const c = await getSupabase();
      const ext = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "docx";
      const storedPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upError } = await c.storage
        .from("resumes")
        .upload(storedPath, file, {
          contentType:
            ext === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: false,
        });
      if (upError) throw new Error("UPLOAD");
      const { data: row, error: rowError } = await c
        .from("resumes")
        .insert({
          owner_id: user.id,
          file_name: file.name,
          storage_path: storedPath,
          parsed_text: extracted,
          course: profile?.course || "",
          target_role: profile?.target_role || "",
          is_primary: true,
        })
        .select("id")
        .single();
      if (rowError || !row) throw new Error("RECORD");
      setResumeId(row.id);
      const result: any = await analyzeResume.mutateAsync({
        text: extracted.slice(0, 15000),
        course: profile?.course || "Other / Custom",
        role: profile?.target_role || "Target role",
      });
      const { error: saveError } = await c
        .from("resume_analysis")
        .insert({ owner_id: user.id, resume_id: row.id, result });
      if (saveError) throw new Error("SAVE");
      setAnalysis(result);
      setSuccess(
        "Your resume analysis is ready. Scores are AI-generated preparation estimates, not hiring outcomes."
      );
      await reload();
    } catch (e) {
      if (e instanceof Error && e.message === "UPLOAD")
        setError(
          "We couldn't upload this document to your private resume storage. Try again."
        );
      else if (e instanceof Error && e.message === "RECORD")
        setError(
          "The private file was uploaded, but its resume record could not be saved. Please retry."
        );
      else if (e instanceof Error && e.message === "SAVE")
        setError(
          "The analysis finished, but the report could not be saved yet. The extracted resume text remains available; please retry."
        );
      else
        setError(
          "Your resume text was read, but the AI analysis could not finish. The extracted text is still available, so please try again."
        );
    } finally {
      setBusy(false);
    }
  }
  async function runMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!jd.trim()) {
      setError("Paste a job description before comparing.");
      return;
    }
    if (!text && !analysis) {
      setError("Upload and analyze a resume first so we can compare evidence.");
      return;
    }
    setMatchBusy(true);
    setError("");
    setSuccess("");
    try {
      const c = await getSupabase();
      const { data: job, error: jobError } = await c
        .from("job_descriptions")
        .insert({
          owner_id: user!.id,
          title: jdTitle || profile?.target_role || "Target role",
          company,
          content: jd,
        })
        .select("id")
        .single();
      if (jobError || !job) throw jobError || new Error();
      const result = await matchJob.mutateAsync({
        resume:
          text ||
          "Use the saved resume context from my latest analysis: " +
            JSON.stringify(analysis),
        course: profile?.course || "Other / Custom",
        role: jdTitle || profile?.target_role || "Target role",
        skills: profile?.skills || [],
        jobDescription: jd,
      });
      const { error: saveError } = await c.from("job_matches").insert({
        owner_id: user!.id,
        resume_id: resumeId || null,
        job_description_id: job.id,
        result,
      });
      if (saveError) throw saveError;
      setMatch(result);
      setSuccess(
        "Role match prepared from your resume and the job description."
      );
    } catch {
      setError(
        "We couldn't compare this job description yet. Check your connection and try again."
      );
    } finally {
      setMatchBusy(false);
    }
  }
  async function openResume(row: any) {
    const c = await getSupabase();
    const { data, error: e } = await c
      .from("resumes")
      .select("parsed_text")
      .eq("id", row.id)
      .eq("owner_id", user!.id)
      .maybeSingle();
    if (e || !data) return;
    setText(data.parsed_text || "");
    setResumeId(row.id);
    setFile(null);
    const a = await c
      .from("resume_analysis")
      .select("result")
      .eq("resume_id", row.id)
      .eq("owner_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(1);
    setAnalysis(a.data?.[0]?.result || null);
  }
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="RESUME SIGNAL"
        title="Make your experience easier to see."
        description="Add a private resume, look for role fit and turn your strengths into a clearer preparation plan."
        action={<Tag tone="cyan">Private file storage</Tag>}
      />
      {error && <div className="notice notice-error">{error}</div>}
      {success && <div className="notice notice-success">{success}</div>}
      <div className="resume-split">
        <Panel
          title="Resume analyzer"
          subtitle="PDF or DOCX · up to 10 MB · readable text is analyzed in your browser, then kept under your account."
          className="resume-panel"
        >
          <label className="resume-upload">
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={e => {
                setFile(e.target.files?.[0] || null);
                setError("");
                setSuccess("");
              }}
            />
            <span className="upload-drop">
              <UploadCloud size={25} />
              <b>{file?.name || "Choose your resume"}</b>
              <span>
                {file
                  ? `${(file.size / 1024 / 1024).toFixed(1)} MB · selected`
                  : "Select a PDF or DOCX from your device"}
              </span>
              <span className="button button-secondary">Browse files</span>
            </span>
          </label>
          <div className="resume-actions">
            <button
              className="button button-primary"
              onClick={() => void runAnalysis()}
              disabled={!file || busy}
            >
              {busy ? (
                <>
                  <span className="spinner" /> Analyzing…
                </>
              ) : (
                <>
                  Analyze resume <Sparkles size={14} />
                </>
              )}
            </button>
            <span className="muted-small">
              <Check size={12} /> Never shared with other learners
            </span>
          </div>
          {resumeRows.length > 0 && (
            <div className="saved-resumes">
              <span className="tiny-label">SAVED RESUMES</span>
              {resumeRows.map(r => (
                <button
                  className={`resume-row ${resumeId === r.id ? "active" : ""}`}
                  key={r.id}
                  onClick={() => void openResume(r)}
                >
                  <FileSearch size={15} />
                  <span>
                    <b>{r.file_name}</b>
                    <small>
                      {r.course} · {r.target_role}
                    </small>
                  </span>
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          )}
        </Panel>
        <Panel
          title="Role-aligned analysis"
          subtitle={
            analysis
              ? "AI-generated estimate from the resume text supplied."
              : "Upload a resume to see evidence-based suggestions."
          }
        >
          {analysis ? (
            <>
              <div className="resume-score-grid">
                {[
                  ["Resume clarity", analysis.resume_score],
                  ["ATS compatibility", analysis.ats_compatibility],
                  ["Skill match", analysis.skill_match],
                  ["Career match", analysis.career_match],
                  ["Project strength", analysis.project_strength],
                ].map(([label, value]: any) => (
                  <div className="resume-score-card" key={label}>
                    <b>
                      {value}
                      <small>/100</small>
                    </b>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="resume-summary">{analysis.summary}</p>
              <div className="insight-columns">
                <div>
                  <b className="takeaway-label positive">MATCHING SKILLS</b>
                  {(analysis.matching_skills || analysis.skills || [])
                    .slice(0, 8)
                    .map((x: string) => (
                      <span key={x} className="resume-skill">
                        <Check size={11} />
                        {x}
                      </span>
                    ))}
                </div>
                <div>
                  <b className="takeaway-label needs">SKILLS TO DEVELOP</b>
                  {(analysis.missing_skills || [])
                    .slice(0, 8)
                    .map((x: string) => (
                      <span key={x} className="resume-skill missing">
                        <Target size={11} />
                        {x}
                      </span>
                    ))}
                </div>
              </div>
              <div className="resume-recommendations">
                <b>Practical improvements</b>
                {(analysis.improvements || [])
                  .slice(0, 5)
                  .map((x: string, i: number) => (
                    <p key={i}>
                      <ArrowRight size={11} />
                      {x}
                    </p>
                  ))}
              </div>
              <div className="resume-extracted">
                <details>
                  <summary>Extracted evidence (private)</summary>
                  <div>
                    <b>Education</b>
                    <p>
                      {(analysis.education || []).join(" · ") ||
                        "Not identified"}
                    </p>
                    <b>Experience</b>
                    <p>
                      {(analysis.experience || []).join(" · ") ||
                        "Not identified"}
                    </p>
                    <b>Projects</b>
                    <p>
                      {(analysis.projects || []).join(" · ") ||
                        "Not identified"}
                    </p>
                  </div>
                </details>
              </div>
            </>
          ) : (
            <EmptyState
              icon={FileSearch}
              title="Your resume has a role-specific story."
              description="Get an honest estimate of resume clarity, ATS compatibility and role skills—with concrete edits to strengthen the next version."
            />
          )}
        </Panel>
      </div>
      <Panel
        title="Compare a job description"
        subtitle="Compare role requirements with evidence you actually provided. Match percentages are analysis estimates, not selection odds."
      >
        <form className="jd-form" onSubmit={runMatch}>
          <div className="form-grid">
            <label>
              Role title
              <input
                className="field"
                value={jdTitle}
                onChange={e => setJdTitle(e.target.value)}
                placeholder={profile?.target_role || "e.g. Financial Analyst"}
              />
            </label>
            <label>
              Company (optional)
              <input
                className="field"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="Company name"
              />
            </label>
            <label className="span-two jd-file-upload">
              Upload a job description PDF or DOCX
              <input
                className="field"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={async e => {
                  const selectedFile = e.target.files?.[0];
                  if (!selectedFile) return;
                  setError("");
                  try {
                    const extracted = await extractResumeText(selectedFile);
                    setJd(extracted.slice(0, 10000));
                    setSuccess(
                      "Job-description text extracted. Review it before comparing."
                    );
                  } catch (readError) {
                    setError(resumeFileError(readError));
                  }
                }}
              />
              <small>
                The text is parsed locally; review or edit it below before
                saving.
              </small>
            </label>
            <label className="span-two">
              Job description
              <textarea
                className="field"
                rows={5}
                maxLength={10000}
                value={jd}
                onChange={e => setJd(e.target.value)}
                placeholder="Paste the role requirements here, or upload a PDF/DOCX above…"
              />
            </label>
          </div>
          <button
            className="button button-secondary"
            type="submit"
            disabled={matchBusy}
          >
            {matchBusy ? (
              <>
                <span className="spinner" /> Comparing…
              </>
            ) : (
              <>
                Compare resume & role <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>
        {match && (
          <div className="match-result">
            <div className="match-score">
              <b>{match.match_percent}%</b>
              <span>estimated role match</span>
            </div>
            <div className="match-copy">
              <b>{match.summary}</b>
              <div className="insight-columns">
                <div>
                  <b className="takeaway-label positive">MATCHING</b>
                  {(match.matching_skills || [])
                    .slice(0, 6)
                    .map((x: string) => (
                      <span className="resume-skill" key={x}>
                        <Check size={11} />
                        {x}
                      </span>
                    ))}
                </div>
                <div>
                  <b className="takeaway-label needs">MISSING / PREPARE</b>
                  {(match.missing_skills || match.preparation_topics || [])
                    .slice(0, 6)
                    .map((x: string) => (
                      <span className="resume-skill missing" key={x}>
                        <Target size={11} />
                        {x}
                      </span>
                    ))}
                </div>
              </div>
              <details>
                <summary>View prep topics & suggested edits</summary>
                <ul>
                  {(match.preparation_topics || []).map((x: string) => (
                    <li key={x}>{x}</li>
                  ))}
                  {(match.resume_improvements || []).map((x: string) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function StudyPlanPage() {
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [weakSkills, setWeakSkills] = useState<string[]>([]);
  const [planningContext, setPlanningContext] = useState("");
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generate = trpc.ai.studyPlan.useMutation();
  const load = useCallback(async () => {
    if (!userId) return;
    const c = await getSupabase();
    const [p, g, pl, resume, metrics] = await Promise.all([
      c
        .from("profiles")
        .select(
          "course,specialization,semester,target_role,target_career,language,skills"
        )
        .eq("id", userId)
        .maybeSingle(),
      c
        .from("skill_gaps")
        .select("skill_name,current_score,priority")
        .eq("owner_id", userId)
        .order("current_score", { ascending: true })
        .limit(10),
      c
        .from("study_plans")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
      c.from("resume_analysis").select("result")
        .eq("owner_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      c.from("performance_metrics").select("metric_name,metric_value,category")
        .eq("owner_id", userId).order("created_at", { ascending: false }).limit(12),
    ]);
    setProfile(p.data as Profile | null);
    const gaps = g.data || [];
    setWeakSkills(gaps.map((x: any) => x.skill_name));
    const resumeResult = (resume.data?.result || {}) as Record<string, unknown>;
    const safeList = (key: string) => Array.isArray(resumeResult[key])
      ? (resumeResult[key] as unknown[]).filter((value): value is string => typeof value === "string").slice(0, 8)
      : [];
    const savedSkills = Array.isArray(p.data?.skills)
      ? p.data.skills.filter((value: unknown): value is string => typeof value === "string").slice(0, 12)
      : [];
    const metricSignals = (metrics.data || []).slice(0, 12).map((metric: any) => {
      const score = Number(metric.metric_value);
      return Number.isFinite(score)
        ? `${String(metric.category || "General")}/${String(metric.metric_name || "score")}: ${Math.round(score)}/100`
        : null;
    }).filter((value): value is string => value !== null);
    const context = [
      savedSkills.length ? `Profile skills: ${savedSkills.join(", ")}` : "",
      safeList("matching_skills").length ? `Resume-supported skills: ${safeList("matching_skills").join(", ")}` : "",
      safeList("missing_skills").length ? `Resume gaps: ${safeList("missing_skills").join(", ")}` : "",
      metricSignals.length ? `Saved interview performance signals: ${metricSignals.join("; ")}` : "",
    ].filter(Boolean).join(". ").slice(0, 1500);
    setPlanningContext(context);
    if (pl.data?.[0]) {
      setPlan(pl.data[0]);
      const { data } = await c
        .from("study_plan_items")
        .select("*")
        .eq("owner_id", userId)
        .eq("plan_id", pl.data[0].id)
        .order("day_number");
      setItems(data || []);
    }
  }, [userId]);
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        await load();
      } catch {
        setError("We couldn't load your saved plan. Try refreshing the page.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load, userId]);
  async function createPlan() {
    setBusy(true);
    setError("");
    try {
      const result = await generate.mutateAsync({
        course: profile?.course || "Other / Custom",
        role: profile?.target_role || "Career role",
        weakSkills,
        days,
        context: planningContext || undefined,
        language: (profile?.language || "English") as
          | "English"
          | "Hindi"
          | "Hinglish",
      });
      const c = await getSupabase();
      const { data: created, error: e } = await c
        .from("study_plans")
        .insert({
          owner_id: user!.id,
          title: result.title || `${days}-day interview practice plan`,
          duration_days: days,
          course: profile?.course || "",
          target_role: profile?.target_role || "",
        })
        .select("*")
        .single();
      if (e || !created) throw e || new Error();
      const requested = Array.isArray(result.days) ? result.days : [];
      const rows = Array.from({ length: days }, (_, i) => {
        const d = requested[i] ||
          requested[requested.length - 1] || {
            topic: `Practice ${weakSkills[i % Math.max(1, weakSkills.length)] || profile?.course || "core interview skills"}`,
            activity:
              "Review a key concept, then answer a realistic practice question.",
            minutes: 30,
            skill:
              weakSkills[i % Math.max(1, weakSkills.length)] ||
              "Interview practice",
          };
        return {
          owner_id: user!.id,
          plan_id: created.id,
          day_number: i + 1,
          topic: String(d.topic || "Focused practice"),
          activity: String(d.activity || "Review and practice."),
          skill: String(d.skill || "Interview practice"),
          minutes: Math.max(15, Math.min(90, Number(d.minutes) || 30)),
        };
      });
      const { error: ie } = await c.from("study_plan_items").insert(rows);
      if (ie) {
        await c
          .from("study_plans")
          .delete()
          .eq("id", created.id)
          .eq("owner_id", user!.id);
        throw ie;
      }
      void notifyUser(
        user!.id,
        "study_plan",
        "Your study plan is ready",
        `A ${days}-day plan for ${profile?.target_role || profile?.course || "your goals"} has been created.`
      );
      await load();
    } catch {
      setError(
        "We couldn't create a saved study plan right now. Your profile is unchanged—please try again."
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggleItem(item: any) {
    const c = await getSupabase();
    const { error: e } = await c
      .from("study_plan_items")
      .update({ completed: !item.completed })
      .eq("id", item.id)
      .eq("owner_id", user!.id);
    if (!e)
      setItems(
        items.map(x =>
          x.id === item.id ? { ...x, completed: !x.completed } : x
        )
      );
  }
  async function bookmark(item: any) {
    const c = await getSupabase();
    const id = String(item.id);
    const { data } = await c
      .from("bookmarks")
      .select("id")
      .eq("owner_id", user!.id)
      .eq("target_type", "study")
      .eq("target_id", id)
      .maybeSingle();
    if (data) await c.from("bookmarks").delete().eq("id", data.id);
    else
      await c.from("bookmarks").insert({
        owner_id: user!.id,
        target_type: "study",
        target_id: id,
        title: item.topic,
        detail: `Day ${item.day_number} · ${item.skill}`,
      });
  }
  if (loading) return <LoadingState text="Finding a useful next step…" />;
  const progress = items.length
    ? Math.round((items.filter(x => x.completed).length / items.length) * 100)
    : 0;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="FOCUSED PREPARATION"
        title="A plan you can actually follow."
        description="Build a 7-, 14- or 30-day schedule around your course, target role and areas to practice."
        action={
          profile?.target_role ? (
            <Tag tone="cyan">
              {profile.course} → {profile.target_role}
            </Tag>
          ) : undefined
        }
      />
      {error && <div className="notice notice-error">{error}</div>}
      {!plan || !items.length ? (
        <Panel className="plan-create">
          <div className="plan-create-copy">
            <span className="eyebrow">
              <Sparkles size={13} /> PERSONALIZED PRACTICE PLAN
            </span>
            <h2>Small steps. Your kind of progress.</h2>
            <p className="muted">
              The AI coach can use saved skill gaps, your course and role to
              suggest a day-by-day focus. Every recommendation is for interview
              learning, not a hiring forecast.
            </p>
            <div className="plan-choice">
              <span className="tiny-label">PLAN LENGTH</span>
              {([7, 14, 30] as const).map(n => (
                <button
                  className={days === n ? "active" : ""}
                  key={n}
                  onClick={() => setDays(n)}
                >
                  {n} days
                </button>
              ))}
            </div>
            <button
              className="button button-primary"
              onClick={() => void createPlan()}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="spinner" /> Building your plan…
                </>
              ) : (
                <>
                  Create my {days}-day plan <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
          <div className="plan-illustration">
            <div className="plan-orbit">
              <Target size={34} />
            </div>
            <div className="plan-step-marker pm-1">
              DAY 01 <span>Start</span>
            </div>
            <div className="plan-step-marker pm-2">
              DAY 04 <span>Build</span>
            </div>
            <div className="plan-step-marker pm-3">
              DAY 07 <span>Reflect</span>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          <Panel className="plan-progress-panel">
            <div className="plan-progress-head">
              <div>
                <span className="eyebrow">
                  <Check size={13} /> YOUR ACTIVE PLAN
                </span>
                <h2>{plan.title}</h2>
                <p>
                  {plan.course} · {plan.target_role}
                </p>
              </div>
              <div
                className="plan-progress-ring"
                style={{ "--progress": `${progress}%` } as CSSProperties}
              >
                <ProgressBar value={progress} color="green" />
                <b>{progress}%</b>
                <span>
                  {items.filter(i => i.completed).length} / {items.length} days
                </span>
              </div>
            </div>
            <div className="plan-actions">
              <button
                className="button button-secondary"
                onClick={() => void createPlan()}
                disabled={busy}
              >
                {busy ? "Building…" : "Replace plan"}
              </button>
              <div className="plan-choice compact">
                {([7, 14, 30] as const).map(n => (
                  <button
                    className={days === n ? "active" : ""}
                    key={n}
                    onClick={() => setDays(n)}
                  >
                    {n}d
                  </button>
                ))}
              </div>
            </div>
          </Panel>
          <Panel
            title="Your day-by-day focus"
            subtitle="Mark a day done when it feels useful—not just checked off."
          >
            <div className="plan-day-list">
              {items.map(item => (
                <div
                  className={`plan-day ${item.completed ? "study-complete" : ""}`}
                  key={item.id}
                >
                  <span className="day-num">
                    DAY {String(item.day_number).padStart(2, "0")}
                  </span>
                  <div>
                    <h4>{item.topic}</h4>
                    <p>{item.activity}</p>
                    <small>
                      {item.skill} · {item.minutes} min
                    </small>
                    <details className="study-resource">
                      <summary>View resources</summary>
                      <p>
                        Review your course notes on {item.topic} and consider
                        how the concept applies to{" "}
                        {profile?.target_role || "your target role"}.
                      </p>
                      <Link
                        href={`/questions?search=${encodeURIComponent(`${item.topic} ${item.skill}`)}`}
                      >
                        Find related questions <ArrowRight size={11} />
                      </Link>
                    </details>
                  </div>
                  <Link
                    className="plan-practice-link"
                    href={`/practice?focus=${encodeURIComponent(item.skill || item.topic)}`}
                  >
                    Practice <ArrowRight size={11} />
                  </Link>
                  <div className="plan-day-tools">
                    <button
                      className="icon-button"
                      aria-label="Bookmark this study item"
                      onClick={() => void bookmark(item)}
                    >
                      <Bookmark size={13} />
                    </button>
                    <input
                      type="checkbox"
                      aria-label={`Mark day ${item.day_number} complete`}
                      checked={item.completed}
                      onChange={() => void toggleItem(item)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
      <Panel
        title="Use your own focus areas"
        subtitle={
          weakSkills.length
            ? "These are based on your saved course-aware skill gaps."
            : "Your plan will use course and role context until there is enough practice history."
        }
      >
        <div className="weak-skill-strip">
          {(weakSkills.length
            ? weakSkills
            : profile?.skills?.slice(0, 5) || []
          ).map(x => (
            <Tag key={x} tone="violet">
              {x}
            </Tag>
          ))}
          {!weakSkills.length && !profile?.skills?.length && (
            <p className="muted-small">
              Add skills in your profile or complete a practice interview to
              surface priorities.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
