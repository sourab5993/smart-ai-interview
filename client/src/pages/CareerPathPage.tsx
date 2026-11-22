import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  BriefcaseBusiness,
  Check,
  GraduationCap,
  Target,
  TrendingUp,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  EmptyState,
  LoadingState,
  PageHeading,
  Panel,
  ProgressBar,
  Tag,
} from "@/components/app/Shared";

type CatalogRow = Record<string, any>;
function joined(row: CatalogRow | null | undefined, key: string) {
  const value = row?.[key];
  return Array.isArray(value) ? value[0] : value;
}
function norm(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default function CareerPathPage() {
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<CatalogRow | null>(null);
  const [careers, setCareers] = useState<CatalogRow[]>([]);
  const [roles, setRoles] = useState<CatalogRow[]>([]);
  const [roleSkills, setRoleSkills] = useState<CatalogRow[]>([]);
  const [courseRows, setCourseRows] = useState<CatalogRow[]>([]);
  const [courseSkills, setCourseSkills] = useState<CatalogRow[]>([]);
  const [practice, setPractice] = useState<CatalogRow[]>([]);
  const [resume, setResume] = useState<CatalogRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!userId) return;
        const c = await getSupabase();
        const [p, ca, r, rs, cr, cs, ps, ra] = await Promise.all([
          c
            .from("profiles")
            .select(
              "course,specialization,target_role,target_career,skills,interests"
            )
            .eq("id", userId)
            .maybeSingle(),
          c
            .from("careers")
            .select(
              "id,name,description,course_category_id,category:course_categories(id,name,slug)"
            )
            .eq("active", true)
            .order("name"),
          c
            .from("job_roles")
            .select("id,name,category,career_id,interview_types")
            .eq("active", true)
            .order("name"),
          c
            .from("role_skills")
            .select("role_id,required_score,skill:skills(id,name)")
            .limit(1000),
          c
            .from("courses")
            .select(
              "id,name,category_id,slug,category:course_categories(id,name,slug)"
            )
            .eq("active", true)
            .limit(500),
          c
            .from("course_skills")
            .select("course_id,required_score,skill:skills(id,name)")
            .limit(1000),
          c
            .from("interview_sessions")
            .select("overall_score,created_at")
            .eq("owner_id", userId)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(8),
          c
            .from("resume_analysis")
            .select("result,created_at")
            .eq("owner_id", userId)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);
        if (!active) return;
        if (p.error) throw p.error;
        setProfile(p.data);
        setCareers(ca.data || []);
        setRoles(r.data || []);
        setRoleSkills(rs.data || []);
        setCourseRows(cr.data || []);
        setCourseSkills(cs.data || []);
        setPractice(ps.data || []);
        setResume(ra.data?.[0]?.result || null);
      } catch {
        if (active)
          setError(
            "We couldn't load the career catalog. Your practice and profile data remain private."
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);
  const skillSet = useMemo(
    () =>
      new Set<string>(
        [
          ...(profile?.skills || []),
          ...(resume?.skills || []),
          ...(resume?.matching_skills || []),
        ].map(norm)
      ),
    [profile, resume]
  );
  const courseRecord = courseRows.find(
    row => norm(row.name) === norm(profile?.course)
  );
  const courseCategory = joined(courseRecord, "category");
  const target = norm(profile?.target_role);
  const targetCareer = norm(profile?.target_career);
  const scoredPractice = practice.filter(
    s =>
      s.overall_score !== null &&
      s.overall_score !== undefined &&
      Number.isFinite(Number(s.overall_score))
  );
  const recentScore = scoredPractice.length
    ? Math.round(
        scoredPractice.reduce((a, s) => a + Number(s.overall_score), 0) /
          scoredPractice.length
      )
    : null;
  const recommendations = useMemo(
    () =>
      careers
        .flatMap(career => {
          const category = joined(career, "category");
          const careerRoles = roles.filter(
            role =>
              role.career_id === career.id ||
              (category?.slug && role.category === category.slug)
          );
          return careerRoles.map(role => {
            const req = roleSkills
              .filter(row => row.role_id === role.id)
              .map(row => ({
                name: joined(row, "skill")?.name,
                score: Number(row.required_score) || 70,
              }))
              .filter(item => item.name);
            const matching = req.filter(item => skillSet.has(norm(item.name)));
            const missing = req.filter(item => !skillSet.has(norm(item.name)));
            const sameDiscipline = Boolean(
              courseCategory?.slug &&
                (category?.slug === courseCategory.slug ||
                  role.category === courseCategory.slug)
            );
            const desired = Boolean(
              (target &&
                (norm(role.name) === target ||
                  norm(role.name).includes(target) ||
                  target.includes(norm(role.name)))) ||
                (targetCareer &&
                  (norm(career.name).includes(targetCareer) ||
                    targetCareer.includes(norm(career.name))))
            );
            const interestFit = (profile?.interests || []).some((raw: any) => {
              const needle = norm(raw);
              return (
                needle.length >= 3 &&
                `${career.name} ${role.name} ${role.category} ${career.description}`
                  .toLowerCase()
                  .includes(needle)
              );
            });
            const skillFit = req.length
              ? matching.length / req.length
              : Math.min(0.65, skillSet.size / 8);
            const score = Math.max(
              35,
              Math.min(
                96,
                Math.round(
                  42 +
                    (sameDiscipline ? 28 : 0) +
                    (desired ? 12 : 0) +
                    (interestFit ? 8 : 0) +
                    skillFit * 13 +
                    (scoredPractice.length && recentScore !== null
                      ? Math.min(5, recentScore / 20)
                      : 0)
                )
              )
            );
            return {
              career,
              role,
              category,
              required: req,
              matching,
              missing,
              sameDiscipline,
              interestFit,
              score,
            };
          });
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 12),
    [
      careers,
      roles,
      roleSkills,
      skillSet,
      courseCategory,
      target,
      targetCareer,
      profile?.interests,
      scoredPractice.length,
      recentScore,
    ]
  );
  const prioritySkills = [
    ...new Set(
      recommendations
        .slice(0, 6)
        .flatMap(item => item.missing.map(skill => String(skill.name)))
    ),
  ].slice(0, 12);
  const certificationIdeas = (career: string, category: string) => {
    const text = `${career} ${category}`.toLowerCase();
    if (/commerce|finance|account|bank/.test(text))
      return [
        "Accounting and financial reporting coursework",
        "A finance credential relevant to your country and target role (for example, ACCA/CFA/CA pathway)",
      ];
    if (/marketing|business|management/.test(text))
      return [
        "Google Analytics or equivalent measurement coursework",
        "Business analytics or project-management coursework",
      ];
    if (/health|medical|pharm|nursing/.test(text))
      return [
        "Good Clinical Practice / ICH-GCP learning where relevant",
        "Professional registration or continuing education as required locally",
      ];
    if (/law/.test(text))
      return [
        "Jurisdiction-appropriate professional registration where applicable",
        "Legal research and drafting continuing education",
      ];
    if (/design|ui|ux/.test(text))
      return [
        "Human-centred design and accessibility coursework",
        "Portfolio-based user research and prototyping coursework",
      ];
    if (/educat|teach/.test(text))
      return [
        "Locally required teacher licensure/registration",
        "Inclusive assessment and instructional-design coursework",
      ];
    if (/agri|horticultur/.test(text))
      return [
        "Good Agricultural Practices coursework",
        "Role-specific agronomy or sustainable-production training",
      ];
    return [
      "Role-specific technical certification selected with an academic adviser",
      "Project-based coursework that demonstrates the target skill",
    ];
  };
  if (loading)
    return <LoadingState text="Matching your path to course and role data…" />;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="CAREER PATHS"
        title="Explore roles that build on what you know."
        description="Recommendations use your course, stated interests, selected skills, saved resume analysis and interview practice. Match values are transparent estimates—not hiring odds."
        action={<Tag tone="cyan">{profile?.course || "Course not set"}</Tag>}
      />
      {error && <div className="notice notice-warning">{error}</div>}
      {!profile?.course && (
        <div className="notice notice-warning">
          <GraduationCap size={14} /> Add a course in onboarding to improve
          career fit.{" "}
          <Link href="/onboarding" className="text-link">
            Set up profile <ArrowRight size={12} />
          </Link>
        </div>
      )}
      <div className="career-stat-strip">
        <div>
          <GraduationCap />
          <span>
            <b>{profile?.course || "Your course"}</b>
            <small>{profile?.specialization || "Course specialization"}</small>
          </span>
        </div>
        <div>
          <Target />
          <span>
            <b>{profile?.target_role || "Choose a target role"}</b>
            <small>{profile?.target_career || "Career interest"}</small>
          </span>
        </div>
        <div>
          <TrendingUp />
          <span>
            <b>
              {scoredPractice.length && recentScore !== null
                ? `${recentScore}% practice average`
                : "Build your signal"}
            </b>
            <small>
              From {practice.length} saved session
              {practice.length === 1 ? "" : "s"}
            </small>
          </span>
        </div>
      </div>
      {recommendations.length === 0 ? (
        <Panel>
          <EmptyState
            icon={BriefcaseBusiness}
            title="Career paths are ready for a first match."
            description="Add active careers and roles in the catalog to show tailored recommendations."
            action="Complete profile"
            href="/onboarding"
          />
        </Panel>
      ) : (
        <>
          <div className="career-card-grid">
            {recommendations.slice(0, 6).map((item, i) => (
              <Panel className="career-card" key={item.role.id}>
                <div className="career-card-top">
                  <span className="career-rank">0{i + 1}</span>
                  <Tag
                    tone={
                      item.score >= 78
                        ? "green"
                        : item.score >= 60
                          ? "cyan"
                          : "violet"
                    }
                  >
                    {item.score}% fit estimate
                  </Tag>
                </div>
                <span className="eyebrow">
                  {item.category?.name || "CROSS-DISCIPLINE"} ·{" "}
                  {item.career.name.toUpperCase()}
                </span>
                <h2>{item.role.name}</h2>
                <p>
                  {item.career.description ||
                    `A role path that draws on ${profile?.course || "your course"} preparation.`}
                </p>
                <div className="career-fit-track">
                  <ProgressBar value={item.score} />
                </div>
                <div className="career-skill-pills">
                  {item.matching.slice(0, 4).map(skill => (
                    <Tag tone="green" key={skill.name}>
                      <Check size={10} />
                      {skill.name}
                    </Tag>
                  ))}
                  {item.missing.slice(0, 3).map(skill => (
                    <Tag tone="amber" key={skill.name}>
                      {skill.name}
                    </Tag>
                  ))}
                </div>
                <div className="career-role-footer">
                  <span>
                    <BookOpen size={12} />{" "}
                    {(item.role.interview_types || [])
                      .slice(0, 3)
                      .join(" · ") || "Domain · HR"}
                  </span>
                  <Link
                    className="button button-secondary"
                    href={`/practice?role=${encodeURIComponent(item.role.name)}`}
                  >
                    Practice role <ArrowRight size={12} />
                  </Link>
                </div>
                <details className="career-more">
                  <summary>Skills & preparation ideas</summary>
                  <div>
                    <b>Skills to strengthen</b>
                    <p>
                      {item.missing
                        .slice(0, 5)
                        .map(skill => skill.name)
                        .join(" · ") ||
                        "Your selected skills map well to this role."}
                    </p>
                    <b>Course skill requirements</b>
                    <p>
                      {courseSkills
                        .filter(row => row.course_id === courseRecord?.id)
                        .slice(0, 5)
                        .map(row => joined(row, "skill")?.name)
                        .filter(Boolean)
                        .join(" · ") ||
                        "Add required course skills in the catalog to refine this path."}
                    </p>
                    <b>Preparation focus</b>
                    <p>
                      Review core {item.career.name.toLowerCase()} concepts,
                      prepare one example from your course, and practise a{" "}
                      {item.role.interview_types?.[0] || "domain"} interview.
                    </p>
                    <b>Certification ideas</b>
                    <ul>
                      {certificationIdeas(
                        item.career.name,
                        item.category?.name || ""
                      ).map(idea => (
                        <li key={idea}>{idea}</li>
                      ))}
                    </ul>
                  </div>
                </details>
              </Panel>
            ))}
          </div>
          <Panel
            title="Skills worth developing next"
            subtitle="Based on role-skill requirements connected to the administrator-managed catalog."
          >
            <div className="weak-skill-strip">
              {prioritySkills.length ? (
                prioritySkills.map(skill => (
                  <Tag tone="violet" key={skill}>
                    {skill}
                  </Tag>
                ))
              ) : (
                <p className="muted-small">
                  Add role-skill requirements in the Admin catalog to
                  personalize this section.
                </p>
              )}
            </div>
            <div className="career-cta-row">
              <Link className="button button-primary" href="/study-plan">
                Build a personalized study plan <ArrowRight size={13} />
              </Link>
              <Link className="button button-secondary" href="/resume">
                Compare resume with a job description <ArrowUpRight size={13} />
              </Link>
            </div>
          </Panel>
        </>
      )}
      <Panel
        title="How the fit estimate works"
        subtitle="A transparent navigation aid, not a predictor of interview selection."
      >
        <div className="fit-method-grid">
          <div>
            <b>Course relevance</b>
            <span>
              Discipline/category alignment in the configured career catalog.
            </span>
          </div>
          <div>
            <b>Skill overlap</b>
            <span>
              Your saved profile and resume skills intersect with managed role
              requirements.
            </span>
          </div>
          <div>
            <b>Career interest</b>
            <span>
              Your target role, career preference and stated interest areas
              influence ranking.
            </span>
          </div>
          <div>
            <b>Practice signal</b>
            <span>
              Recent completed practice contributes a small capped adjustment.
            </span>
          </div>
        </div>
        <p className="baseline-note">
          Suggested credentials are general starting points. Check local
          professional and academic requirements before enrolling.
        </p>
      </Panel>
    </div>
  );
}
