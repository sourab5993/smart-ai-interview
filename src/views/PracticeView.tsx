import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Mic,
  Volume2,
  VolumeX,
  Clock,
  AlertCircle,
  SkipForward,
  CheckCircle2,
  BrainCircuit,
  ArrowRight,
  ChevronRight,
  HelpCircle,
  Play,
  RotateCcw,
  X,
  Flame,
  Award,
  GraduationCap,
  Languages,
  BookOpen,
  Briefcase,
  Plus,
  List,
  Lock,
  Camera,
  Video,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AI3DCore } from '../components/AI3DCore';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { FeedbackModal } from '../components/FeedbackModal';
import { CameraBehaviorMonitor, CameraBehaviorMonitorRef } from '../components/CameraBehaviorMonitor';
import { DifficultyLevel, InterviewType, InterviewQuestion, Language } from '../types';
import { formatTimer } from '../utils/uiHelpers';

export const PracticeView: React.FC = () => {
  const {
    user,
    activeSession,
    coursesCatalog,
    jobRolesCatalog,
    startNewInterview,
    submitAnswer,
    nextQuestion,
    skipCurrentQuestion,
    completeActiveInterview,
    abandonInterview,
    isAiGenerating,
    isAiEvaluating,
    setCurrentView,
    isAuthenticated,
  } = useApp();

  // Setup form states
  const [selectedCourseId, setSelectedCourseId] = useState<string>(user.courseId || 'c_btech');
  const [selectedSpec, setSelectedSpec] = useState<string>(user.specialization || 'Computer Science & Engineering');
  const [role, setRole] = useState<string>(user.targetRole || 'Full Stack Developer');
  const [isCustomRole, setIsCustomRole] = useState<boolean>(() => {
    const defaultCourseId = user.courseId || 'c_btech';
    const roles = jobRolesCatalog.filter((r) => r.associatedCourseIds?.includes(defaultCourseId));
    return !roles.some((r) => r.title.toLowerCase() === (user.targetRole || '').toLowerCase());
  });
  const [customRoleInput, setCustomRoleInput] = useState<string>(user.targetRole || '');
  const [type, setType] = useState<InterviewType>('Technical');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Medium');
  const [language, setLanguage] = useState<Language>(user.preferredLanguage || 'English');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(user.topSkills || ['TypeScript', 'React', 'Node.js', 'PostgreSQL']);
  const [questionCount, setQuestionCount] = useState<number>(3);
  const [durationMinutes, setDurationMinutes] = useState<number>(15);

  // Live session states
  const [isSpeakingAI, setIsSpeakingAI] = useState<boolean>(false);
  const [isTtsMuted, setIsTtsMuted] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(900);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [showRubricHint, setShowRubricHint] = useState<boolean>(false);

  const timerRef = useRef<any>(null);
  const cameraRef = useRef<CameraBehaviorMonitorRef | null>(null);

  const currentCourse = coursesCatalog.find((c) => c.id === selectedCourseId) || coursesCatalog[0];
  const compatibleRoles = jobRolesCatalog.filter(
    (r) => r.associatedCourseIds?.includes(selectedCourseId) || r.recommendedCourse === currentCourse.name
  );

  const handleCourseChange = (cId: string) => {
    setSelectedCourseId(cId);
    const course = coursesCatalog.find((c) => c.id === cId) || coursesCatalog[0];
    setSelectedSpec(course.specializations[0] || 'General');

    const roles = jobRolesCatalog.filter((r) => r.associatedCourseIds?.includes(cId) || r.recommendedCourse === course.name);
    if (roles.length > 0) {
      setRole(roles[0].title);
    }
    if (course.defaultSkills && course.defaultSkills.length > 0) {
      setSelectedSkills(course.defaultSkills.slice(0, 5));
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  };

  const handleStart = () => {
    startNewInterview({
      course: currentCourse.name,
      specialization: selectedSpec,
      role,
      type,
      difficulty,
      language,
      skills: selectedSkills,
      questionCount,
      durationMinutes,
    });
  };

  // Timer countdown for active session
  useEffect(() => {
    if (activeSession) {
      setRemainingSeconds(activeSession.durationMinutes * 60);
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession?.id]);

  // Read question out loud when question changes
  useEffect(() => {
    if (!activeSession) return;
    const currentQ = activeSession.questions[activeSession.currentQuestionIndex];
    if (currentQ && !isTtsMuted && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentQ.question);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeakingAI(true);
      utterance.onend = () => setIsSpeakingAI(false);
      utterance.onerror = () => setIsSpeakingAI(false);
      window.speechSynthesis.speak(utterance);
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [activeSession?.currentQuestionIndex, isTtsMuted]);

  // Handle Answer submission
  const handleSubmitAnswer = async (text: string, mode: 'voice' | 'text') => {
    if (!activeSession) return;
    const telemetry = cameraRef.current?.getTelemetryAndReset();
    await submitAnswer(text, mode, telemetry);
    setShowFeedbackModal(true);
  };

  const handleProceedNext = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setShowFeedbackModal(false);
    nextQuestion();
  };


  // ================= GUARD AUTHENTICATION =================
  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-black text-slate-100">Sign In Required to Start Interview</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          AI mock interviews, speech recognition, and deep rubric grading are exclusively available to authenticated users. Please sign in or register to proceed.
        </p>
        <button
          type="button"
          onClick={() => setCurrentView('login')}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  // ================= RENDER LIVE SESSION =================
  if (activeSession) {
    const currentQ: InterviewQuestion = activeSession.questions[activeSession.currentQuestionIndex];
    const isLastQuestion = activeSession.currentQuestionIndex === activeSession.totalQuestions - 1;

    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-16" id="live-interview-stage">
        {/* Stage Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[11px] font-bold font-mono">
                  {activeSession.course || currentCourse.name}
                </span>
                <h1 className="text-sm sm:text-base font-bold text-slate-100">{activeSession.title}</h1>
              </div>
              <p className="text-xs text-slate-400">
                {activeSession.role} • {activeSession.difficulty} • {activeSession.language || 'English'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {/* Timer */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={() => setIsTtsMuted(!isTtsMuted)}
              title={isTtsMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            >
              {isTtsMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* Abandon Session */}
            <button
              onClick={abandonInterview}
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Question Progress Dots */}
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="text-xs font-semibold text-slate-400">
            Question {activeSession.currentQuestionIndex + 1} of {activeSession.totalQuestions}
          </span>
          <div className="flex items-center gap-1.5">
            {activeSession.questions.map((q, idx) => (
              <div
                key={q.id}
                className={`h-2 rounded-full transition-all ${
                  idx === activeSession.currentQuestionIndex
                    ? 'w-8 bg-cyan-400'
                    : q.status === 'answered'
                    ? 'w-4 bg-emerald-400'
                    : q.status === 'skipped'
                    ? 'w-4 bg-amber-400'
                    : 'w-4 bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Main Stage Grid: 3D AI Orb + Camera Monitor + Question & Response */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Dual AI Core & Candidate Camera Behavior Monitor */}
          <div className="lg:col-span-5 space-y-4">
            {/* 3D AI Core Avatar Card */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-radial from-cyan-500/10 via-transparent to-transparent pointer-events-none" />

              <div className="relative z-10 w-full flex flex-col items-center">
                <AI3DCore size="sm" isSpeaking={isSpeakingAI} />

                <div className="mt-3 text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] font-mono">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isAiEvaluating
                          ? 'bg-violet-400 animate-pulse'
                          : isSpeakingAI
                          ? 'bg-cyan-400 animate-ping'
                          : 'bg-emerald-400 animate-pulse'
                      }`}
                    />
                    <span className="text-slate-300">
                      {isAiEvaluating
                        ? 'Analyzing Evaluation Rubric...'
                        : isSpeakingAI
                        ? 'AI Bar Raiser Speaking...'
                        : 'AI Coach Listening...'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    {currentCourse.name} • {currentQ?.category || 'Domain Assessment'}
                  </p>
                </div>
              </div>
            </div>

            {/* Candidate Live Camera Feed & Non-Verbal Computer Vision Monitor */}
            <CameraBehaviorMonitor
              ref={cameraRef}
              isInterviewActive={true}
              questionId={currentQ?.id}
            />
          </div>

          {/* Right Column: Question Display & Interactive Answer Workspace */}
          <div className="lg:col-span-7 space-y-4">
            {/* Question Card */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-6 space-y-3 relative shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                  {currentQ?.category || 'Domain Concept'}
                </span>
                <button
                  onClick={() => setShowRubricHint(!showRubricHint)}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showRubricHint ? 'Hide Key Concepts' : 'Show Key Concepts'}</span>
                </button>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-snug tracking-tight">
                {currentQ?.question}
              </h2>

              {showRubricHint && currentQ?.expectedKeyPoints && currentQ.expectedKeyPoints.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 rounded-xl bg-slate-950/80 border border-cyan-500/20 text-xs text-slate-300 space-y-1"
                >
                  <span className="font-bold text-cyan-300 block">Evaluation Target Concepts:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                    {currentQ.expectedKeyPoints.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </div>

            {/* Voice & Text Response Workspace */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5">
              <VoiceRecorder
                key={currentQ?.id}
                disabled={isAiEvaluating}
                language={activeSession.language}
                onTranscriptChange={() => {}}
                onSubmitAnswer={handleSubmitAnswer}
                isSubmitting={isAiEvaluating}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={skipCurrentQuestion}
                  disabled={isAiEvaluating}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>{isLastQuestion ? 'Finish Interview' : 'Skip Question'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Modal */}
        {showFeedbackModal && currentQ?.evaluation && (
          <FeedbackModal
            isOpen={showFeedbackModal}
            onClose={() => setShowFeedbackModal(false)}
            evaluation={currentQ.evaluation}
            onNextQuestion={handleProceedNext}
            isLastQuestion={isLastQuestion}
          />
        )}
      </div>
    );
  }

  // ================= SETUP SCREEN =================
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16" id="practice-setup-view">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Universal AI Mock Interview Studio</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <Camera className="w-3.5 h-3.5" />
              <span>Webcam & Live Behavior Scoring Active</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            Launch Your Live Adaptive Interview
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Personalized for <strong className="text-cyan-300">{currentCourse.name} ({selectedSpec})</strong>. Gemini generates discipline-accurate questions, listens via real-time speech recognition, tracks eye-contact & posture via webcam, and evaluates multi-dimensional performance.
          </p>
        </div>
      </div>

      {/* Configuration Matrix Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
        {/* Step 1: Course & Specialization */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5">
            1. Academic Degree & Faculty
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {coursesCatalog.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCourseChange(c.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedCourseId === c.id
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold font-mono">{c.name}</div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{c.fullName}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Specialization & Target Role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              2. Specialization / Major
            </label>
            <select
              value={selectedSpec}
              onChange={(e) => setSelectedSpec(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 outline-none"
            >
              {currentCourse.specializations.map((s) => (
                <option key={s} value={s} className="bg-slate-900">
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                3. Target Career Role
              </label>
              <button
                type="button"
                onClick={() => {
                  const nextCustom = !isCustomRole;
                  setIsCustomRole(nextCustom);
                  if (nextCustom && customRoleInput.trim()) {
                    setRole(customRoleInput.trim());
                  } else if (!nextCustom && compatibleRoles.length > 0) {
                    setRole(compatibleRoles[0].title);
                  }
                }}
                className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                {isCustomRole ? (
                  <>
                    <List className="w-3 h-3" />
                    <span>Choose from catalog</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    <span>+ Enter Custom Role</span>
                  </>
                )}
              </button>
            </div>

            {isCustomRole ? (
              <div className="space-y-2">
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-cyan-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value);
                      setCustomRoleInput(e.target.value);
                    }}
                    placeholder="e.g. AI / ML Engineer, Prompt Specialist, Cloud Architect..."
                    className="w-full bg-slate-950 border border-cyan-500/50 focus:border-cyan-400 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none shadow-sm shadow-cyan-500/10 transition-all"
                  />
                </div>
                {/* Popular Role Quick Suggestions */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Quick suggestions:</span>
                  {[
                    'AI / ML Engineer',
                    'Data Scientist',
                    'DevOps Engineer',
                    'Cloud Architect',
                    'Cybersecurity Analyst',
                    'Product Manager',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setRole(preset);
                        setCustomRoleInput(preset);
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        role === preset
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-semibold'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <select
                value={role}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setIsCustomRole(true);
                  } else {
                    setRole(e.target.value);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
              >
                {compatibleRoles.map((r) => (
                  <option key={r.id} value={r.title} className="bg-slate-900">
                    {r.title}
                  </option>
                ))}
                <option value="__custom__" className="bg-slate-900 text-cyan-400 font-bold">
                  + Enter custom / other role...
                </option>
              </select>
            )}
          </div>
        </div>

        {/* Step 3: Format & Difficulty & Language */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              4. Interview Format
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as InterviewType)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 outline-none"
            >
              <option value="Technical">Technical</option>
              <option value="Domain">Domain Discipline</option>
              <option value="Behavioral">Behavioral (STAR Method)</option>
              <option value="Situational">Situational Judgment</option>
              <option value="Case Study">Case Study Analysis</option>
              <option value="Viva">Viva Voce</option>
              <option value="HR">HR & Cultural Fit</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              5. Difficulty Level
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['Easy', 'Medium', 'Hard'] as DifficultyLevel[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    difficulty === d
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              6. Communication Language
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['English', 'Hindi', 'Hinglish'] as Language[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    language === l
                      ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step 4: Questions Count & Skills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Question Count
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[3, 5, 8].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setQuestionCount(c);
                    setDurationMinutes(c * 4);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    questionCount === c
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {c} Questions
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Target Skills Tested
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {(currentCourse.defaultSkills || currentCourse.coreSubjects || []).map((s) => {
                const isSel = selectedSkills.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSkill(s)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                      isSel
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Launch Button */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Estimated duration: <strong className="text-slate-200">{durationMinutes} Minutes</strong>
          </div>

          <button
            type="button"
            disabled={isAiGenerating}
            onClick={handleStart}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isAiGenerating ? 'Generating Adaptive Questions...' : 'Start Mock Interview'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
