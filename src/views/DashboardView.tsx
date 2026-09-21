import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  BrainCircuit, 
  Flame, 
  Award, 
  BarChart3, 
  CalendarDays, 
  Clock, 
  FileText, 
  CheckCircle2, 
  Target, 
  Play, 
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Mic
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ScoreRing } from '../components/ScoreRing';
import { JOB_ROLES } from '../data/mockData';
import { RoleType, DifficultyLevel, InterviewType } from '../types';

export const DashboardView: React.FC = () => {
  const { 
    user, 
    pastSessions, 
    skills, 
    studyPlan, 
    setCurrentView, 
    setSelectedReportId,
    startNewInterview,
    isAiGenerating 
  } = useApp();

  const [selectedRole, setSelectedRole] = useState<RoleType>(user.targetRole || 'Full Stack Developer');
  const [selectedType, setSelectedType] = useState<InterviewType>('Technical');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('Medium');
  const [questionCount, setQuestionCount] = useState<number>(3);

  const completedSessions = pastSessions.filter(s => s.status === 'completed');
  const latestCompleted = completedSessions[0];

  const handleQuickStart = () => {
    startNewInterview({
      role: selectedRole,
      type: selectedType,
      difficulty: selectedDifficulty,
      skills: user.topSkills || ['React', 'Node.js', 'TypeScript', 'SQL'],
      questionCount,
      durationMinutes: questionCount * 4,
    });
  };

  const getReadinessBadge = (level: string) => {
    switch (level) {
      case 'High':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'Medium':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'Low':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 pb-12" id="dashboard-view">
      {/* Top Welcome Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-40 -top-10 w-60 h-60 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {user.targetRole}
              </span>
              <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>{user.currentStreak} Day Streak</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Welcome back, {user.name.split(' ')[0]}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Your ML Interview Readiness is currently scored at <strong className="text-cyan-300">{user.readinessScore}% ({user.readinessLevel} Readiness)</strong>. Complete today&apos;s adaptive practice module to reach 90%+.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setCurrentView('practice')}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-cyan-500/25 transition-all transform active:scale-95 cursor-pointer"
              id="btn-dash-start-interview"
            >
              <Mic className="w-4 h-4" />
              <span>Launch Live Mock</span>
            </button>
            <button
              onClick={() => setCurrentView('study-plan')}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
            >
              <CalendarDays className="w-4 h-4 text-cyan-400" />
              <span>Day 4 Plan</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Readiness Score */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Readiness</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <BrainCircuit className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-cyan-300">{user.readinessScore}%</span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getReadinessBadge(user.readinessLevel)}`}>
              {user.readinessLevel}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Based on logistic classifier</p>
        </div>

        {/* Stat 2: Average Score */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg. Score</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-violet-300">{user.avgScore}</span>
            <span className="text-xs text-slate-400 font-medium">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Best Score: <strong className="text-slate-200">{user.bestScore}/100</strong></p>
        </div>

        {/* Stat 3: Mock Interviews Completed */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mocks Taken</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-300">{completedSessions.length}</span>
            <span className="text-xs text-slate-400 font-medium">completed</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{user.questionsAnswered} questions answered</p>
        </div>

        {/* Stat 4: Resume ATS Score */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resume ATS</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-blue-300">{user.resumeScore}%</span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              Verified
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">{user.resumeFileName || 'Resume.pdf'}</p>
        </div>
      </div>

      {/* Main Row: Quick-Launch Interview + ML Readiness Deep-Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Quick Launch Panel (7 Cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100">Configure Quick Mock Session</h2>
                  <p className="text-[11px] text-slate-400">Instant AI generation with live voice transcription</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                Gemini 3.7 Live
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as RoleType)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none"
                >
                  {JOB_ROLES.map((r, i) => (
                    <option key={i} value={r.title} className="bg-slate-900">{r.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Interview Focus</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as InterviewType)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none"
                >
                  <option value="Technical">Technical & Coding</option>
                  <option value="System Design">System Design & Architecture</option>
                  <option value="Behavioral">Behavioral (STAR Method)</option>
                  <option value="Live Coding">Live Algorithmic Problem</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Difficulty Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Easy', 'Medium', 'Hard'] as DifficultyLevel[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDifficulty(d)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        selectedDifficulty === d
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Questions Count</label>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 8].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setQuestionCount(c)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        questionCount === c
                          ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {c} Qs (~{c * 4}m)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleQuickStart}
            disabled={isAiGenerating}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
            id="btn-launch-quick-interview"
          >
            {isAiGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating Adaptive Questions...</span>
              </>
            ) : (
              <>
                <span>Launch Mock Interview Session</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* ML Readiness Breakdown Panel (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-violet-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  ML Readiness Matrix
                </h3>
              </div>
              <button
                onClick={() => setCurrentView('performance')}
                className="text-[11px] font-semibold text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Analytics</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Circular Ring + Score */}
            <div className="flex items-center justify-center py-5">
              <ScoreRing
                score={user.readinessScore}
                size={140}
                strokeWidth={10}
                label="Readiness"
                sublabel={`${user.readinessLevel} Candidate Tier`}
              />
            </div>

            {/* 4 Feature Bar Sliders */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                  <span>Technical Accuracy (w: 0.35)</span>
                  <span className="text-cyan-300 font-mono">88%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: '88%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                  <span>Problem Solving (w: 0.25)</span>
                  <span className="text-blue-300 font-mono">82%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: '82%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                  <span>Communication (w: 0.20)</span>
                  <span className="text-violet-300 font-mono">84%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-violet-400 rounded-full" style={{ width: '84%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                  <span>Consistency / Retention (w: 0.20)</span>
                  <span className="text-emerald-300 font-mono">80%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: '80%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span>Pass probability across top tier hiring loops: <strong className="text-emerald-300">84.2%</strong></span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Interviews Table (8 Cols) + Focus Skill Gaps (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Interviews (8 Cols) */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-100">Recent Interview Performance</h3>
            <button
              onClick={() => setCurrentView('history')}
              className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>View All History</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800/80">
                  <th className="pb-3 font-semibold">Session Title</th>
                  <th className="pb-3 font-semibold">Type</th>
                  <th className="pb-3 font-semibold">Difficulty</th>
                  <th className="pb-3 font-semibold">Score</th>
                  <th className="pb-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pastSessions.slice(0, 4).map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 font-medium text-slate-200">
                      <div className="truncate max-w-[200px]">{sess.title}</div>
                      <div className="text-[10px] text-slate-500">{new Date(sess.startedAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3 text-slate-300">{sess.type}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sess.difficulty === 'Hard'
                          ? 'bg-rose-500/15 text-rose-300'
                          : sess.difficulty === 'Medium'
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-emerald-500/15 text-emerald-300'
                      }`}>
                        {sess.difficulty}
                      </span>
                    </td>
                    <td className="py-3 font-mono font-bold">
                      {sess.overallScore ? (
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-cyan-300">{sess.overallScore}/100</span>
                          {sess.behaviorScore && (
                            <span className="text-[10px] text-emerald-400 font-sans px-1 rounded bg-emerald-500/10 border border-emerald-500/20" title="Interview Behavior Score">
                              👁️ {sess.behaviorScore}%
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">In Progress</span>
                      )}
                    </td>
                    <td className="py-3">
                      {sess.report ? (
                        <button
                          onClick={() => {
                            setSelectedReportId(sess.report!.id);
                            setCurrentView('report');
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                        >
                          View Report
                        </button>
                      ) : (
                        <button
                          onClick={() => setCurrentView('practice')}
                          className="px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-semibold"
                        >
                          Resume
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Priority Skill Gaps (4 Cols) */}
        <div className="lg:col-span-4 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Priority Skill Gaps
                </h3>
              </div>
              <button
                onClick={() => setCurrentView('skill-gap')}
                className="text-[11px] font-semibold text-cyan-400 hover:underline"
              >
                Full Matrix
              </button>
            </div>

            <div className="space-y-3">
              {skills
                .filter(s => s.priority === 'High')
                .slice(0, 3)
                .map((sk) => (
                  <div key={sk.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-200">{sk.name}</span>
                      <span className="text-[10px] font-bold text-rose-400">Δ -{sk.requiredScore - sk.currentScore}%</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                      <span>Current: {sk.currentScore}%</span>
                      <span>Target: {sk.requiredScore}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full" style={{ width: `${sk.currentScore}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <button
            onClick={() => setCurrentView('study-plan')}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <span>Open Customized Study Plan</span>
            <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
