import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  X, 
  Lightbulb, 
  Code, 
  AlertOctagon, 
  Compass, 
  CheckCircle2,
  Clock
} from 'lucide-react';
import { QuestionBankItem } from '../types';

interface AIExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: QuestionBankItem | null;
  aiExplanation?: {
    concept: string;
    approach: string;
    solutionCode?: string;
    complexity?: string;
    commonMistakes: string[];
    interviewTip: string;
  } | null;
  isLoading?: boolean;
}

export const AIExplainModal: React.FC<AIExplainModalProps> = ({
  isOpen,
  onClose,
  question,
  aiExplanation,
  isLoading = false,
}) => {
  if (!isOpen || !question) return null;

  const concept = aiExplanation?.concept || question.concept;
  const approach = aiExplanation?.approach || question.approach;
  const solutionCode = aiExplanation?.solutionCode || question.solutionCode;
  const complexity = aiExplanation?.complexity || question.complexity;
  const commonMistakes = aiExplanation?.commonMistakes || question.commonMistakes || [];
  const interviewTip = aiExplanation?.interviewTip || question.interviewTip;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto" id="explain-modal-backdrop">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden my-8"
          id="explain-modal-content"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-violet-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {question.category}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {question.difficulty}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-100 leading-snug">
                  {question.question}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-3"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-300">AI Senior Engineer is breaking down concept & solution...</p>
            </div>
          ) : (
            <div className="space-y-4 mt-5 max-h-[70vh] overflow-y-auto pr-1">
              {/* Concept */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
                  <Compass className="w-4 h-4" />
                  <span>Core Architectural Concept</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{concept}</p>
              </div>

              {/* Approach */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-wider mb-1.5">
                  <Lightbulb className="w-4 h-4" />
                  <span>Step-by-Step Interview Approach</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{approach}</p>
              </div>

              {/* Code / Solution */}
              {solutionCode && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      <span>Idiomatic Solution Code / Pattern</span>
                    </div>
                    {complexity && (
                      <span className="text-[11px] font-mono text-slate-400 lowercase">{complexity}</span>
                    )}
                  </div>
                  <pre className="p-3.5 rounded-lg bg-slate-900 border border-slate-800/80 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed">
                    <code>{solutionCode}</code>
                  </pre>
                </div>
              )}

              {/* Common Traps */}
              {commonMistakes.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-950/15 border border-rose-500/20">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
                    <AlertOctagon className="w-4 h-4" />
                    <span>Common Candidate Mistakes & Pitfalls</span>
                  </div>
                  <ul className="space-y-1.5">
                    {commonMistakes.map((cm, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{cm}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Interviewer Tip */}
              {interviewTip && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/30 to-blue-950/30 border border-cyan-500/30 flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Insider Interviewer Tip</div>
                    <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">{interviewTip}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close Breakdown
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
