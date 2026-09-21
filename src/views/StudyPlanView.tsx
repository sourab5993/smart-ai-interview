import React, { useState } from 'react';
import { 
  CalendarDays, 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  Clock, 
  BookOpen, 
  ArrowRight, 
  Mic, 
  Target, 
  ChevronRight, 
  ExternalLink 
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const StudyPlanView: React.FC = () => {
  const { studyPlan, toggleStudyPlanItem, setCurrentView, startNewInterview, user } = useApp();
  const [selectedDay, setSelectedDay] = useState<number>(4);

  const currentDayItems = studyPlan.items.filter(item => item.dayNumber === selectedDay);
  const totalCompleted = studyPlan.items.filter(item => item.completed).length;
  const progressPercent = Math.round((totalCompleted / studyPlan.items.length) * 100);

  const dayTitles: { [key: number]: string } = {
    1: 'Day 1: DSA Foundations & Hash Table Mastery',
    2: 'Day 2: React Core & Performance Optimization',
    3: 'Day 3: Node.js, Express & Database Concurrency',
    4: 'Day 4: Distributed Caching & System Architecture',
    5: 'Day 5: Behavioral Storytelling (STAR Method)',
    6: 'Day 6: Full-Stack High-Scale Mock Simulation',
    7: 'Day 7: Final Review & Live Interview Rehearsal',
  };

  const handleLaunchDailyPractice = () => {
    startNewInterview({
      role: user.targetRole || 'Full Stack Developer',
      type: selectedDay === 4 ? 'System Design' : selectedDay === 5 ? 'Behavioral' : 'Technical',
      difficulty: selectedDay > 5 ? 'Hard' : 'Medium',
      skills: user.topSkills || ['React', 'Node.js', 'SQL'],
      questionCount: 3,
      durationMinutes: 15,
    });
  };

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto" id="study-plan-view">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-1">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Adaptive AI Remediation Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
              {studyPlan.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              {studyPlan.generatedReason || 'Custom remediation curriculum tailored to your interview performance.'}
            </p>
          </div>

          {/* Progress Pill */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[160px]">
            <div className="text-xs font-semibold text-slate-400">Plan Progress</div>
            <div className="text-2xl font-black font-mono text-emerald-400 my-1">{progressPercent}%</div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">{totalCompleted} of {studyPlan.items.length} tasks done</div>
          </div>
        </div>
      </div>

      {/* 7-Day Selector Bar */}
      <div className="flex items-center gap-2 overflow-x-auto p-2 rounded-2xl bg-slate-900/90 border border-slate-800">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const dayTasks = studyPlan.items.filter(i => i.dayNumber === day);
          const isDone = dayTasks.length > 0 && dayTasks.every(i => i.completed);
          const isSelected = selectedDay === day;

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`flex-1 min-w-[110px] p-3 rounded-xl border text-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border-cyan-500 text-cyan-300 shadow-md'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider">Day {day}</div>
              <div className="text-xs font-bold text-slate-200 mt-0.5 flex items-center justify-center gap-1">
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : `Task ${dayTasks.length}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day Focus Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Day {selectedDay} Curriculum</span>
            <h2 className="text-lg font-bold text-slate-100 mt-0.5">{dayTitles[selectedDay]}</h2>
          </div>

          <button
            onClick={handleLaunchDailyPractice}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/25 transition-all cursor-pointer whitespace-nowrap"
          >
            <Mic className="w-4 h-4" />
            <span>Launch Day {selectedDay} Practice Mock</span>
          </button>
        </div>

        {/* Task Items List */}
        <div className="space-y-4">
          {currentDayItems.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleStudyPlanItem(item.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                item.completed
                  ? 'bg-slate-950/40 border-slate-800/60 opacity-80'
                  : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <button
                type="button"
                className="mt-0.5 text-slate-400 hover:text-cyan-400 transition-colors flex-shrink-0"
              >
                {item.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-600" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-xs font-bold ${item.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                    {item.topic}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                    {item.focusArea}
                  </span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{item.estimatedMinutes} mins</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {item.description}
                </p>

                {item.resources && item.resources.length > 0 && (
                  <div className="mt-2 text-[11px] text-cyan-400 font-semibold flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    <span>Reference Guide: {item.resources[0].title}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div 
          onClick={() => setCurrentView('questions')}
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-bold text-slate-200">Practice in 100+ Question Bank</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Filter by DSA, System Design, React & Node</p>
          </div>
          <ChevronRight className="w-4 h-4 text-cyan-400" />
        </div>

        <div 
          onClick={() => setCurrentView('resume')}
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-violet-500/40 transition-all cursor-pointer flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-bold text-slate-200">Scan Resume for Target Role (ATS)</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Extract missing keywords and project bullet improvements</p>
          </div>
          <ChevronRight className="w-4 h-4 text-violet-400" />
        </div>
      </div>
    </div>
  );
};
