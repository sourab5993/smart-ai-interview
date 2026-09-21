import React, { useState } from 'react';
import { 
  History, 
  Sparkles, 
  ArrowRight, 
  Calendar, 
  Clock, 
  Award, 
  Layers, 
  ChevronRight, 
  CheckCircle2, 
  TrendingUp, 
  FileText 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ScoreRing } from '../components/ScoreRing';

export const HistoryView: React.FC = () => {
  const { 
    pastSessions, 
    setCurrentView, 
    setSelectedReportId, 
    activeCompareSessions, 
    setActiveCompareSessions 
  } = useApp();

  const [sessionAId, setSessionAId] = useState<string>(activeCompareSessions[0] || pastSessions[0]?.id || '');
  const [sessionBId, setSessionBId] = useState<string>(activeCompareSessions[1] || pastSessions[1]?.id || pastSessions[0]?.id || '');

  const sessionA = pastSessions.find(s => s.id === sessionAId) || pastSessions[0];
  const sessionB = pastSessions.find(s => s.id === sessionBId) || pastSessions[1] || pastSessions[0];

  const reportA = sessionA?.report;
  const reportB = sessionB?.report;

  const compareMetrics = [
    { label: 'Overall Score', a: reportA?.overallScore || 0, b: reportB?.overallScore || 0 },
    { label: 'Technical Accuracy', a: reportA?.technicalScore || 0, b: reportB?.technicalScore || 0 },
    { label: 'Relevance', a: reportA?.relevanceScore || 0, b: reportB?.relevanceScore || 0 },
    { label: 'Completeness', a: reportA?.completenessScore || 0, b: reportB?.completenessScore || 0 },
    { label: 'Clarity', a: reportA?.clarityScore || 0, b: reportB?.clarityScore || 0 },
    { label: 'Communication', a: reportA?.communicationScore || 0, b: reportB?.communicationScore || 0 },
    { label: 'Structure', a: reportA?.structureScore || 0, b: reportB?.structureScore || 0 },
    { label: 'Confidence', a: reportA?.confidenceScore || 0, b: reportB?.confidenceScore || 0 },
    { label: 'Problem Solving', a: reportA?.problemSolvingScore || 0, b: reportB?.problemSolvingScore || 0 },
    { label: 'Interview Behavior & Poise', a: reportA?.behaviorScore || sessionA?.behaviorScore || 80, b: reportB?.behaviorScore || sessionB?.behaviorScore || 80 },
  ];

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto" id="history-view">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-3">
            <History className="w-3.5 h-3.5" />
            <span>Multi-Session Historical Archive</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            Interview History & Side-by-Side Comparison
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
            Review past mock interview reports and benchmark your progress across multiple practice attempts.
          </p>
        </div>
      </div>

      {/* Side-by-Side Session Comparative Matrix */}
      {pastSessions.length >= 2 && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-100">Direct Session Comparison Tool</h2>
              <p className="text-xs text-slate-400">Select two past interviews to inspect metric growth deltas</p>
            </div>
          </div>

          {/* Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-cyan-400 mb-1.5">Session 1 (Earlier Attempt)</label>
              <select
                value={sessionAId}
                onChange={(e) => setSessionAId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
              >
                {pastSessions.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900">
                    {s.title} ({new Date(s.startedAt).toLocaleDateString()}) - {s.overallScore || 0}%
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-violet-400 mb-1.5">Session 2 (Recent Attempt)</label>
              <select
                value={sessionBId}
                onChange={(e) => setSessionBId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
              >
                {pastSessions.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900">
                    {s.title} ({new Date(s.startedAt).toLocaleDateString()}) - {s.overallScore || 0}%
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparative Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="pb-3 font-semibold">Dimension</th>
                  <th className="pb-3 font-semibold text-cyan-300">Session 1 Score</th>
                  <th className="pb-3 font-semibold text-violet-300">Session 2 Score</th>
                  <th className="pb-3 font-semibold text-right">Growth Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {compareMetrics.map((m, idx) => {
                  const delta = m.b - m.a;
                  return (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 font-bold text-slate-200">{m.label}</td>
                      <td className="py-2.5 font-mono text-slate-300">{m.a}%</td>
                      <td className="py-2.5 font-mono text-slate-300">{m.b}%</td>
                      <td className="py-2.5 font-mono font-bold text-right">
                        <span className={delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {delta >= 0 ? `+${delta}%` : `${delta}%`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full Past Interviews List */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 px-1">
          All Logged Interview Sessions ({pastSessions.length})
        </h2>

        {pastSessions.map((sess) => (
          <div
            key={sess.id}
            className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-100 truncate">{sess.title}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                  {sess.type}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {sess.difficulty}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{new Date(sess.startedAt).toLocaleDateString()}</span>
                </span>
                <span>•</span>
                <span>{sess.questions.length} questions</span>
                <span>•</span>
                <span>{sess.durationMinutes} mins</span>
              </div>
            </div>

            <div className="flex items-center gap-4 self-end sm:self-center flex-shrink-0">
              <div className="text-right">
                <div className="text-xs text-slate-400">Score</div>
                <div className="text-lg font-black font-mono text-cyan-300">
                  {sess.overallScore ? `${sess.overallScore}/100` : 'Incomplete'}
                </div>
                {sess.behaviorScore && (
                  <div className="text-[10px] font-mono text-emerald-400">
                    Behavior: {sess.behaviorScore}%
                  </div>
                )}
              </div>

              {sess.report ? (
                <button
                  onClick={() => {
                    setSelectedReportId(sess.report!.id);
                    setCurrentView('report');
                  }}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Report</span>
                </button>
              ) : (
                <button
                  onClick={() => setCurrentView('practice')}
                  className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 text-xs font-semibold"
                >
                  Resume
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
