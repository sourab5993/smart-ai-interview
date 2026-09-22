import React from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Mic,
  BrainCircuit,
  FileText,
  BarChart3,
  Target,
  CalendarDays,
  ShieldCheck,
  Layers,
  Zap,
  ChevronRight,
  Star,
  Compass,
  GraduationCap,
  Briefcase,
  Languages,
  Mail,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { AI3DCore } from '../components/AI3DCore';
import { useApp } from '../context/AppContext';

export const LandingView: React.FC = () => {
  const { setCurrentView, login, coursesCatalog, jobRolesCatalog, isAuthenticated } = useApp();

  const faculties = [
    { name: 'Engineering & Tech', degrees: 'B.Tech, M.Tech, BCA, MCA', icon: '💻', desc: 'System Design, DSA, Embedded Systems, Mechanical, Civil & Electrical.' },
    { name: 'Medical & Health', degrees: 'MBBS, BDS, B.Pharm, Nursing', icon: '🩺', desc: 'Clinical Diagnostics, Pharmacology, Patient Ethics, Hospital Protocols.' },
    { name: 'Management & Business', degrees: 'MBA, BBA, PGDM', icon: '📈', desc: 'Business Strategy, Product Management, Financial Modeling, Case Studies.' },
    { name: 'Commerce & Finance', degrees: 'B.Com, M.Com, CA, CS, CMA', icon: '📊', desc: 'Taxation, Auditing, Corporate Accounting, Investment Banking, GST.' },
    { name: 'Law & Judiciary', degrees: 'LLB, LLM, BA-LLB', icon: '⚖️', desc: 'Constitutional Law, Corporate Compliance, Litigation Strategy, IRAC Case Analysis.' },
    { name: 'Design & Creative', degrees: 'B.Des, B.Arch, Fine Arts', icon: '🎨', desc: 'Design Systems, UI/UX Critiques, Spatial Design, Portfolio Presentations.' },
    { name: 'Science & Research', degrees: 'B.Sc, M.Sc, Biotech', icon: '🔬', desc: 'Experimental Methodologies, Statistical Inference, Laboratory Diagnostics.' },
    { name: 'Agriculture & Vocational', degrees: 'B.Sc Agri, Polytechnic, B.Voc', icon: '🌱', desc: 'Agronomy, Precision Agriculture, Applied Vocational Systems & Viva.' },
  ];

  const features = [
    {
      title: 'Universal AI Mock Engine',
      icon: BrainCircuit,
      description: 'Dynamically synthesizes discipline-accurate questions across 12+ academic categories tailored to your specific course & degree.',
      color: 'from-cyan-500 to-blue-600',
      targetView: 'practice',
    },
    {
      title: 'Voice Interviews & STT',
      icon: Mic,
      description: 'Speak your answers naturally using live Web Speech API transcription with real-time waveform audio analysis and confidence scoring.',
      color: 'from-blue-500 to-indigo-600',
      targetView: 'practice',
    },
    {
      title: '8-Dimension Evaluation',
      icon: Layers,
      description: 'Multidimensional rubric scoring: Domain Accuracy, STAR/IRAC Structure, Relevance, Communication, Confidence, and Problem Solving.',
      color: 'from-violet-500 to-purple-600',
      targetView: 'performance',
    },
    {
      title: 'Resume ATS & JD Matching',
      icon: FileText,
      description: 'Upload your CV for automated ATS parsing, discipline keyword gap extraction, and semantic job description alignment.',
      color: 'from-emerald-500 to-teal-600',
      targetView: 'resume',
    },
    {
      title: 'ML Readiness Predictor',
      icon: Target,
      description: 'Supervised ML classification pipeline predicts real-world placement probability (High/Medium/Low) based on historical performance vectors.',
      color: 'from-amber-500 to-orange-600',
      targetView: 'skill-gap',
    },
    {
      title: 'Adaptive 7-Day Study Plans',
      icon: CalendarDays,
      description: 'Automated day-by-day learning roadmaps that target your exact weak points with curated practice problems and key formulas.',
      color: 'from-rose-500 to-pink-600',
      targetView: 'study-plan',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Select Academic Degree & Target Career',
      desc: 'Choose from Engineering, Commerce, Medical, Law, Arts, or Vocational programs. The platform dynamically recalibrates its evaluation logic.',
    },
    {
      number: '02',
      title: 'Practice With Voice AI Bar Raiser',
      desc: 'Engage in live mock interviews. Gemini speaks questions out loud, listens to your verbal responses, and probes your domain depth.',
    },
    {
      number: '03',
      title: 'Receive Instant 8-Dimension Feedback',
      desc: 'Review comprehensive performance metrics, ideal model answers, and machine-learning predicted readiness classifications.',
    },
    {
      number: '04',
      title: 'Execute Personalized Study Plan',
      desc: 'Follow an automated 7-day curriculum designed specifically to eliminate your identified knowledge deficits.',
    },
  ];

  const dimensions = [
    { name: 'Technical / Domain Accuracy', desc: 'Discipline concepts, correct standards, APIs & terminology', score: '95%' },
    { name: 'Structural Delivery (STAR/IRAC)', desc: 'Logical flow, clear problem decomposition & methodology', score: '91%' },
    { name: 'Completeness & Depth', desc: 'Thorough coverage of tradeoffs, boundary conditions & nuance', score: '88%' },
    { name: 'Relevance & Precision', desc: 'Direct adherence to constraints without off-topic filler', score: '96%' },
    { name: 'Communication Fluency', desc: 'Professional clarity, articulate phrasing and vocabulary', score: '92%' },
    { name: 'Confidence & Conviction', desc: 'Decisive formulation with structured conviction', score: '87%' },
    { name: 'Problem Solving Method', desc: 'Depth of analytical reasoning & systematic troubleshooting', score: '90%' },
    { name: 'Discipline Synthesis', desc: 'Application to real-world commercial & clinical situations', score: '89%' },
  ];

  const testimonials = [
    {
      name: 'Dr. Rohan Deshmukh',
      role: 'Clinical Research Associate',
      college: 'B.Pharm Graduate (Class of 2025)',
      text: 'The medical and pharmacology interview scenarios were spot on with FDA regulatory and clinical trial protocols. It helped me land my dream role at a global CRO.',
      rating: 5,
    },
    {
      name: 'Sourab',
      role: 'Full Stack Engineer',
      college: 'B.Tech Computer Science',
      text: 'The 8-dimension AI feedback pinpointed exactly why my system architecture answers were lacking structure. The voice interview mode with live speech recognition makes it feel 100% real.',
      rating: 5,
    },
    {
      name: 'Aditya Sen',
      role: 'Corporate Legal Associate',
      college: 'National Law University',
      text: 'I was amazed that the AI knew how to evaluate IRAC legal methodology and corporate compliance principles. The 7-day study plan targeted my exact commercial law weak points.',
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar isLanding={true} />

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:py-24 overflow-hidden">
        {/* Background glow lines */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-cyan-500/10 via-indigo-500/5 to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Headlines & CTAs */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 shadow-lg shadow-cyan-950/40 text-xs font-semibold text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>UNIVERSAL AI INTERVIEW COACH</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">All Academic Courses</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-100 leading-[1.1]">
                Your AI Interview Coach. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400">
                  Every Course. Every Career.
                </span>
              </h1>

              {/* Supporting Text */}
              <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Whether you are graduating in <strong className="text-cyan-300">Engineering, Commerce, Medical, Law, Management, or Arts</strong> — practice realistic voice interviews with instant AI feedback, ML readiness predictions, and custom 7-day study plans.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      setCurrentView('login');
                    } else {
                      setCurrentView('practice');
                    }
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 transition-all transform active:scale-95 cursor-pointer"
                  id="hero-btn-start-practice"
                >
                  <span>Start Practicing Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isAuthenticated) {
                      setCurrentView('dashboard');
                    } else {
                      setCurrentView('login');
                    }
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-sm transition-all cursor-pointer"
                  id="hero-btn-explore-demo"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>{isAuthenticated ? 'Open Dashboard' : 'Explore Live Demo'}</span>
                </button>
              </div>

              {/* Trust Metrics */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800/80 max-w-lg mx-auto lg:mx-0 text-left">
                <div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-cyan-400">12+</div>
                  <div className="text-xs text-slate-400 font-medium">Academic Faculties</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-violet-400">8-Dim</div>
                  <div className="text-xs text-slate-400 font-medium">AI Rubric Scoring</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">91.4%</div>
                  <div className="text-xs text-slate-400 font-medium">ML Readiness Precision</div>
                </div>
              </div>
            </div>

            {/* Right Column: 3D AI Core Sphere */}
            <div className="lg:col-span-5 flex items-center justify-center">
              <AI3DCore interactive={true} size="lg" showFloatingBadges={true} />
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Discipline Faculties Grid */}
      <section className="py-16 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Universal Academic Coverage</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Calibrated for Every Academic Discipline
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              The AI adapts technical terminology, case study frameworks, and evaluation rubrics to match your degree.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {faculties.map((fac, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-2.5"
              >
                <div className="text-2xl mb-1">{fac.icon}</div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{fac.name}</h3>
                  <div className="text-[11px] font-mono font-semibold text-cyan-400">{fac.degrees}</div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{fac.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-20 bg-slate-950/60 border-t border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Zap className="w-3.5 h-3.5" />
              <span>Full-Stack Platform Capabilities</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              Everything you need to prepare.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 mt-3">
              Combining Generative AI, natural language evaluation, speech recognition, and machine-learning analytics into one unified preparation suite.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  onClick={() => setCurrentView(feat.targetView as any)}
                  className="group relative p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-950/40 flex flex-col justify-between cursor-pointer transform hover:-translate-y-1"
                  id={`feature-card-${idx}`}
                >
                  <div>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${feat.color} p-0.5 shadow-lg shadow-cyan-950/50 mb-5`}>
                      <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                        <Icon className="w-6 h-6 text-slate-100 group-hover:scale-110 transition-transform" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-cyan-300 transition-colors">
                      {feat.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentView(feat.targetView as any);
                    }}
                    className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between w-full text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    <span>Explore Module</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1.5 transition-transform" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4-Step Timeline */}
      <section id="how-it-works" className="py-20 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Compass className="w-3.5 h-3.5" />
              <span>Step-by-Step Candidate Journey</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              From preparation to performance.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 mt-3">
              A structured, evidence-based feedback loop designed to systematically elevate your interview readiness.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="relative p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"
                id={`step-card-${idx}`}
              >
                <div>
                  <div className="text-3xl font-black font-mono text-cyan-400/80 mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-base font-bold text-slate-100 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                <div className="mt-5 w-8 h-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8-Dimension Evaluation Breakdown */}
      <section id="evaluation" className="py-20 bg-slate-950 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Layers className="w-3.5 h-3.5" />
              <span>Deep Evaluation Framework</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              AI evaluates what traditional mock interviews miss.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 mt-3">
              Traditional mock interviews only tell you if you passed or failed. Smart Interview AI scores 8 distinct dimensions with specific, actionable feedback.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dimensions.map((dim, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">{dim.name}</span>
                    <span className="text-xs font-mono font-bold text-cyan-400">{dim.score}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{dim.desc}</p>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 mt-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                    style={{ width: dim.score }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target Roles Grid */}
      <section id="roles" className="py-20 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              Curated for In-Demand Industry Roles
            </h2>
            <p className="text-sm sm:text-base text-slate-400 mt-2">
              Explore specialized question banks and evaluation matrices for high-growth career tracks.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {jobRolesCatalog.slice(0, 12).map((role) => (
              <div
                key={role.id}
                onClick={() => {
                  if (isAuthenticated) {
                    setCurrentView('practice');
                  } else {
                    setCurrentView('login');
                  }
                }}
                className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800/70 transition-all cursor-pointer group"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-1">
                  {role.courseCategory}
                </div>
                <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                  {role.title}
                </h3>
                <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{role.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-slate-950 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              Proven Results Across Academic Departments
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed italic">
                    &ldquo;{t.text}&rdquo;
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <div className="text-xs font-bold text-slate-100">{t.name}</div>
                  <div className="text-[11px] text-cyan-400 font-semibold">{t.role}</div>
                  <div className="text-[10px] text-slate-500">{t.college}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Us & Support CTA Section */}
      <section id="contact-us" className="py-16 bg-slate-900/60 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 p-8 sm:p-12 relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="absolute -left-10 -top-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-3">
                <Mail className="w-3.5 h-3.5" />
                <span>Contact & Direct Support</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
                Have questions or need technical assistance?
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                Connect with our team directly at <span className="text-cyan-300 font-mono font-semibold">sourabstar786@gmail.com</span> for academic project inquiries, viva prep, or customized interview frameworks.
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setCurrentView('contact')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer transform active:scale-95"
              >
                <Mail className="w-4 h-4" />
                <span>Contact Us Form</span>
              </button>
              <a
                href="mailto:sourabstar786@gmail.com"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 hover:text-white font-semibold text-xs transition-all cursor-pointer"
              >
                <span>sourabstar786@gmail.com</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-950 border-t border-slate-800/80 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs">
              AI
            </div>
            <span className="font-bold text-slate-300">Smart AI Interview Preparation & Evaluation</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button 
              type="button" 
              onClick={() => setCurrentView('contact')} 
              className="hover:text-cyan-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Mail className="w-3.5 h-3.5 text-cyan-400" />
              <span>Contact: sourabstar786@gmail.com</span>
            </button>
          </div>
          <p>© 2026 Smart AI Interview Preparation System. Designed for Every Course & Career.</p>
        </div>
      </footer>
    </div>
  );
};
