import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GraduationCap,
  BriefcaseBusiness,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  courseGroups,
  interviewTypes as fallbackTypes,
  roleOptions as fallbackRoles,
  skillCatalog as fallbackSkills,
  specializationsByCourse,
} from "@/data/taxonomy";
import { trpc } from "@/lib/trpc";
import {
  extractResumeText,
  resumeFileError,
  MAX_RESUME_BYTES,
} from "@/lib/resume";

const steps = ["Profile", "Career goal", "Skills", "Preference", "Resume"];
const languages = ["English", "Hindi", "Hinglish"];
export default function Onboarding() {
  const { user, ready } = useSupabaseAuth();
  const userId = user?.id;
  const metadataFullName = user?.user_metadata?.full_name;
  const metadataDegree = user?.user_metadata?.degree;
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    college: "",
    degree: "",
    department: "",
    course: "",
    customCourse: "",
    specialization: "",
    customSpecialization: "",
    semester: "Final Year",
    graduation_year: "2026",
    target_career: "",
    target_role: "",
    experience_level: "Student / Fresher",
    preferred_industry: "",
    interests: "",
    skills: [] as string[],
    interview_preference: "Mixed",
    language: "English",
  });
  const [dbCourses, setDbCourses] = useState<any[]>([]);
  const [dbSpecs, setDbSpecs] = useState<any[]>([]);
  const [dbRoles, setDbRoles] = useState<string[]>([]);
  const [dbSkills, setDbSkills] = useState<string[]>([]);
  const [dbTypes, setDbTypes] = useState<string[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const analyzeResume = trpc.ai.analyzeResume.useMutation();
  useEffect(() => {
    if (!userId) return;
    setForm(f => ({
      ...f,
      full_name: String(metadataFullName || f.full_name),
      degree: String(metadataDegree || f.degree),
    }));
    let active = true;
    void (async () => {
      try {
        const c = await getSupabase();
        const [cr, sp, ro, sk, it] = await Promise.all([
          c
            .from("courses")
            .select("id,name,slug,category:course_categories(name,slug)")
            .eq("active", true)
            .order("name"),
          c
            .from("specializations")
            .select("course_id,name")
            .eq("active", true)
            .order("name"),
          c.from("job_roles").select("name").eq("active", true).order("name"),
          c.from("skills").select("name").eq("active", true).order("name"),
          c
            .from("interview_types")
            .select("name")
            .eq("active", true)
            .order("sort_order"),
        ]);
        if (!active) return;
        if (cr.data) setDbCourses(cr.data as any[]);
        if (sp.data) setDbSpecs(sp.data as any[]);
        if (ro.data) setDbRoles(ro.data.map((x: any) => x.name));
        if (sk.data) setDbSkills(sk.data.map((x: any) => x.name));
        if (it.data) setDbTypes(it.data.map((x: any) => x.name));
      } catch {
        /* static taxonomy remains available if migrations are not applied */
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, metadataFullName, metadataDegree]);
  const chosenCourse =
    form.course === "Other / Custom Course" ? form.customCourse : form.course;
  const displayGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const group of courseGroups) map.set(group.label, [...group.courses]);
    for (const row of dbCourses) {
      const category = Array.isArray(row.category)
        ? row.category[0]
        : row.category;
      const label = category?.name || "Other / Custom";
      if (!map.has(label)) map.set(label, []);
      const items = map.get(label)!;
      if (!items.includes(row.name)) items.push(row.name);
    }
    return Array.from(map, ([label, courses]) => ({
      label,
      courses: courses.sort((a, b) => a.localeCompare(b)),
    }));
  }, [dbCourses]);
  const courseOptions = useMemo(
    () => [...new Set(displayGroups.flatMap(x => x.courses))],
    [displayGroups]
  );
  const specializations = useMemo(() => {
    const record = dbCourses.find(x => x.name === chosenCourse);
    const custom = record
      ? dbSpecs.filter(x => x.course_id === record.id).map(x => x.name)
      : [];
    return [
      ...new Set([...(specializationsByCourse[chosenCourse] || []), ...custom]),
    ];
  }, [chosenCourse, dbCourses, dbSpecs]);
  const roles = [...new Set([...fallbackRoles, ...dbRoles])];
  const skills = [...new Set([...fallbackSkills, ...dbSkills])];
  const types = [...new Set([...fallbackTypes, ...dbTypes])];
  function update<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm(f => ({ ...f, [key]: value }));
  }
  function toggleSkill(skill: string) {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter(s => s !== skill)
        : [...f.skills, skill],
    }));
  }
  async function finish() {
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      const c = await getSupabase();
      const cleanCourse = chosenCourse.trim();
      const specialization =
        form.specialization === "Other / Custom"
          ? form.customSpecialization.trim()
          : form.specialization;
      const { error: err } = await c.from("profiles").upsert(
        {
          id: user.id,
          email: user.email,
          full_name: form.full_name.trim(),
          college: form.college,
          degree: form.degree.trim() || null,
          course: cleanCourse,
          specialization,
          department: form.department.trim() || null,
          semester: form.semester,
          graduation_year: Number(form.graduation_year) || null,
          target_career: form.target_career,
          target_role: form.target_role,
          experience_level: form.experience_level,
          preferred_industry: form.preferred_industry,
          interests: form.interests
            .split(",")
            .map(x => x.trim())
            .filter(Boolean)
            .slice(0, 20),
          skills: form.skills,
          interview_preference: form.interview_preference,
          language: form.language,
          onboarding_complete: true,
        },
        { onConflict: "id" }
      );
      if (err) throw err;
      if (form.skills.length) {
        const rows = form.skills.map(skill => ({
          owner_id: user.id,
          skill_name: skill,
          current_score: 0,
        }));
        const { error: skillError } = await c
          .from("user_skills")
          .upsert(rows, { onConflict: "owner_id,skill_name" });
        if (skillError) throw skillError;
      }
      if (resumeFile) {
        let text = "";
        try {
          text = await extractResumeText(resumeFile);
        } catch (e) {
          throw new Error(
            e instanceof Error ? `RESUME_${e.message}` : "RESUME_READ"
          );
        }
        const ext = resumeFile.name.toLowerCase().endsWith(".pdf")
          ? "pdf"
          : "docx";
        const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await c.storage
          .from("resumes")
          .upload(storagePath, resumeFile, {
            contentType:
              ext === "pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: false,
          });
        if (uploadError) throw new Error("RESUME_UPLOAD");
        const { data: resume, error: resumeError } = await c
          .from("resumes")
          .insert({
            owner_id: user.id,
            file_name: resumeFile.name,
            storage_path: storagePath,
            parsed_text: text,
            course: cleanCourse,
            target_role: form.target_role,
            is_primary: true,
          })
          .select("id")
          .single();
        if (resumeError || !resume) throw new Error("RESUME_SAVE");
        const analysis: any = await analyzeResume.mutateAsync({
          text: text.slice(0, 15000),
          course: cleanCourse || "Other / Custom",
          role: form.target_role || "Target role",
        });
        const { error: analysisError } = await c
          .from("resume_analysis")
          .insert({
            owner_id: user.id,
            resume_id: resume.id,
            result: analysis,
          });
        if (analysisError) throw new Error("RESUME_ANALYSIS");
      }
      navigate("/app");
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (message.startsWith("RESUME_")) {
        const kind = message.slice(7);
        setError(
          kind === "UPLOAD"
            ? "Your profile is saved, but we couldn't upload the resume to private storage. You can retry here or upload from Resume Analyzer."
            : kind === "SAVE" || kind === "ANALYSIS"
              ? "Your profile is saved, but the resume analysis could not be saved yet. Retry, or upload from Resume Analyzer."
              : resumeFileError(new Error(kind))
        );
      } else
        setError(
          "We couldn't save your profile yet. Check that the project database is set up, then try again."
        );
    } finally {
      setSaving(false);
    }
  }
  if (!ready)
    return (
      <div className="center-screen">
        <span className="spinner" />
      </div>
    );
  if (!user) {
    navigate("/signup");
    return null;
  }
  const stepValid =
    step === 0
      ? !!form.full_name.trim() &&
        !!chosenCourse.trim() &&
        !!(form.specialization === "Other / Custom"
          ? form.customSpecialization.trim()
          : form.specialization.trim())
      : step === 1
        ? !!form.target_role
        : step === 2
          ? form.skills.length > 0
          : step === 3
            ? !!form.interview_preference
            : true;
  return (
    <main className="onboarding-page">
      <header className="onboard-top">
        <a href="/" className="brand">
          <span className="brand-mark">
            <span />
          </span>
          <span>
            SMART <b>INTERVIEW</b>
          </span>
        </a>
        <span className="muted-small">PERSONALIZE YOUR COACH</span>
      </header>
      <section className="onboard-card">
        <div className="step-head">
          <div>
            <span className="eyebrow">STEP {step + 1} OF 5</span>
            <h1>
              {
                [
                  "Tell us where you're starting.",
                  "Where do you want to go?",
                  "What do you already bring?",
                  "How would you like to practice?",
                  "Add a resume (optional).",
                ][step]
              }
            </h1>
            <p className="muted">
              Your course and career shape every question, rubric and next step.
            </p>
          </div>
          <div className="step-emblem">
            {
              [
                <GraduationCap />,
                <BriefcaseBusiness />,
                <Sparkles />,
                <Check />,
                <UploadCloud />,
              ][step]
            }
          </div>
        </div>
        <div className="step-track">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`step-segment ${i <= step ? "active" : ""}`}
            >
              <span>{i < step ? <Check size={12} /> : `0${i + 1}`}</span>
              <b>{s}</b>
            </div>
          ))}
        </div>
        {error && (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        )}
        {step === 0 && (
          <div className="form-grid">
            <label>
              Full name
              <input
                className="field"
                value={form.full_name}
                onChange={e => update("full_name", e.target.value)}
                placeholder="Your name"
                required
              />
            </label>
            <label>
              College / institution
              <input
                className="field"
                value={form.college}
                onChange={e => update("college", e.target.value)}
                placeholder="Where you study"
              />
            </label>
            <label>
              Course
              <select
                className="field"
                value={form.course}
                onChange={e => {
                  update("course", e.target.value);
                  update("specialization", "");
                }}
              >
                <option value="">Select course</option>
                {displayGroups.map(g => (
                  <optgroup label={g.label} key={g.label}>
                    {g.courses.map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </optgroup>
                ))}
                <option>Other / Custom Course</option>
              </select>
            </label>
            {form.course === "Other / Custom Course" && (
              <label>
                Enter your course
                <input
                  className="field"
                  value={form.customCourse}
                  onChange={e => update("customCourse", e.target.value)}
                  placeholder="e.g. Diploma in Food Processing"
                />
              </label>
            )}
            <label>
              Degree (if different from course)
              <input
                className="field"
                value={form.degree}
                onChange={e => update("degree", e.target.value)}
                placeholder="e.g. Bachelor of Technology"
              />
            </label>
            <label>
              Specialization
              <select
                className="field"
                value={form.specialization}
                onChange={e => update("specialization", e.target.value)}
              >
                <option value="">Select or add specialization</option>
                {specializations.map(s => (
                  <option key={s}>{s}</option>
                ))}
                <option>Other / Custom</option>
              </select>
            </label>
            {form.specialization === "Other / Custom" && (
              <label>
                Enter specialization
                <input
                  className="field"
                  value={form.customSpecialization}
                  onChange={e => update("customSpecialization", e.target.value)}
                  placeholder="Your specialization"
                />
              </label>
            )}
            <label>
              Department
              <input
                className="field"
                value={form.department}
                onChange={e => update("department", e.target.value)}
                placeholder="e.g. Computer Science and Engineering"
              />
            </label>
            <label>
              Year / semester
              <select
                className="field"
                value={form.semester}
                onChange={e => update("semester", e.target.value)}
              >
                {[
                  "First Year",
                  "Second Year",
                  "Third Year",
                  "Final Year",
                  "Semester 1",
                  "Semester 2",
                  "Semester 3",
                  "Semester 4",
                  "Semester 5",
                  "Semester 6",
                  "Semester 7",
                  "Semester 8",
                  "Graduate",
                ].map(x => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Graduation year
              <input
                className="field"
                type="number"
                min="2000"
                max="2040"
                value={form.graduation_year}
                onChange={e => update("graduation_year", e.target.value)}
              />
            </label>
          </div>
        )}
        {step === 1 && (
          <div className="form-grid">
            <label>
              Target career
              <input
                className="field"
                value={form.target_career}
                onChange={e => update("target_career", e.target.value)}
                placeholder="e.g. Financial Analysis"
              />
            </label>
            <label>
              Target job role
              <select
                className="field"
                value={form.target_role}
                onChange={e => update("target_role", e.target.value)}
              >
                <option value="">Choose a role</option>
                {roles.map(r => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            {form.target_role === "Other / custom role" && (
              <label>
                Enter your target role
                <input
                  className="field"
                  onChange={e => update("target_role", e.target.value)}
                  placeholder="Target role"
                />
              </label>
            )}
            <label>
              Experience level
              <select
                className="field"
                value={form.experience_level}
                onChange={e => update("experience_level", e.target.value)}
              >
                {[
                  "Student / Fresher",
                  "Internship",
                  "Entry level",
                  "1–3 years",
                  "3–5 years",
                  "Career switcher",
                ].map(x => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Preferred industry
              <input
                className="field"
                value={form.preferred_industry}
                onChange={e => update("preferred_industry", e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="span-two">
              Areas of interest, comma-separated
              <input
                className="field"
                value={form.interests}
                onChange={e => update("interests", e.target.value)}
                placeholder="e.g. renewable energy, financial modelling, patient safety"
              />
            </label>
          </div>
        )}
        {step === 2 && (
          <div>
            <p className="muted">
              Choose skills you want your coach to consider. You can update
              these later.
            </p>
            <div className="skill-pills">
              {skills.map(s => (
                <button
                  type="button"
                  key={s}
                  className={`skill-pill ${form.skills.includes(s) ? "selected" : ""}`}
                  onClick={() => toggleSkill(s)}
                >
                  {form.skills.includes(s) ? (
                    <Check size={13} />
                  ) : (
                    <span className="pill-dot" />
                  )}
                  {s}
                </button>
              ))}
            </div>
            <label className="custom-skill">
              Add a course-specific skill
              <input
                className="field"
                placeholder="Type skill, then press Enter"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = (e.currentTarget.value || "").trim();
                    if (v) toggleSkill(v);
                    e.currentTarget.value = "";
                  }
                }}
              />
            </label>
          </div>
        )}
        {step === 3 && (
          <div className="form-grid">
            <label>
              Preferred interview style
              <select
                className="field"
                value={form.interview_preference}
                onChange={e => update("interview_preference", e.target.value)}
              >
                {types.map(x => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Practice language
              <select
                className="field"
                value={form.language}
                onChange={e => update("language", e.target.value)}
              >
                {languages.map(x => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <div className="info-block span-two">
              <Sparkles />
              <div>
                <b>Your questions will follow your field.</b>
                <span>
                  Course, specialization, role and performance help tune the
                  next interview—not a one-size-fits-all template.
                </span>
              </div>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="upload-panel">
            <div className="upload-icon">
              <UploadCloud size={24} />
            </div>
            <h3>Give your coach a little context.</h3>
            <p className="muted">
              Add a PDF or DOCX resume to personalize questions, skills and job
              matching. This step is optional; you can upload later.
            </p>
            <label className="button button-secondary upload-button">
              {resumeFile?.name || "Choose PDF or DOCX"}
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={e => {
                  const next = e.target.files?.[0] || null;
                  setResumeFile(next);
                  setError("");
                }}
              />
            </label>
            <span className="muted-small">
              Maximum 10 MB · private to your account · upload and analysis
              begin when you build your profile
            </span>
            {resumeFile && (
              <button
                type="button"
                className="text-link"
                onClick={() => setResumeFile(null)}
              >
                Remove selected file
              </button>
            )}
            {resumeFile && resumeFile.size > MAX_RESUME_BYTES && (
              <span className="notice notice-error">
                Choose a file smaller than 10 MB.
              </span>
            )}
          </div>
        )}
        <footer className="onboard-footer">
          <button
            className="button button-ghost"
            onClick={() =>
              step === 0 ? navigate("/app") : setStep(n => n - 1)
            }
          >
            <ArrowLeft size={15} />
            {step === 0 ? "Skip for now" : "Back"}
          </button>
          {step < 4 ? (
            <button
              className="button button-primary"
              disabled={!stepValid}
              onClick={() => setStep(n => n + 1)}
            >
              Continue
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              className="button button-primary"
              disabled={
                saving ||
                Boolean(resumeFile && resumeFile.size > MAX_RESUME_BYTES)
              }
              onClick={finish}
            >
              {saving ? (
                <>
                  <span className="spinner" /> Building profile…
                </>
              ) : (
                <>
                  Build My Interview Profile <ArrowRight size={15} />
                </>
              )}
            </button>
          )}
        </footer>
      </section>
      <p className="onboard-note">
        <span className="secure-dot" /> Your profile and practice responses stay
        private under your account policies.
      </p>
    </main>
  );
}
