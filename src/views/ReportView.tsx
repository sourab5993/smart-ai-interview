import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Lightbulb, 
  Sparkles, 
  ArrowRight, 
  Download, 
  Share2, 
  Bookmark, 
  ChevronDown, 
  ChevronUp, 
  Mic, 
  FileText, 
  TrendingUp, 
  RotateCcw,
  BookOpen,
  Award,
  Camera,
  Eye,
  ShieldCheck,
  Compass,
  Smile,
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import { useApp } from '../context/AppContext';
import { ScoreRing } from '../components/ScoreRing';
import { DEMO_REPORT } from '../data/mockData';

export const ReportView: React.FC = () => {
  const { 
    selectedReportId, 
    pastSessions, 
    setCurrentView, 
    toggleBookmark, 
    bookmarkedReportIds,
    setActiveCompareSessions 
  } = useApp();

  const [expandedQIndex, setExpandedQIndex] = useState<number | null>(0);

  // Find target report
  const sessionWithReport = pastSessions.find(s => s.report?.id === selectedReportId) || pastSessions[0];
  const report = sessionWithReport?.report || DEMO_REPORT;
  const isBookmarked = bookmarkedReportIds.includes(report.id);

  const radarData = [
    { subject: 'Technical', A: report.technicalScore, fullMark: 100 },
    { subject: 'Relevance', A: report.relevanceScore, fullMark: 100 },
    { subject: 'Completeness', A: report.completenessScore, fullMark: 100 },
    { subject: 'Clarity', A: report.clarityScore, fullMark: 100 },
    { subject: 'Communication', A: report.communicationScore, fullMark: 100 },
    { subject: 'Structure', A: report.structureScore, fullMark: 100 },
    { subject: 'Confidence', A: report.confidenceScore, fullMark: 100 },
    { subject: 'Problem Solving', A: report.problemSolvingScore, fullMark: 100 },
  ];

  const barData = [
    { name: 'Technical', score: report.technicalScore, color: '#06b6d4' },
    { name: 'Relevance', score: report.relevanceScore, color: '#3b82f6' },
    { name: 'Completeness', score: report.completenessScore, color: '#6366f1' },
    { name: 'Clarity', score: report.clarityScore, color: '#8b5cf6' },
    { name: 'Communication', score: report.communicationScore, color: '#a855f7' },
    { name: 'Structure', score: report.structureScore, color: '#ec4899' },
    { name: 'Confidence', score: report.confidenceScore, color: '#10b981' },
    { name: 'Problem Solv.', score: report.problemSolvingScore, color: '#f59e0b' },
  ];

  const handleCompare = () => {
    const secondSession = pastSessions.find(s => s.id !== sessionWithReport.id)?.id || pastSessions[0]?.id;
    setActiveCompareSessions([sessionWithReport.id, secondSession]);
    setCurrentView('history');
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `interview_report_${report.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto" id="interview-report-view">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {sessionWithReport?.role || 'Full Stack Developer'}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300">
                {sessionWithReport?.type || 'Technical'} Mock
              </span>
              <span className="text-xs text-slate-400">
                {new Date(report.createdAt).toLocaleDateString()}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
              AI Comprehensive Evaluation Report
            </h1>
            <p className="text-xs sm:text-sm text-cyan-300 font-semibold flex items-center gap-1.5">
              <Award className="w-4 h-4 text-cyan-400" />
              <span>{report.performanceLabel}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => toggleBookmark('report', report.id)}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                isBookmarked
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Bookmark Report"
            >
              <Bookmark className="w-4 h-4 fill-current" />
            </button>
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={() => setCurrentView('practice')}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Retake Mock</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Scores & Visual Dimensions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Overall Ring & Quick Metrics (4 Cols) */}
        <div className="lg:col-span-4 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col items-center justify-between text-center">
          <div className="w-full pb-3 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
            Overall Interview Index
          </div>

          <div className="py-6">
            <ScoreRing
              score={report.overallScore}
              size={160}
              strokeWidth={12}
              label="Composite Score"
            />
          </div>

          <div className="w-full pt-4 border-t border-slate-800 grid grid-cols-3 gap-2 text-left">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Technical</div>
              <div className="text-sm font-bold font-mono text-cyan-300">{report.technicalScore}%</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Problem Solving</div>
              <div className="text-sm font-bold font-mono text-violet-300">{report.problemSolvingScore}%</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/20">
              <div className="text-[9px] text-emerald-400 uppercase font-semibold">Behavior</div>
              <div className="text-sm font-bold font-mono text-emerald-300">{report.behaviorScore ?? 85}%</div>
            </div>
          </div>
        </div>

        {/* Right: Radar Chart Visualization (8 Cols) */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              8-Dimension Competency Radar
            </h3>
            <span className="text-[11px] text-cyan-400 font-semibold">Normalized %</span>
          </div>

          <div className="h-64 w-full flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" />
                <Radar
                  name="Candidate"
                  dataKey="A"
                  stroke="#06b6d4"
                  fill="#06b6d4"
                  fillOpacity={0.4}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Scores &gt;85% indicate senior readiness in target tier</span>
            <button
              onClick={handleCompare}
              className="text-cyan-400 hover:underline font-semibold flex items-center gap-1"
            >
              <span>Compare vs Prior Mock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* AI Executive Summary Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-cyan-950/20 via-slate-900 to-indigo-950/20 border border-cyan-500/20 shadow-xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
          <Sparkles className="w-4 h-4" />
          <span>AI Senior Evaluator Executive Summary</span>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed font-sans">
          {report.aiExecutiveSummary}
        </p>
      </div>

      {/* Strengths & Weaknesses 2-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Strengths */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-emerald-500/20 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-4 pb-2 border-b border-slate-800">
            <CheckCircle2 className="w-4 h-4" />
            <span>Demonstrated Strengths</span>
          </div>
          <ul className="space-y-2.5">
            {report.topStrengths.map((str, idx) => (
              <li key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span className="leading-relaxed">{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Top Weaknesses */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-amber-500/20 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-4 pb-2 border-b border-slate-800">
            <AlertTriangle className="w-4 h-4" />
            <span>Primary Areas for Improvement</span>
          </div>
          <ul className="space-y-2.5">
            {report.topWeaknesses.map((w, idx) => (
              <li key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                <span className="text-amber-400 font-bold mt-0.5">•</span>
                <span className="leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Missing Concepts & Technical Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Repeated Mistakes */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-rose-500/20 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400 mb-4 pb-2 border-b border-slate-800">
            <AlertOctagon className="w-4 h-4" />
            <span>Identified Candidate Blind Spots</span>
          </div>
          <ul className="space-y-2.5">
            {(report.repeatedMistakes || []).map((m, idx) => (
              <li key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                <span className="text-rose-400 font-bold mt-0.5">•</span>
                <span className="leading-relaxed">{m}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Knowledge Gaps */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-violet-500/20 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-400 mb-4 pb-2 border-b border-slate-800">
            <BookOpen className="w-4 h-4" />
            <span>Missing Technical Concepts</span>
          </div>
          <ul className="space-y-2.5">
            {(report.technicalKnowledgeGaps || report.missingConcepts || []).map((g, idx) => (
              <li key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                <span className="text-violet-400 font-bold mt-0.5">•</span>
                <span className="leading-relaxed">{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Non-Verbal & Interview Behaviour Analysis Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-cyan-500/30 shadow-2xl space-y-5" id="behavior-analysis-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-500/10">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">Candidate Non-Verbal & Interview Behaviour Analysis</h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono">
                  COMPUTER VISION HUD
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-time webcam telemetry measuring eye contact, head posture, and non-verbal poise
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-cyan-500/40 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-[9px] text-slate-400 font-semibold uppercase">Behaviour Index</div>
                <div className="text-sm font-bold font-mono text-cyan-300">{report.behaviorScore ?? 86}/100</div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Behavioral Metrics Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Eye Contact */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                Eye Contact & Focus
              </span>
              <span className="font-mono font-bold text-cyan-300">{report.eyeContactAverage ?? 0}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                style={{ width: `${report.eyeContactAverage ?? 0}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              {(report.eyeContactAverage ?? 0) === 0
                ? 'No direct eye contact detected. Ensure eyes are clearly visible in the camera frame.'
                : (report.eyeContactAverage ?? 0) >= 80
                ? 'Strong direct gaze towards the interviewer.'
                : 'Occasional downward or sideways glances; focus on camera lens.'}
            </p>
          </div>

          {/* Posture Stability */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                Head & Body Poise
              </span>
              <span className="font-mono font-bold text-emerald-300">{report.postureStabilityAverage ?? 88}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                style={{ width: `${report.postureStabilityAverage ?? 88}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              {(report.postureStabilityAverage ?? 88) >= 80
                ? 'Steady head alignment with minimal restlessness.'
                : 'Mild fidgeting detected during technical delivery.'}
            </p>
          </div>

          {/* Facial Composure */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Smile className="w-3.5 h-3.5 text-violet-400" />
                Facial Poise & Composure
              </span>
              <span className="font-mono font-bold text-violet-300">{report.composureAverage ?? 85}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all"
                style={{ width: `${report.composureAverage ?? 85}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              {(report.composureAverage ?? 85) >= 80
                ? 'Exhibited confident and composed expressions.'
                : 'Natural facial tension; practice relaxed articulation.'}
            </p>
          </div>

          {/* Non-Verbal Index */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                Executive Presence
              </span>
              <span className="font-mono font-bold text-amber-300">{report.behaviorScore ?? 86}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                style={{ width: `${report.behaviorScore ?? 86}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Composite index combining eye contact, stability, and poise.
            </p>
          </div>
        </div>

        {/* AI Behavioral Observation Summary & Tips */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI Non-Verbal Evaluation Summary</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {report.behaviorSummary ||
                `Candidate maintained an average eye contact score of ${report.eyeContactAverage ?? 0}%, posture stability of ${report.postureStabilityAverage ?? 0}%, and facial composure of ${report.composureAverage ?? 0}%. Non-verbal presence projected professionalism and focus.`}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Non-Verbal Coaching Recommendations</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-300">
              {(report.nonVerbalRecommendations && report.nonVerbalRecommendations.length > 0
                ? report.nonVerbalRecommendations
                : [
                    'Maintain direct eye contact with the camera lens when presenting key conclusions.',
                    'Keep upper body posture open and centered to project executive presence.',
                    'Allow natural micro-gestures to emphasize important structural points.',
                  ]
              ).map((rec, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Question-by-Question Detailed Review Accordion */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Question-by-Question Deep Dive</h3>
            <p className="text-xs text-slate-400">Review your verbatim response vs AI model exemplar answer</p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {sessionWithReport?.questions?.length || 0} Questions
          </span>
        </div>

        <div className="space-y-3">
          {(sessionWithReport?.questions || []).map((q, idx) => {
            const isExpanded = expandedQIndex === idx;
            const evalObj = q.evaluation;
            return (
              <div
                key={q.id || idx}
                className="rounded-xl bg-slate-950/60 border border-slate-800 overflow-hidden transition-all"
              >
                {/* Accordion Bar */}
                <button
                  type="button"
                  onClick={() => setExpandedQIndex(isExpanded ? null : idx)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <span className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-xs font-mono font-bold text-slate-300 flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-200 truncate">{q.question}</div>
                      <div className="text-[10px] text-slate-400">{q.category} • {q.difficulty}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {q.behaviorTelemetry && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono text-cyan-300">
                        <Camera className="w-3 h-3" />
                        <span>Behavior: {q.behaviorTelemetry.overallBehaviorScore}%</span>
                      </span>
                    )}
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      {evalObj?.overall_score || 80}/100
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-slate-800/80 space-y-4">
                    {/* Non-Verbal Telemetry Details */}
                    {q.behaviorTelemetry && (
                      <div className="mt-3 p-3 rounded-lg bg-slate-900/60 border border-cyan-500/20 space-y-1.5">
                        <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Candidate Non-Verbal Telemetry</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Eye Contact</span>
                            <span className="font-mono font-bold text-cyan-300">{q.behaviorTelemetry.eyeContactScore}%</span>
                          </div>
                          <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Stability</span>
                            <span className="font-mono font-bold text-emerald-300">{q.behaviorTelemetry.postureStabilityScore}%</span>
                          </div>
                          <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Composure</span>
                            <span className="font-mono font-bold text-violet-300">{q.behaviorTelemetry.facialComposureScore}%</span>
                          </div>
                        </div>
                        {q.behaviorTelemetry.behaviorNotes && q.behaviorTelemetry.behaviorNotes.length > 0 && (
                          <p className="text-[11px] text-slate-400 mt-1 italic">
                            &ldquo;{q.behaviorTelemetry.behaviorNotes.join(' ')}&rdquo;
                          </p>
                        )}
                      </div>
                    )}

                    {/* User Answer */}
                    <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Your Response ({q.answerMode === 'voice' ? 'Voice STT' : 'Text'}):
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                        {q.userAnswer || 'No response recorded.'}
                      </p>
                    </div>

                    {/* Model Answer */}
                    {evalObj?.better_answer && (
                      <div className="p-3.5 rounded-lg bg-indigo-950/20 border border-indigo-500/30">
                        <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          <span>AI Exemplar Answer:</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed italic">
                          &ldquo;{evalObj.better_answer}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* Tip */}
                    {evalObj?.improvement_tip && (
                      <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/20 text-xs text-cyan-200 flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <span>{evalObj.improvement_tip}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 7-Day Targeted Plan Recommendation */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-100">Adaptive 7-Day Roadmap Updated</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Your personalized study schedule has incorporated the gaps discovered in this interview.
          </p>
        </div>
        <button
          onClick={() => setCurrentView('study-plan')}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/25 transition-all cursor-pointer whitespace-nowrap"
        >
          <span>View Day-by-Day Plan</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
