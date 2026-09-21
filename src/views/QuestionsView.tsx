import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Sparkles,
  Bookmark,
  Mic,
  Code,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Filter,
  Plus,
  GraduationCap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AIExplainModal } from '../components/AIExplainModal';
import { QuestionBankItem, DifficultyLevel } from '../types';
import { explainQuestionWithAI } from '../utils/apiClient';

export const QuestionsView: React.FC = () => {
  const {
    questionBank,
    coursesCatalog,
    bookmarkedQuestionIds,
    toggleBookmark,
    startNewInterview,
    user,
  } = useApp();

  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedQuestionForModal, setSelectedQuestionForModal] = useState<QuestionBankItem | null>(null);
  const [aiExplanation, setAiExplanation] = useState<any>(null);
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Extract unique categories from questions bank
  const uniqueCategories = Array.from(new Set(questionBank.map((q) => q.category)));
  const categories = ['All', ...uniqueCategories];

  const filteredQuestions = questionBank.filter((q) => {
    const matchesCourse =
      selectedCourseFilter === 'All' ||
      q.courseName === selectedCourseFilter ||
      q.courseCategory === selectedCourseFilter;
    const matchesCategory = selectedCategory === 'All' || q.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'All' || q.difficulty === selectedDifficulty;
    const matchesSearch =
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.courseName && q.courseName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.tags && q.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCourse && matchesCategory && matchesDifficulty && matchesSearch;
  });

  const handleOpenExplain = async (q: QuestionBankItem) => {
    setSelectedQuestionForModal(q);
    setIsModalOpen(true);
    setIsExplaining(true);
    try {
      const explanation = await explainQuestionWithAI({
        question: q.question,
        category: q.category,
        difficulty: q.difficulty,
        course: q.courseName || user.degree,
        role: q.role || user.targetRole,
      });
      setAiExplanation(explanation);
    } catch (e) {
      console.error('Explanation failed:', e);
    } finally {
      setIsExplaining(false);
    }
  };

  const handlePracticeSingleQuestion = (q: QuestionBankItem) => {
    startNewInterview({
      course: q.courseName || user.degree,
      specialization: user.specialization,
      role: q.role || user.targetRole,
      type: q.type || 'Domain',
      difficulty: q.difficulty,
      skills: q.tags || ['Domain Core', 'Methodology'],
      questionCount: 1,
      durationMinutes: 6,
    });
  };

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto" id="question-bank-view">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-3">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Multi-Discipline Question Repository & AI Explanations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            Curated Discipline Interview Repository
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
            Explore questions across Engineering, Medical, Law, Commerce, Business, Science, and Design with AI model answers, conceptual breakdowns, and interview rubrics.
          </p>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        {/* Degree / Course Filter Pills */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Filter by Degree / Discipline:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCourseFilter('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCourseFilter === 'All'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              All Courses ({questionBank.length})
            </button>
            {coursesCatalog.map((course) => (
              <button
                key={course.id}
                onClick={() => setSelectedCourseFilter(course.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCourseFilter === course.name
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {course.name}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Difficulty */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
          <div className="w-full sm:w-80 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts, tags, or question prompts..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs text-slate-500">Difficulty:</span>
            {['All', 'Easy', 'Medium', 'Hard'].map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDifficulty(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  selectedDifficulty === d
                    ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Questions Listing */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>Showing {filteredQuestions.length} questions</span>
          <span>Click &quot;AI Deep Dive&quot; for full model answers</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredQuestions.map((q) => {
            const isBookmarked = bookmarkedQuestionIds.includes(q.id);

            return (
              <div
                key={q.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3 relative shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[11px] font-bold font-mono">
                        {q.courseName || 'Universal'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20 text-[11px] font-medium">
                        {q.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          q.difficulty === 'Easy'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : q.difficulty === 'Medium'
                            ? 'bg-cyan-500/10 text-cyan-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {q.difficulty}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px]">
                        {q.type || 'Domain'}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-100 leading-snug">
                      {q.question}
                    </h3>
                  </div>

                  <button
                    onClick={() => toggleBookmark('question', q.id)}
                    title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                      isBookmarked
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Bookmark className="w-4 h-4 fill-current" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <span className="text-cyan-400">Core Principle:</span>
                    <span>{q.concept}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <strong className="text-slate-300">Recommended Framework:</strong> {q.approach}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {q.tags?.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px]">
                        #{t}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenExplain(q)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold border border-cyan-500/30 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Deep Dive</span>
                    </button>

                    <button
                      onClick={() => handlePracticeSingleQuestion(q)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Practice Question</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Explanation Modal */}
      {isModalOpen && selectedQuestionForModal && (
        <AIExplainModal
          isOpen={isModalOpen}
          question={selectedQuestionForModal}
          aiExplanation={aiExplanation}
          isLoading={isExplaining}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedQuestionForModal(null);
            setAiExplanation(null);
          }}
        />
      )}
    </div>
  );
};
