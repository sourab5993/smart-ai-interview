import React, { useState } from 'react';
import { 
  Bookmark, 
  BookOpen, 
  FileText, 
  CalendarDays, 
  Sparkles, 
  Mic, 
  ArrowRight,
  Trash2
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const BookmarksView: React.FC = () => {
  const { 
    bookmarkedQuestionIds, 
    bookmarkedReportIds, 
    bookmarkedStudyIds, 
    questionBank, 
    pastSessions, 
    studyPlan, 
    toggleBookmark, 
    setSelectedReportId, 
    setCurrentView,
    startNewInterview,
    user
  } = useApp();

  const [activeTab, setActiveTab] = useState<'questions' | 'reports' | 'study'>('questions');

  const bookmarkedQuestions = questionBank.filter(q => bookmarkedQuestionIds.includes(q.id));
  const bookmarkedReports = pastSessions.filter(s => s.report && bookmarkedReportIds.includes(s.report.id));
  const bookmarkedStudyItems = studyPlan.items.filter(i => bookmarkedStudyIds.includes(i.id));

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto" id="bookmarks-view">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-3">
            <Bookmark className="w-3.5 h-3.5 fill-current" />
            <span>Candidate Saved Items</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            Bookmarked Questions & Evaluation Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
            Quickly revisit important architectural scenarios, high-priority study tasks, and standout interview reports.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800">
        <button
          onClick={() => setActiveTab('questions')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'questions'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Saved Questions ({bookmarkedQuestions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Saved Reports ({bookmarkedReports.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('study')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'study'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Study Tasks ({bookmarkedStudyItems.length})</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'questions' && (
        <div className="space-y-3">
          {bookmarkedQuestions.length === 0 ? (
            <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-500">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-xs">No questions bookmarked yet. Explore the Question Bank to save items.</p>
            </div>
          ) : (
            bookmarkedQuestions.map(q => (
              <div
                key={q.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {q.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{q.difficulty}</span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100">{q.question}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleBookmark('question', q.id)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer"
                    title="Remove Bookmark"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      startNewInterview({
                        role: user.targetRole || 'Full Stack Developer',
                        type: 'Technical',
                        difficulty: q.difficulty,
                        skills: q.tags || ['React', 'Node.js'],
                        questionCount: 1,
                        durationMinutes: 6,
                      });
                    }}
                    className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-sm"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Practice</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-3">
          {bookmarkedReports.length === 0 ? (
            <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-500">
              <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-xs">No reports bookmarked yet.</p>
            </div>
          ) : (
            bookmarkedReports.map(sess => (
              <div
                key={sess.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4"
              >
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100">{sess.title}</h3>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(sess.startedAt).toLocaleDateString()} • Score: <strong className="text-cyan-300">{sess.overallScore}%</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleBookmark('report', sess.report!.id)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedReportId(sess.report!.id);
                      setCurrentView('report');
                    }}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>View Report</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'study' && (
        <div className="space-y-3">
          {bookmarkedStudyItems.length === 0 ? (
            <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-500">
              <CalendarDays className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-xs">No study plan items bookmarked.</p>
            </div>
          ) : (
            bookmarkedStudyItems.map(item => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-[10px] font-bold uppercase text-emerald-400">Day {item.dayNumber} • {item.focusArea}</div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 mt-0.5">{item.topic}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                </div>

                <button
                  onClick={() => setCurrentView('study-plan')}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 whitespace-nowrap"
                >
                  <span>Open Day {item.dayNumber}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
