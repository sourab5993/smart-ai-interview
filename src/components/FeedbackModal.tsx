import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Lightbulb, 
  Sparkles, 
  X, 
  ArrowRight, 
  BookOpen, 
  Layers, 
  Award,
  Camera,
  Eye,
} from 'lucide-react';
import { AnswerEvaluation } from '../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  evaluation: AnswerEvaluation | null;
  onNextQuestion: () => void;
  isLastQuestion?: boolean;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  evaluation,
  onNextQuestion,
  isLastQuestion = false,
}) => {
  if (!isOpen || !evaluation) return null;

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 70) return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
    if (score >= 55) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const dimensions = [
    { label: 'Technical Accuracy', score: evaluation.technical_accuracy },
    { label: 'Relevance', score: evaluation.relevance },
    { label: 'Completeness', score: evaluation.completeness },
    { label: 'Clarity', score: evaluation.clarity },
    { label: 'Communication', score: evaluation.communication },
    { label: 'Structure', score: evaluation.structure },
    { label: 'Confidence', score: evaluation.confidence },
    { label: 'Problem Solving', score: evaluation.problem_solving },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto" id="feedback-modal-backdrop">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden my-8"
          id="feedback-modal-content"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">AI Answer Evaluation</h3>
                <p className="text-xs text-slate-400">Multidimensional NLP & Technical Assessment</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Overall Score Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 mt-5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-4">
              <div className={`px-4 py-2 rounded-xl border text-2xl font-extrabold font-mono ${getScoreColor(evaluation.overall_score)}`}>
                {evaluation.overall_score}/100
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-200">
                  {evaluation.overall_score >= 85
                    ? 'Excellent Answer'
                    : evaluation.overall_score >= 70
                    ? 'Strong Technical Core'
                    : 'Developing Concept'}
                </div>
                <div className="text-xs text-slate-400">
                  AI analyzed 8 performance dimensions
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onNextQuestion}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                id="btn-modal-next-question"
              >
                <span>{isLastQuestion ? 'Complete Interview' : 'Next Question'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 8 Dimensions Breakdown Matrix */}
          <div className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Evaluation Dimensions</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {dimensions.map((dim, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80">
                  <div className="text-[11px] text-slate-400 truncate">{dim.label}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-bold font-mono text-slate-200">{dim.score}</span>
                    <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                        style={{ width: `${dim.score}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Non-Verbal & Behavior Assessment Card */}
          {(evaluation.behavior_score !== undefined || evaluation.behavior_telemetry) && (
            <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-cyan-950/30 via-slate-950/60 to-blue-950/30 border border-cyan-500/25">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Interview Non-Verbal & Behavior Score
                  </span>
                </div>
                <div className={`px-2.5 py-0.5 rounded-lg border font-mono text-xs font-bold ${getScoreColor(evaluation.behavior_score ?? evaluation.behavior_telemetry?.overallBehaviorScore ?? 80)}`}>
                  {evaluation.behavior_score ?? evaluation.behavior_telemetry?.overallBehaviorScore ?? 80}/100
                </div>
              </div>

              {evaluation.behavior_telemetry && (
                <div className="grid grid-cols-3 gap-2 my-2">
                  <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400">Eye Contact</div>
                    <div className="text-xs font-bold font-mono text-cyan-300 mt-0.5">
                      {evaluation.behavior_telemetry.eyeContactScore}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400">Posture Stability</div>
                    <div className="text-xs font-bold font-mono text-emerald-300 mt-0.5">
                      {evaluation.behavior_telemetry.postureStabilityScore}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400">Composure</div>
                    <div className="text-xs font-bold font-mono text-violet-300 mt-0.5">
                      {evaluation.behavior_telemetry.facialComposureScore}%
                    </div>
                  </div>
                </div>
              )}

              {(evaluation.non_verbal_feedback || (evaluation.behavior_telemetry?.behaviorNotes && evaluation.behavior_telemetry.behaviorNotes.length > 0)) && (
                <p className="text-xs text-slate-300 leading-relaxed mt-2 bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
                  <span className="font-semibold text-cyan-400">Non-Verbal Note: </span>
                  {evaluation.non_verbal_feedback || evaluation.behavior_telemetry?.behaviorNotes?.join(' ')}
                </p>
              )}
            </div>
          )}

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            {/* Strengths */}
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Strong Points</span>
              </div>
              <ul className="space-y-1.5">
                {(evaluation.strengths || []).map((s, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses / Improvements */}
            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Areas to Improve</span>
              </div>
              <ul className="space-y-1.5">
                {(evaluation.weaknesses || []).map((w, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Missing Points */}
          {evaluation.missing_points && evaluation.missing_points.length > 0 && (
            <div className="mt-4 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                <span>Key Concepts You Missed</span>
              </div>
              <ul className="space-y-1">
                {evaluation.missing_points.map((mp, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>{mp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Better Model Answer */}
          {evaluation.better_answer && (
            <div className="mt-4 p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 mb-1.5">
                <Award className="w-4 h-4 text-indigo-400" />
                <span>Model Exemplar Answer</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                &ldquo;{evaluation.better_answer}&rdquo;
              </p>
            </div>
          )}

          {/* Improvement Tip */}
          {evaluation.improvement_tip && (
            <div className="mt-4 p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">AI Coach Tip</div>
                <p className="text-xs text-slate-200 mt-0.5">{evaluation.improvement_tip}</p>
              </div>
            </div>
          )}

          {/* Footer Action */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Review My Answer
            </button>
            <button
              onClick={onNextQuestion}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <span>{isLastQuestion ? 'View Full Interview Report' : 'Proceed to Next Question'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
