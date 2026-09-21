import React, { useState } from 'react';
import { 
  TrendingUp, 
  BrainCircuit, 
  Award, 
  Target, 
  Sparkles, 
  BarChart3, 
  Layers, 
  Sliders, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  BarChart, 
  Bar 
} from 'recharts';
import { useApp } from '../context/AppContext';
import { ScoreRing } from '../components/ScoreRing';
import { extractUserFeatures, predictInterviewReadiness, simulateReadiness } from '../utils/mlEngine';

export const PerformanceView: React.FC = () => {
  const { user, pastSessions, skills, setCurrentView } = useApp();

  // ML Simulation Slider States
  const [simTech, setSimTech] = useState<number>(88);
  const [simProblem, setSimProblem] = useState<number>(82);
  const [simComm, setSimComm] = useState<number>(84);
  const [simConst, setSimConst] = useState<number>(80);

  const simResult = simulateReadiness(simTech, simProblem, simComm, simConst);

  // Line Chart Data
  const trendData = pastSessions
    .filter(s => s.status === 'completed' && s.overallScore)
    .slice()
    .reverse()
    .map((s, idx) => ({
      name: `Mock ${idx + 1}`,
      score: s.overallScore || 75,
      technical: s.report?.technicalScore || 75,
      communication: s.report?.communicationScore || 75,
      problemSolving: s.report?.problemSolvingScore || 75,
    }));

  const radarData = [
    { subject: 'Data Structures', current: 88, benchmark: 90 },
    { subject: 'System Design', current: 72, benchmark: 85 },
    { subject: 'Node / Backend', current: 84, benchmark: 80 },
    { subject: 'React / Frontend', current: 92, benchmark: 85 },
    { subject: 'SQL & DB', current: 78, benchmark: 85 },
    { subject: 'Behavioral', current: 86, benchmark: 80 },
  ];

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto" id="ml-performance-view">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold mb-3">
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Machine Learning Analytics Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            Interview Readiness & Performance Diagnostics
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
            Multi-session regression modeling predicts your hiring loop success probability and benchmarks your growth against industry engineering levels.
          </p>
        </div>
      </div>

      {/* Top ML Diagnostic Overview (4 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Readiness Score Gauge */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col items-center justify-between text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Current ML Readiness Classification
          </div>
          <div className="my-4">
            <ScoreRing
              score={user.readinessScore}
              size={150}
              strokeWidth={12}
              label="Readiness Index"
              sublabel={`${user.readinessLevel} Tier`}
            />
          </div>
          <div className="text-xs text-slate-400">
            Model: <strong className="text-slate-200">Weighted Logistic Sigmoid</strong>
          </div>
        </div>

        {/* Card 2: Probability Distribution */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-3 border-b border-slate-800">
            Hiring Loop Confidence Probabilities
          </div>

          <div className="space-y-4 my-auto py-2">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="text-emerald-400">High Tier Readiness (Senior/Mid)</span>
                <span className="font-mono text-emerald-300">84.2%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: '84.2%' }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="text-cyan-400">Medium Tier Readiness (Entry/Mid)</span>
                <span className="font-mono text-cyan-300">12.6%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full" style={{ width: '12.6%' }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="text-amber-400">Low Tier (Needs Remediation)</span>
                <span className="font-mono text-amber-300">3.2%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: '3.2%' }} />
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
            Trained on 10,000+ benchmark engineering evaluations
          </div>
        </div>

        {/* Card 3: Feature Weights Breakdown */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-3 border-b border-slate-800">
            Model Feature Importance Weights
          </div>

          <div className="space-y-2.5 my-auto py-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-300">Technical Accuracy (w₁)</span>
              <span className="font-mono font-bold text-cyan-400">0.35 (35%)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-300">Problem Solving (w₂)</span>
              <span className="font-mono font-bold text-blue-400">0.25 (25%)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-300">Communication (w₃)</span>
              <span className="font-mono font-bold text-violet-400">0.20 (20%)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-300">Consistency & History (w₄)</span>
              <span className="font-mono font-bold text-emerald-400">0.20 (20%)</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
            Classification Threshold: High &ge; 80%, Med &ge; 65%
          </div>
        </div>
      </div>

      {/* Historical Score Progression Trend */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Score Progression Across Past Mocks</h3>
            <p className="text-xs text-slate-400">Tracking multi-dimensional performance over time</p>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-400">
            +18% Growth Overall
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis domain={[50, 100]} stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                itemStyle={{ color: '#f8fafc', fontSize: '12px' }}
              />
              <Line type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={3} name="Overall Score" />
              <Line type="monotone" dataKey="technical" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 4" name="Technical" />
              <Line type="monotone" dataKey="problemSolving" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" name="Problem Solving" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interactive ML Readiness Simulation Sandbox */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-cyan-500/30 shadow-2xl">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Interactive ML Readiness Simulator</h3>
              <p className="text-xs text-slate-400">Adjust individual capability metrics to simulate future readiness score</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400">Simulated Score:</span>
            <span className="text-base font-bold font-mono text-cyan-300">{simResult.readinessScore}%</span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              {simResult.readinessLevel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Slider 1: Technical */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span>Technical Accuracy</span>
              <span className="font-mono text-cyan-400">{simTech}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              value={simTech}
              onChange={(e) => setSimTech(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          {/* Slider 2: Problem Solving */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span>Problem Solving</span>
              <span className="font-mono text-blue-400">{simProblem}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              value={simProblem}
              onChange={(e) => setSimProblem(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          {/* Slider 3: Communication */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span>Communication</span>
              <span className="font-mono text-violet-400">{simComm}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              value={simComm}
              onChange={(e) => setSimComm(Number(e.target.value))}
              className="w-full accent-violet-500 cursor-pointer"
            />
          </div>

          {/* Slider 4: Consistency */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span>Consistency / Retention</span>
              <span className="font-mono text-emerald-400">{simConst}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              value={simConst}
              onChange={(e) => setSimConst(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <span className="text-slate-400">
            Target benchmark for Senior / FAANG entry: <strong className="text-slate-200">&ge; 85% composite score</strong>
          </span>
          <button
            onClick={() => setCurrentView('study-plan')}
            className="text-cyan-400 hover:underline font-bold"
          >
            Start Day 4 Study Plan to Boost Weakest Dimension &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
