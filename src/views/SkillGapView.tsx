import React, { useState } from 'react';
import { 
  Target, 
  Sparkles, 
  ArrowRight, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  BookOpen, 
  Search,
  Filter
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SkillGapView: React.FC = () => {
  const { skills, setCurrentView } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = ['All', 'Data Structures & Algorithms', 'System Architecture', 'Frontend Engineering', 'Backend Engineering', 'Database Systems', 'Behavioral & Leadership'];

  const filteredSkills = skills.filter((sk) => {
    const matchesCategory = selectedCategory === 'All' || sk.category === selectedCategory;
    const matchesSearch = sk.name.toLowerCase().includes(searchQuery.toLowerCase()) || sk.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const highPriorityGaps = skills.filter(s => s.priority === 'High');

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto" id="skill-gap-view">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-3">
            <Target className="w-3.5 h-3.5" />
            <span>Target Benchmark Differential Matrix</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            Skill Gap & Competency Analysis
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
            Comparing your assessed performance across mock interviews against real hiring bar thresholds for top tech roles.
          </p>
        </div>
      </div>

      {/* Top 3 High Priority Focus Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {highPriorityGaps.slice(0, 3).map((gap) => {
          const delta = gap.requiredScore - gap.currentScore;
          return (
            <div
              key={gap.id}
              className="p-5 rounded-2xl bg-slate-900/90 border border-rose-500/30 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/20">
                    High Priority Gap
                  </span>
                  <span className="text-xs font-mono font-bold text-rose-400">Δ -{delta}%</span>
                </div>
                <h3 className="text-sm font-bold text-slate-100 mb-1">{gap.name}</h3>
                <div className="text-[11px] text-slate-400">{gap.category}</div>

                <div className="mt-4 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Current Assessed:</span>
                    <span className="font-mono font-bold text-slate-200">{gap.currentScore}%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Industry Requirement:</span>
                    <span className="font-mono font-bold text-cyan-300">{gap.requiredScore}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                      style={{ width: `${gap.currentScore}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-300">
                Action: <span className="text-cyan-300">{(gap.recommendedResources && gap.recommendedResources[0]) || 'Complete targeted mock sessions'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter skills..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none"
          />
        </div>
      </div>

      {/* Skills Matrix Table */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="pb-3 font-semibold">Skill & Domain</th>
                <th className="pb-3 font-semibold">Category</th>
                <th className="pb-3 font-semibold">Current Score</th>
                <th className="pb-3 font-semibold">Target Score</th>
                <th className="pb-3 font-semibold">Gap Delta</th>
                <th className="pb-3 font-semibold">Priority</th>
                <th className="pb-3 font-semibold text-right">Action Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSkills.map((sk) => {
                const delta = sk.requiredScore - sk.currentScore;
                return (
                  <tr key={sk.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 font-bold text-slate-200">
                      {sk.name}
                    </td>
                    <td className="py-3.5 text-slate-400">{sk.category}</td>
                    <td className="py-3.5 font-mono text-slate-200 font-semibold">{sk.currentScore}%</td>
                    <td className="py-3.5 font-mono text-cyan-300 font-semibold">{sk.requiredScore}%</td>
                    <td className="py-3.5 font-mono font-bold">
                      <span className={delta > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                        {delta > 0 ? `-${delta}%` : `+${Math.abs(delta)}%`}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sk.priority === 'High'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : sk.priority === 'Medium'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {sk.priority} Priority
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => setCurrentView('study-plan')}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Remediate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
