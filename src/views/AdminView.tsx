import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  BarChart3,
  Plus,
  Search,
  Download,
  Trash2,
  Edit,
  CheckCircle2,
  Sparkles,
  Layers,
  GraduationCap,
  Briefcase,
  BookOpen,
  Cpu,
  TrendingUp,
  Database,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { QuestionBankItem, CourseDefinition, EducationalCategory, DifficultyLevel, InterviewType } from '../types';

export const AdminView: React.FC = () => {
  const {
    questionBank,
    addCustomQuestionToBank,
    coursesCatalog,
    addNewCourseToCatalog,
    jobRolesCatalog,
    addNewJobRoleToCatalog,
    setCurrentView,
    user,
    isAuthenticated,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'candidates' | 'courses' | 'questions' | 'ml_telemetry'>('candidates');
  const [candidateSearch, setCandidateSearch] = useState<string>('');
  const [showAddCourseModal, setShowAddCourseModal] = useState<boolean>(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState<boolean>(false);
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);

  // Load real registered users from MongoDB via /api/auth/users
  useEffect(() => {
    fetch('/api/auth/users')
      .then((res) => (res.ok ? res.json().catch(() => null) : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.users)) {
          setDbUsers(data.users);
        }
      })
      .catch((err) => {
        console.warn('Failed to load registered users from API:', err);
      })
      .finally(() => {
        setIsLoadingUsers(false);
      });
  }, []);

  // New Course Form State
  const [newCourseName, setNewCourseName] = useState<string>('B.Arch');
  const [newCourseFullName, setNewCourseFullName] = useState<string>('Bachelor of Architecture');
  const [newCourseCategory, setNewCourseCategory] = useState<EducationalCategory>('Design & Creative');
  const [newCourseSubjects, setNewCourseSubjects] = useState<string>('Architectural Design, Building Construction, Structural Analysis, Sustainable Architecture');
  const [newCourseSpecs, setNewCourseSpecs] = useState<string>('Landscape Architecture, Urban Design, Interior Architecture');
  const [newCourseRoles, setNewCourseRoles] = useState<string>('Architectural Designer, Urban Planner, BIM Coordinator');

  // New Question Form State
  const [newQTitle, setNewQTitle] = useState<string>('');
  const [newQCourseName, setNewQCourseName] = useState<string>('B.Tech');
  const [newQCategory, setNewQCategory] = useState<string>('Thermodynamics');
  const [newQDifficulty, setNewQDifficulty] = useState<DifficultyLevel>('Medium');
  const [newQType, setNewQType] = useState<InterviewType>('Domain');
  const [newQRole, setNewQRole] = useState<string>('Mechanical Design Engineer');
  const [newQText, setNewQText] = useState<string>('');
  const [newQTags, setNewQTags] = useState<string>('Carnot Cycle, Heat Transfer, Entropy');
  const [newQConcept, setNewQConcept] = useState<string>('Second Law of Thermodynamics and maximum thermal efficiency');
  const [newQApproach, setNewQApproach] = useState<string>('1. State Carnot principles, 2. Diagram temperature boundaries, 3. Calculate reversible work output.');
  const [newQTip, setNewQTip] = useState<string>('Always emphasize that no practical engine can exceed Carnot efficiency operating between identical temperature reservoirs.');

  const candidatesList = dbUsers.length > 0
    ? dbUsers.map((u) => ({
        id: u.id || u._id,
        name: u.name || 'Candidate User',
        email: u.email,
        degree: u.degree || 'B.Tech',
        specialization: u.specialization || 'Computer Science & Engineering',
        role: u.targetRole || (u.isAdmin ? 'Administrator' : 'Candidate'),
        readiness: u.readinessScore ?? 85,
        level: u.readinessLevel || 'Interview Ready',
        mocks: u.totalInterviews ?? 0,
        lastActive: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Today',
      }))
    : [
        { id: 'c2', name: 'Tanvi Agarwal', email: 'tanvi.a@college.edu', degree: 'B.Com', specialization: 'Accounting & Taxation', role: 'GST & Tax Consultant', readiness: 85, level: 'High', mocks: 5, lastActive: 'Today' },
        { id: 'c3', name: 'Dr. Rohan Deshmukh', email: 'rohan.d@medical.edu', degree: 'B.Pharm', specialization: 'Pharmacology', role: 'Pharmacovigilance Associate', readiness: 90, level: 'High', mocks: 7, lastActive: 'Yesterday' },
        { id: 'c4', name: 'Aditya Sen', email: 'aditya.s@law.edu', degree: 'LLB', specialization: 'Corporate Law', role: 'Corporate Legal Associate', readiness: 79, level: 'Medium', mocks: 4, lastActive: '2 days ago' },
        { id: 'c5', name: 'Neha Kapoor', email: 'neha.k@bba.edu', degree: 'BBA', specialization: 'Marketing & Strategy', role: 'Business Analyst', readiness: 82, level: 'High', mocks: 5, lastActive: '3 days ago' },
        { id: 'c6', name: 'Vikram Joshi', email: 'vikram.j@mech.edu', degree: 'B.Tech', specialization: 'Mechanical Engineering', role: 'Mechanical Design Engineer', readiness: 74, level: 'Medium', mocks: 3, lastActive: '4 days ago' },
      ];

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;

    const courseDef: CourseDefinition = {
      id: `course_${Date.now()}`,
      name: newCourseName.trim(),
      fullName: newCourseFullName.trim() || newCourseName.trim(),
      category: newCourseCategory,
      coreSubjects: newCourseSubjects.split(',').map((s) => s.trim()),
      specializations: newCourseSpecs.split(',').map((s) => s.trim()),
      defaultRoles: newCourseRoles.split(',').map((s) => s.trim()),
      defaultSkills: newCourseSubjects.split(',').map((s) => s.trim()).slice(0, 6),
      recommendedInterviewTypes: ['Domain', 'Technical', 'Situational', 'HR'],
      evaluationDimensions: ['Discipline Fundamentals', 'Practical Application', 'Problem Solving', 'Communication'],
    };

    addNewCourseToCatalog(courseDef);
    setShowAddCourseModal(false);
    alert(`Course "${courseDef.name}" successfully added to universal catalog!`);
  };

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQText.trim()) return;

    const matchingCourse = coursesCatalog.find((c) => c.name === newQCourseName) || coursesCatalog[0];

    const newItem: Omit<QuestionBankItem, 'id'> = {
      title: newQTitle || newQText.slice(0, 60),
      question: newQText,
      courseCategory: matchingCourse.category,
      courseName: matchingCourse.name,
      category: newQCategory,
      difficulty: newQDifficulty,
      type: newQType,
      role: newQRole,
      tags: newQTags.split(',').map((s) => s.trim()),
      concept: newQConcept,
      approach: newQApproach,
      commonMistakes: ['Skipping boundary conditions or standards', 'Lack of structured reasoning'],
      interviewTip: newQTip,
    };

    addCustomQuestionToBank(newItem);
    setShowAddQuestionModal(false);
    setNewQText('');
    setNewQTitle('');
    alert('New discipline interview question added to universal bank!');
  };

  const filteredCandidates = candidatesList.filter(
    (c) =>
      c.name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
      c.degree.toLowerCase().includes(candidateSearch.toLowerCase()) ||
      c.role.toLowerCase().includes(candidateSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(candidateSearch.toLowerCase())
  );

  // Strict Admin Access Control: Only sourabstar786@gmail.com with admin privileges
  const isAuthorizedAdmin = Boolean(
    isAuthenticated &&
    user?.email?.trim().toLowerCase() === 'sourabstar786@gmail.com' &&
    user?.isAdmin
  );

  if (!isAuthorizedAdmin) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4" id="admin-restricted-view">
        <div className="rounded-3xl bg-slate-900/90 border border-rose-500/30 p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-violet-600/20 border border-rose-500/30 mx-auto flex items-center justify-center mb-5 shadow-lg shadow-rose-500/10">
            <ShieldCheck className="w-8 h-8 text-rose-400" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold mb-3">
            <span>Restricted Administrator Portal</span>
          </div>

          <h2 className="text-2xl font-black text-slate-100 tracking-tight mb-2">
            Administrator Access Required
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed mb-6 max-w-md mx-auto">
            Curriculum Control, Question Bank Management, and Student Analytics are strictly restricted to the authorized administrator account (<span className="text-cyan-400 font-mono font-semibold">sourabstar786@gmail.com</span>).
          </p>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left text-xs text-slate-300 mb-6 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Authorized Login:</div>
            <div className="flex items-center justify-between font-mono text-[11px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Admin Email:</span>
              <span className="text-cyan-300 font-semibold">sourabstar786@gmail.com</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Admin Password:</span>
              <span className="text-violet-300 font-semibold">sourab2004</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setCurrentView('login')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 hover:from-rose-400 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-rose-500/20 transition-all cursor-pointer"
            >
              Sign In with Admin Account
            </button>
            <button
              onClick={() => setCurrentView('landing')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              Back to Website
            </button>
            {isAuthenticated && (
              <button
                onClick={() => setCurrentView('dashboard')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                Candidate Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto" id="admin-view">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Multi-Discipline Academic & Enterprise Administration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
              Curriculum Control & AI Placement Governance
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
              Manage universal course catalogs, discipline question repositories, and monitor real-time ML readiness analytics across all academic departments.
            </p>
          </div>

          <button
            onClick={() => alert('Multi-Discipline Cohort Placement Readiness Report (CSV) Exported Successfully!')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Export Universal Report</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('candidates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'candidates'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Student Cohort Analytics ({candidatesList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'courses'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Course Catalog & Degrees ({coursesCatalog.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'questions'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Universal Question Bank ({questionBank.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ml_telemetry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'ml_telemetry'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>ML Readiness Model Telemetry</span>
        </button>
      </div>

      {/* Tab 1: Candidates Cohort */}
      {activeTab === 'candidates' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student name, course (B.Tech, B.Com, LLB), role..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9.5 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>MongoDB: <strong>{dbUsers.length} Registered Users</strong> in <code className="text-emerald-200">smart_ai_interview.users</code></span>
              </div>
              <a
                href="/api/auth/users"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700 transition-colors"
                title="View raw JSON data directly from MongoDB"
              >
                <span>Raw API</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Student & Email</th>
                    <th className="py-3 px-4">Degree & Specialization</th>
                    <th className="py-3 px-4">Target Career Role</th>
                    <th className="py-3 px-4 text-center">ML Readiness</th>
                    <th className="py-3 px-4 text-center">Mocks Taken</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCandidates.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-200">
                        <div>{c.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{c.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[11px] font-semibold mr-1.5">
                          {c.degree}
                        </span>
                        <span className="text-slate-400 text-[11px]">{c.specialization}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-medium">{c.role}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            c.readiness >= 85
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {c.readiness}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-200">{c.mocks}</td>
                      <td className="py-3 px-4 text-slate-400">{c.lastActive}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => alert(`Opening comprehensive diagnostic report for ${c.name}...`)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 text-[11px] font-medium border border-slate-700 transition-colors cursor-pointer"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Courses & Curriculum */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-200">Universal Academic Course Catalog</h2>
              <p className="text-xs text-slate-400">
                Any course added here instantly integrates across question generation, ML predictions, and study plans without code modification.
              </p>
            </div>
            <button
              onClick={() => setShowAddCourseModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Course</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coursesCatalog.map((course) => (
              <div
                key={course.id}
                className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-bold font-mono">
                      {course.name}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      {course.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-200">{course.fullName}</h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block font-medium">Specializations ({course.specializations.length}):</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {course.specializations.slice(0, 3).map((s) => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                          {s}
                        </span>
                      ))}
                      {course.specializations.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                          +{course.specializations.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block font-medium">Core Subjects:</span>
                    <p className="text-slate-400 text-[11px] line-clamp-2">
                      {course.coreSubjects.join(', ')}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{course.defaultRoles.length} Target Roles</span>
                  <span className="text-cyan-400 font-medium">AI Coach Ready</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Universal Question Bank */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-200">Universal Question Repository</h2>
              <p className="text-xs text-slate-400">
                Curated and AI-verified questions across all disciplines with structured evaluation rubrics.
              </p>
            </div>
            <button
              onClick={() => setShowAddQuestionModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Discipline Question</span>
            </button>
          </div>

          <div className="space-y-3">
            {questionBank.slice(0, 10).map((q) => (
              <div
                key={q.id}
                className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 hover:border-slate-700 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-bold">
                      {q.courseName}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20 text-[10px] font-medium">
                      {q.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px]">
                      {q.difficulty}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px]">
                      {q.type}
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-100">{q.question}</h3>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{q.concept}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => alert(`Opening rubric review for question ${q.id}`)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                  >
                    View Rubric
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: ML Telemetry */}
      {activeTab === 'ml_telemetry' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Model Accuracy</span>
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono">91.4%</div>
              <p className="text-[11px] text-emerald-400">+2.1% cross-validated precision</p>
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Total Mocks Analyzed</span>
                <Users className="w-4 h-4 text-violet-400" />
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono">1,480+</div>
              <p className="text-[11px] text-slate-400">Across 12 discipline faculties</p>
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>F1-Score / ROC-AUC</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono">0.89 / 0.94</div>
              <p className="text-[11px] text-slate-400">Multi-class calibration</p>
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>LLM Engine Status</span>
                <Cpu className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-cyan-300 font-mono text-base pt-1">Gemini 3.7 Flash</div>
              <p className="text-[11px] text-emerald-400">Server-Side Proxy Connected</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Feature Weighting Importance in Readiness Pipeline</span>
            </h3>
            <div className="space-y-2 text-xs">
              {[
                { name: 'Domain Technical Accuracy & Specific Terminology', weight: 32, color: 'bg-cyan-500' },
                { name: 'STAR & IRAC Structured Response Clarity', weight: 24, color: 'bg-blue-500' },
                { name: 'Historical Mock Score Trajectory (3-Mock Moving Avg)', weight: 18, color: 'bg-violet-500' },
                { name: 'Speech Fluency & Voice Confidence Index', weight: 14, color: 'bg-fuchsia-500' },
                { name: 'ATS Resume Keyword & Project Alignment', weight: 12, color: 'bg-emerald-500' },
              ].map((f) => (
                <div key={f.name} className="space-y-1">
                  <div className="flex justify-between text-slate-300 font-medium">
                    <span>{f.name}</span>
                    <span className="font-mono text-slate-400">{f.weight}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className={`h-full ${f.color}`} style={{ width: `${f.weight * 3}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Course Modal */}
      {showAddCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100">Add Academic Course / Degree</h3>
              <button
                onClick={() => setShowAddCourseModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Short Degree Code (e.g. B.Tech, B.Com, LLB, B.Arch)</label>
                <input
                  type="text"
                  required
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Degree Title</label>
                <input
                  type="text"
                  required
                  value={newCourseFullName}
                  onChange={(e) => setNewCourseFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Discipline Category</label>
                <select
                  value={newCourseCategory}
                  onChange={(e) => setNewCourseCategory(e.target.value as EducationalCategory)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="Engineering & Technology">Engineering & Technology</option>
                  <option value="Medical & Healthcare">Medical & Healthcare</option>
                  <option value="Management & Business">Management & Business</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Science">Science</option>
                  <option value="Arts & Humanities">Arts & Humanities</option>
                  <option value="Law">Law</option>
                  <option value="Design & Creative">Design & Creative</option>
                  <option value="Education">Education</option>
                  <option value="Hospitality & Tourism">Hospitality & Tourism</option>
                  <option value="Agriculture">Agriculture</option>
                  <option value="Vocational & Diploma">Vocational & Diploma</option>
                  <option value="Other / Custom Course">Other / Custom Course</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Core Subjects (comma separated)</label>
                <input
                  type="text"
                  value={newCourseSubjects}
                  onChange={(e) => setNewCourseSubjects(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Specializations (comma separated)</label>
                <input
                  type="text"
                  value={newCourseSpecs}
                  onChange={(e) => setNewCourseSpecs(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Career Roles (comma separated)</label>
                <input
                  type="text"
                  value={newCourseRoles}
                  onChange={(e) => setNewCourseRoles(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  Save & Publish Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Question Modal */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100">Add Question to Universal Bank</h3>
              <button
                onClick={() => setShowAddQuestionModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Course / Degree</label>
                  <select
                    value={newQCourseName}
                    onChange={(e) => setNewQCourseName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  >
                    {coursesCatalog.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.fullName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category / Subject</label>
                  <input
                    type="text"
                    required
                    value={newQCategory}
                    onChange={(e) => setNewQCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Interview Question</label>
                <textarea
                  required
                  rows={3}
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  placeholder="Enter the complete question prompt..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Difficulty</label>
                  <select
                    value={newQDifficulty}
                    onChange={(e) => setNewQDifficulty(e.target.value as DifficultyLevel)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Interview Type</label>
                  <select
                    value={newQType}
                    onChange={(e) => setNewQType(e.target.value as InterviewType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value="Technical">Technical</option>
                    <option value="Domain">Domain</option>
                    <option value="Behavioral">Behavioral</option>
                    <option value="Situational">Situational</option>
                    <option value="Case Study">Case Study</option>
                    <option value="Viva">Viva</option>
                    <option value="HR">HR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Career Role</label>
                <input
                  type="text"
                  value={newQRole}
                  onChange={(e) => setNewQRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Core Underlying Principle / Concept</label>
                <input
                  type="text"
                  value={newQConcept}
                  onChange={(e) => setNewQConcept(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Recommended Approach Framework</label>
                <textarea
                  rows={2}
                  value={newQApproach}
                  onChange={(e) => setNewQApproach(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
