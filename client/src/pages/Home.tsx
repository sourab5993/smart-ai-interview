import {
  useEffect,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "wouter";
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleHelp,
  FileSearch,
  GraduationCap,
  MessageSquareText,
  Mic2,
  Orbit,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";

const features = [
  {
    icon: MessageSquareText,
    title: "Mock interviews that fit your path",
    text: "Questions move with your course, target role, experience and last session—not a one-size-fits-all script.",
    tone: "cyan",
  },
  {
    icon: FileSearch,
    title: "A resume with a clear signal",
    text: "See relevant strengths, skill matches and practical edits that make your next application sharper.",
    tone: "violet",
  },
  {
    icon: BarChart3,
    title: "Feedback you can put to work",
    text: "Understand what landed, what was missing and how to shape a more complete answer next time.",
    tone: "blue",
  },
  {
    icon: Mic2,
    title: "Speak it or type it",
    text: "Practice out loud when your browser supports it, or use text whenever you prefer.",
    tone: "pink",
  },
  {
    icon: Target,
    title: "Know what to work on next",
    text: "Turn interview history into course-aware priorities and a focused improvement plan.",
    tone: "gold",
  },
  {
    icon: TrendingUp,
    title: "Progress that feels measurable",
    text: "Compare sessions, spot patterns and build readiness one intentional practice at a time.",
    tone: "mint",
  },
];
const steps = [
  {
    n: "01",
    title: "Build your profile",
    text: "Add your course, specialization, skills and the role you have in mind.",
  },
  {
    n: "02",
    title: "Practice with your coach",
    text: "Take a realistic interview—in voice or text—built around your path.",
  },
  {
    n: "03",
    title: "Understand your signal",
    text: "See clear strengths, gaps and specific feedback after every answer.",
  },
  {
    n: "04",
    title: "Improve & repeat",
    text: "Follow a personal plan, practice a weak area and compare your growth.",
  },
];
const roles = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Analyst",
  "Data Scientist",
  "ML Engineer",
  "DevOps Engineer",
  "Cybersecurity Analyst",
  "QA Engineer",
  "Product Manager",
  "Mechanical Design Engineer",
  "Civil Engineer",
  "Financial Analyst",
  "Marketing Executive",
  "Staff Nurse",
  "Legal Associate",
  "Content Writer",
  "Research Assistant",
  "Teacher",
  "Product Designer",
  "Agriculture Officer",
];
const quotes = [
  {
    quote:
      "I finally got questions that made sense for my finance background. The feedback gave me one clear thing to improve each time.",
    name: "Aarav M.",
    course: "B.Com · Accounting & Finance",
  },
  {
    quote:
      "Being able to rehearse out loud and then see a structured answer breakdown made prep feel much less overwhelming.",
    name: "Riya S.",
    course: "B.Tech · Mechanical",
  },
  {
    quote:
      "I used the study plan to keep my preparation focused around a busy semester. Small sessions were easier to stick with.",
    name: "Neha K.",
    course: "BBA · Marketing",
  },
];
const accessOptions = [
  {
    icon: Target,
    title: "Focused practice",
    text: "Course-aware mock interviews, answer feedback, a saved report and a clear next step.",
  },
  {
    icon: TrendingUp,
    title: "A steady routine",
    text: "Resume and role insights, skill priorities, a 7-, 14- or 30-day study plan and session comparisons.",
  },
  {
    icon: GraduationCap,
    title: "Course-aware learning",
    text: "A multi-discipline question bank, editable role catalogs and academic project insights.",
  },
];

export function Home() {
  const [menu, setMenu] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    )
      return;

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".landing main > :not(.hero-section)"
      )
    ).filter(target => target.getBoundingClientRect().top > window.innerHeight);
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("motion-entered");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );

    for (const target of targets) {
      target.classList.add("motion-ready");
      observer.observe(target);
    }
    return () => observer.disconnect();
  }, []);
  const closeMenu = () => setMenu(false);
  function moveCore(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTilt({
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 10,
      y: (0.5 - (event.clientY - rect.top) / rect.height) * 8,
    });
  }
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <span />
          </span>
          <span>
            SMART <b>INTERVIEW</b>
          </span>
        </Link>
        <nav
          className={menu ? "landing-links show" : "landing-links"}
          aria-label="Main navigation"
        >
          <a href="#features" onClick={closeMenu}>
            Features
          </a>
          <a href="#how" onClick={closeMenu}>
            How it works
          </a>
          <a href="#evaluation" onClick={closeMenu}>
            AI evaluation
          </a>
          <a href="#plans" onClick={closeMenu}>
            Plans
          </a>
          <a href="#paths" onClick={closeMenu}>
            Explore paths
          </a>
          <a href="#about" onClick={closeMenu}>
            About
          </a>
        </nav>
        <div className="landing-actions">
          <Link className="nav-login" href="/login">
            Sign in
          </Link>
          <Link className="button button-primary nav-cta" href="/signup">
            Get started <ArrowRight size={15} />
          </Link>
        </div>
        <button
          type="button"
          className="mobile-menu icon-button landing-menu"
          onClick={() => setMenu(!menu)}
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
        >
          {menu ? <X /> : <span className="hamburger">☰</span>}
        </button>
      </header>
      <main>
        <section className="hero-section">
          <div className="hero-gridlines" />
          <div className="hero-copy">
            <div className="hero-badge">
              <span className="tiny-orb" /> AI-POWERED INTERVIEW COACH{" "}
              <span className="badge-rule" /> FOR EVERY CAREER
            </div>
            <h1>
              Your AI Interview Coach.
              <br />
              <span>Built to Make You Better.</span>
            </h1>
            <p className="hero-lede">
              Practice realistic interviews, get instant AI feedback, identify
              your weak skills, and build the confidence to crack your next
              interview.
            </p>
            <div className="hero-buttons">
              <Link
                href="/signup"
                className="button button-primary button-large"
              >
                Start practicing <ArrowRight size={17} />
              </Link>
              <a href="#how" className="button button-glass button-large">
                <span className="play-icon">
                  <Play size={12} fill="currentColor" />
                </span>
                Explore demo
              </a>
            </div>
            <div className="hero-proof">
              <div className="proof-avatars" aria-label="Example disciplines">
                <span>ENG</span>
                <span>BUS</span>
                <span>CARE</span>
                <span>+</span>
              </div>
              <div>
                <p>Learners across disciplines</p>
                <small>Built around your course, not just a job title</small>
              </div>
              <span className="proof-divider" />
              <span className="proof-course">
                <GraduationCap size={15} /> Every course
              </span>
            </div>
          </div>
          <div
            className="hero-visual"
            role="group"
            aria-label="Illustrative AI interview coaching interface"
            onPointerMove={moveCore}
            onPointerLeave={() => setTilt({ x: 0, y: 0 })}
            style={
              {
                "--hero-tilt-x": `${tilt.x}deg`,
                "--hero-tilt-y": `${tilt.y}deg`,
              } as CSSProperties
            }
          >
            <div
              className="orb-scene"
              aria-label="Animated interview intelligence core"
            >
              <div className="orb-ring orb-ring-a" />
              <div className="orb-ring orb-ring-b" />
              <div className="orb-ring orb-ring-c" />
              <div className="orb-core">
                <div className="orb-core-inner">
                  <Orbit size={64} strokeWidth={1} />
                  <span className="orb-pulse" />
                </div>
              </div>
              <div className="orb-satellite sat-resume">
                <FileSearch />
                <span>RESUME</span>
              </div>
              <div className="orb-satellite sat-skill">
                <Target />
                <span>SKILLS</span>
              </div>
              <div className="orb-satellite sat-score">
                <BarChart3 />
                <span>SCORE</span>
              </div>
              <div className="orb-satellite sat-voice">
                <AudioLines />
                <span>VOICE</span>
              </div>
              <div className="orb-satellite sat-question">
                <MessageSquareText />
                <span>QUESTIONS</span>
              </div>
              <div className="orb-satellite sat-analysis">
                <Sparkles />
                <span>ANALYSIS</span>
              </div>
              <div className="orb-satellite sat-career">
                <BriefcaseBusiness />
                <span>CAREER</span>
              </div>
              <i className="particle p1" />
              <i className="particle p2" />
              <i className="particle p3" />
              <i className="particle p4" />
              <i className="particle p5" />
            </div>
            <div className="metric-float metric-quality">
              <span className="metric-dot cyan" />
              <span>Answer quality</span>
              <b>92%</b>
              <small>Illustrative example</small>
            </div>
            <div className="metric-float metric-tech">
              <span className="metric-dot violet" />
              <span>Technical score</span>
              <b>87%</b>
              <small>Illustrative example</small>
            </div>
            <div className="metric-float metric-ai">
              <span className="ai-check">
                <Check size={12} />
              </span>
              <span>AI evaluation</span>
              <b>Complete</b>
            </div>
            <div className="visual-caption">
              <span className="caption-line" /> ILLUSTRATIVE INTERVIEW
              INTELLIGENCE CORE
            </div>
          </div>
          <div className="hero-bottomline">
            <span>
              <ShieldCheck size={14} /> Private by design
            </span>
            <span>One AI Coach. Every Course. Every Career.</span>
            <a href="#features" aria-label="Explore features">
              <ArrowDown size={17} />
            </a>
          </div>
        </section>
        <section className="marquee-strip" aria-label="Supported disciplines">
          <span>TECHNOLOGY</span>
          <i />
          <span>COMMERCE</span>
          <i />
          <span>HEALTHCARE</span>
          <i />
          <span>LAW</span>
          <i />
          <span>BUSINESS</span>
          <i />
          <span>DESIGN</span>
          <i />
          <span>SCIENCE</span>
          <i />
          <span>EDUCATION</span>
          <i />
          <span>AND BEYOND</span>
        </section>
        <section className="section section-features" id="features">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                <Sparkles size={13} /> A BETTER WAY TO PREPARE
              </span>
              <h2>
                Everything you need
                <br />
                to <span>practice with purpose.</span>
              </h2>
            </div>
            <p>
              Not just another question list. A focused practice system that
              sees the course behind your career goal—and helps you move
              forward.
            </p>
          </div>
          <div className="features-grid">
            {features.map(f => {
              const Icon = f.icon;
              return (
                <article className="feature-card" key={f.title}>
                  <div className={`feature-icon ${f.tone}`}>
                    <Icon size={20} />
                  </div>
                  <div className="feature-corner">
                    <ChevronRight size={15} />
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                  <div className="feature-line" />
                </article>
              );
            })}
          </div>
        </section>
        <section className="section how-section" id="how">
          <div className="how-left">
            <span className="eyebrow">
              <span className="eyebrow-num">01 — 04</span> YOUR PRACTICE LOOP
            </span>
            <h2>
              From preparation
              <br />
              to <span>performance.</span>
            </h2>
            <p>
              Progress isn't a single score. It's knowing what to try next—and
              building momentum from there.
            </p>
            <Link href="/signup" className="text-link">
              Build your interview profile <ArrowRight size={15} />
            </Link>
            <div className="how-orbit">
              <div />
              <span>PREPARE</span>
              <span>PRACTICE</span>
              <span>REFLECT</span>
              <span>REPEAT</span>
            </div>
          </div>
          <div className="steps-list">
            {steps.map((s, i) => (
              <article className="step-row" key={s.n}>
                <div className="step-no">
                  {s.n}
                  <span className="step-node" />
                </div>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
                <div className={`step-icon si-${i}`}>
                  {
                    [
                      <GraduationCap key="profile" />,
                      <Mic2 key="practice" />,
                      <Target key="insight" />,
                      <TrendingUp key="repeat" />,
                    ][i]
                  }
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="section evaluation-section" id="evaluation">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                <span className="tiny-orb" /> MORE THAN A GUT FEELING
              </span>
              <h2>
                AI evaluates what
                <br />
                traditional practice <span>misses.</span>
              </h2>
            </div>
            <p>
              Specific, role-aware signals make your next practice more useful.
              Feedback is educational—not a hiring decision.
            </p>
          </div>
          <div className="evaluation-panel">
            <div className="evaluation-info">
              <div className="eval-label">
                <span>01</span> MULTI-DIMENSIONAL FEEDBACK
              </div>
              <h3>
                See how your answer
                <br />
                actually came across.
              </h3>
              <p>
                Each interview can use criteria matched to its type and course.
                No irrelevant rubric. No black-box verdict.
              </p>
              <div className="eval-sample">
                <div className="eval-sample-top">
                  <span className="metric-dot cyan" /> SAMPLE ANSWER SIGNALS
                </div>
                <div className="eval-score-row">
                  <span>Concept understanding</span>
                  <div
                    className="meter"
                    role="meter"
                    aria-label="Concept understanding"
                    aria-valuenow={86}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    style={{ "--meter": "86%" } as CSSProperties}
                  />
                  <b>86</b>
                </div>
                <div className="eval-score-row">
                  <span>Answer structure</span>
                  <div
                    className="meter violet-meter"
                    role="meter"
                    aria-label="Answer structure"
                    aria-valuenow={72}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    style={{ "--meter": "72%" } as CSSProperties}
                  />
                  <b>72</b>
                </div>
                <div className="eval-score-row">
                  <span>Evidence & examples</span>
                  <div
                    className="meter blue-meter"
                    role="meter"
                    aria-label="Evidence and examples"
                    aria-valuenow={64}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    style={{ "--meter": "64%" } as CSSProperties}
                  />
                  <b>64</b>
                </div>
                <small>Illustrative example · not a model benchmark</small>
              </div>
            </div>
            <div className="dimension-cloud">
              {[
                "Technical accuracy",
                "Relevance",
                "Completeness",
                "Communication",
                "Clarity",
                "Confidence",
                "Structure",
                "Problem solving",
              ].map((x, i) => (
                <span key={x} className={`dimension-chip dc-${i}`}>
                  <i />
                  {x}
                </span>
              ))}
              <div className="dimension-center">
                <Orbit size={26} />
                <span>
                  COURSE
                  <br />
                  AWARE
                </span>
              </div>
            </div>
          </div>
        </section>
        <section className="growth-section">
          <div className="growth-copy">
            <span className="eyebrow">
              <TrendingUp size={14} /> REAL PROGRESS, REFLECTED
            </span>
            <h2>
              Practice is a skill.
              <br />
              <span>So is getting better.</span>
            </h2>
            <p>
              Your session history helps surface patterns over time—from a
              clearer explanation to stronger field-specific reasoning.
            </p>
            <Link href="/signup" className="button button-primary">
              See your path <ArrowRight size={15} />
            </Link>
          </div>
          <div className="growth-chart-card">
            <div className="chart-header">
              <div>
                <span className="eyebrow">SAMPLE PRACTICE JOURNEY</span>
                <h3>One step at a time</h3>
              </div>
              <span className="chart-period">ILLUSTRATIVE</span>
            </div>
            <div className="chart-stats">
              <div>
                <span>Session signal</span>
                <b>
                  +18 <small>pts</small>
                </b>
              </div>
              <div>
                <span>Practice rhythm</span>
                <b>
                  5 <small>sessions</small>
                </b>
              </div>
              <div className="chart-legend">
                <i /> Overall <i className="legend-soft" /> Communication
              </div>
            </div>
            <div className="linechart">
              <div className="chart-y">
                <span>100</span>
                <span>75</span>
                <span>50</span>
                <span>25</span>
              </div>
              <svg
                viewBox="0 0 660 190"
                preserveAspectRatio="none"
                role="img"
                aria-label="Illustrative score trend rising over five sample sessions"
              >
                <defs>
                  <linearGradient id="growthFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#61dfff" stopOpacity=".18" />
                    <stop offset="1" stopColor="#61dfff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  className="chart-area"
                  d="M0 150 C50 140 64 126 110 136 S178 120 220 112 S292 122 330 96 S397 108 440 73 S506 90 550 55 S615 53 660 23 L660 190 L0 190Z"
                />
                <path
                  className="chart-line"
                  d="M0 150 C50 140 64 126 110 136 S178 120 220 112 S292 122 330 96 S397 108 440 73 S506 90 550 55 S615 53 660 23"
                />
                <path
                  className="chart-line chart-line-soft"
                  d="M0 164 C50 152 64 158 110 149 S178 141 220 145 S292 131 330 133 S397 123 440 112 S506 121 550 107 S615 100 660 94"
                />
                <circle cx="660" cy="23" r="5" className="chart-point" />
              </svg>
            </div>
            <div className="chart-x">
              <span>START</span>
              <span>SESSION 02</span>
              <span>SESSION 03</span>
              <span>SESSION 04</span>
              <span>NOW</span>
            </div>
            <p className="chart-disclaimer">
              Illustrative trend only. Your dashboard uses your saved sessions.
            </p>
          </div>
        </section>
        <section className="section roles-section" id="paths">
          <div className="roles-heading">
            <div>
              <span className="eyebrow">YOUR COURSE IS A STARTING POINT</span>
              <h2>
                Built for the roles
                <br />
                <span>you want.</span>
              </h2>
            </div>
            <p>
              From your first internship to a career change, prepare for a role
              that fits your direction.
            </p>
          </div>
          <div className="role-chips">
            {roles.map((role, i) => (
              <Link
                className={`role-chip ${i === roles.length - 1 ? "role-chip-last" : ""}`}
                key={role}
                href={`/practice?role=${encodeURIComponent(role)}`}
              >
                <BriefcaseBusiness size={14} /> {role}
                <ArrowRight size={12} />
              </Link>
            ))}
            <Link className="role-chip role-chip-last" href="/practice">
              <Sparkles size={14} /> And your next path <ArrowRight size={13} />
            </Link>
          </div>
          <div className="career-note">
            <span>
              <Orbit size={16} />
            </span>
            <p>
              <b>One flexible system. Many different futures.</b>
              <br />
              Your course, specialization and target role guide what comes next.
            </p>
            <Link href="/signup" className="text-link">
              Find your starting point <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <section className="section plans-section" id="plans">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                <BookOpenCheck size={13} /> PLANS THAT FOLLOW YOUR PRACTICE
              </span>
              <h2>
                A useful next step.
                <br />
                <span>Not a paywall.</span>
              </h2>
            </div>
            <p>
              Choose the preparation path that fits your goal. This academic
              project preview has no checkout or subscription billing
              configured.
            </p>
          </div>
          <div className="access-card-grid">
            {accessOptions.map((item, i) => {
              const Icon = item.icon;
              return (
                <article
                  className={`access-card access-card-${i}`}
                  key={item.title}
                >
                  <span className="access-card-icon">
                    <Icon size={19} />
                  </span>
                  <span className="eyebrow">
                    PATH {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <Link href="/signup" className="text-link">
                    Explore the workspace <ArrowRight size={13} />
                  </Link>
                </article>
              );
            })}
          </div>
          <p className="plan-disclaimer">
            These cards describe product capabilities, not priced subscription
            tiers. Commercial pricing and checkout require a separate business
            decision.
          </p>
        </section>
        <section className="section testimonials-section" id="about">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A LITTLE MORE CONFIDENCE</span>
              <h2>
                Practice that meets
                <br />
                you <span>where you are.</span>
              </h2>
            </div>
            <p>
              These sample stories show the kinds of wins focused, course-aware
              practice can support.
            </p>
          </div>
          <div className="testimonial-grid">
            {quotes.map((q, i) => (
              <article className="testimonial" key={q.name}>
                <div className="quote-mark">“</div>
                <p>{q.quote}</p>
                <div className="quote-person">
                  <span className={`avatar quote-avatar qa-${i}`}>
                    {q.name.split(" ")[0][0]}
                    {q.name.split(" ")[1][0]}
                  </span>
                  <span>
                    <b>{q.name}</b>
                    <small>{q.course}</small>
                  </span>
                  <span className="quote-badge">SAMPLE</span>
                </div>
              </article>
            ))}
          </div>
          <p className="testimonial-note">
            Illustrative sample testimonials · no real user outcomes implied
          </p>
        </section>
        <section className="final-cta">
          <div className="cta-orb">
            <Orbit size={40} />
          </div>
          <div>
            <span className="eyebrow">A MORE FOCUSED KIND OF PRACTICE</span>
            <h2>Your next interview starts here.</h2>
            <p>
              Build your profile, pick a path and take your first practice step.
            </p>
          </div>
          <Link href="/signup" className="button button-primary button-large">
            Start your first interview <ArrowRight size={16} />
          </Link>
          <i className="cta-glow" />
        </section>
      </main>
      <footer className="landing-footer">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <span />
          </span>
          <span>
            SMART <b>INTERVIEW</b>
          </span>
        </Link>
        <span>Practice Smarter. Interview Better. Get Hired.</span>
        <Link href="/project-status" className="landing-status-link">Project progress</Link>
        <span>© 2026 · For preparation and learning</span>
      </footer>
    </div>
  );
}
export default Home;
