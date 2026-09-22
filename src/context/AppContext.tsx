import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  SkillItem,
  InterviewSession,
  InterviewQuestion,
  InterviewReport,
  StudyPlan,
  NotificationItem,
  ResumeAnalysisResult,
  DifficultyLevel,
  InterviewType,
  QuestionBankItem,
  CourseDefinition,
  JobRoleDefinition,
  Language,
  BehaviorTelemetry,
} from '../types';
import {
  INITIAL_USER,
  INITIAL_SKILLS,
  DEMO_PAST_SESSIONS,
  INITIAL_STUDY_PLAN,
  INITIAL_NOTIFICATIONS,
  INITIAL_RESUME_ANALYSIS,
  QUESTION_BANK,
  COURSES_CATALOG,
  JOB_ROLES_CATALOG,
} from '../data/mockData';
import {
  generateAIQuestions,
  evaluateAIAnswer,
  analyzeFullInterview,
  analyzeResumeWithAI,
} from '../utils/apiClient';
import { extractUserFeatures, predictInterviewReadiness } from '../utils/mlEngine';
import confetti from 'canvas-confetti';

interface AppContextType {
  user: UserProfile;
  currentView: string;
  setCurrentView: (view: string) => void;
  selectedReportId: string | null;
  setSelectedReportId: (id: string | null) => void;
  activeSession: InterviewSession | null;
  pastSessions: InterviewSession[];
  skills: SkillItem[];
  studyPlan: StudyPlan;
  resumeAnalysis: ResumeAnalysisResult | null;
  notifications: NotificationItem[];
  bookmarkedQuestionIds: string[];
  bookmarkedReportIds: string[];
  bookmarkedStudyIds: string[];
  activeCompareSessions: [string | null, string | null];
  setActiveCompareSessions: (pair: [string | null, string | null]) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  isAiGenerating: boolean;
  isAiEvaluating: boolean;
  questionBank: QuestionBankItem[];
  coursesCatalog: CourseDefinition[];
  jobRolesCatalog: JobRoleDefinition[];

  authToken: string | null;
  isAuthenticated: boolean;

  // Actions
  login: (email?: string, passwordOrAsAdmin?: string | boolean) => Promise<any>;
  register: (name: string, email: string, password: string, targetRole?: string) => Promise<any>;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  changeUserCourse: (courseId: string, specialization?: string, targetRoleId?: string) => void;
  addNewCourseToCatalog: (newCourse: CourseDefinition) => void;
  addNewJobRoleToCatalog: (newRole: JobRoleDefinition) => void;
  startNewInterview: (config: {
    course?: string;
    specialization?: string;
    role: string;
    difficulty: DifficultyLevel;
    type: InterviewType;
    language?: Language;
    skills: string[];
    questionCount: number;
    durationMinutes: number;
  }) => Promise<void>;
  submitAnswer: (userAnswer: string, mode: 'voice' | 'text', behaviorTelemetry?: BehaviorTelemetry) => Promise<void>;
  nextQuestion: () => void;
  skipCurrentQuestion: () => void;
  completeActiveInterview: () => Promise<void>;
  abandonInterview: () => void;
  toggleStudyPlanItem: (itemId: string) => void;
  toggleBookmark: (type: 'question' | 'report' | 'study', id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  analyzeResumeText: (text: string, role: string, course?: string, fileName?: string) => Promise<void>;
  parseResumeDocumentFile: (file: File) => Promise<{ text: string; fileName: string; wordCount: number }>;
  addCustomQuestionToBank: (q: Omit<QuestionBankItem, 'id'>) => void;
  resetToDefaultData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function safeJsonParse<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved || saved === 'undefined' || saved === 'null') return fallback;
    return JSON.parse(saved);
  } catch {
    return fallback;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(() => {
    const parsed = safeJsonParse<UserProfile>('smart_interview_user', INITIAL_USER);
    return parsed || INITIAL_USER;
  });

  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('smart_interview_token');
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('smart_interview_token'));
  });

  // Verify stored JWT session on initial load
  useEffect(() => {
    const token = localStorage.getItem('smart_interview_token');
    if (!token) return;

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        // ONLY clear auth credentials if explicitly rejected with 401 Unauthorized (expired or invalid JWT)
        if (res.status === 401) {
          console.warn('[Auth] Token is invalid or expired. Logging out.');
          localStorage.removeItem('smart_interview_token');
          localStorage.removeItem('smart_interview_user');
          setAuthToken(null);
          setIsAuthenticated(false);
          setCurrentView('landing');
          return null;
        }
        return res.ok ? res.json().catch(() => null) : null;
      })
      .then((data) => {
        if (data && data.success && data.user) {
          setUser((prev) => ({ ...prev, ...data.user }));
          setIsAuthenticated(true);
        }
      })
      .catch((err) => {
        // Network failure / temporary server hiccup: retain active session with cached profile
        console.warn('[Auth] Could not reach server for session validation, retaining local session:', err);
      });
  }, []);

  const [currentView, setCurrentView] = useState<string>(() => {
    const token = localStorage.getItem('smart_interview_token');
    const savedView = localStorage.getItem('smart_interview_view');
    if (token) {
      // If user has a valid active token, restore their previous view or default to dashboard
      if (savedView && !['landing', 'auth', 'login', 'signup', 'forgot-password'].includes(savedView)) {
        return savedView;
      }
      return 'dashboard';
    }
    // If not authenticated, allow public informational views or default to landing
    if (savedView && ['contact', 'project-insights'].includes(savedView)) {
      return savedView;
    }
    return 'landing';
  });
  const [selectedReportId, setSelectedReportId] = useState<string | null>('rep_001');
  const [pastSessions, setPastSessions] = useState<InterviewSession[]>(() => {
    return safeJsonParse<InterviewSession[]>('smart_interview_sessions', DEMO_PAST_SESSIONS);
  });
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null);
  const [skills, setSkills] = useState<SkillItem[]>(() => {
    return safeJsonParse<SkillItem[]>('smart_interview_skills', INITIAL_SKILLS);
  });
  const [studyPlan, setStudyPlan] = useState<StudyPlan>(() => {
    return safeJsonParse<StudyPlan>('smart_interview_study_plan', INITIAL_STUDY_PLAN);
  });
  const [resumeAnalysis, setResumeAnalysis] = useState<ResumeAnalysisResult | null>(() => {
    return safeJsonParse<ResumeAnalysisResult | null>('smart_interview_resume', INITIAL_RESUME_ANALYSIS);
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    return safeJsonParse<NotificationItem[]>('smart_interview_notifs', INITIAL_NOTIFICATIONS);
  });
  const [questionBank, setQuestionBank] = useState<QuestionBankItem[]>(() => {
    const saved = safeJsonParse<QuestionBankItem[]>('smart_interview_qb', QUESTION_BANK);
    if (saved && Array.isArray(saved) && saved.length >= QUESTION_BANK.length) {
      return saved;
    }
    return QUESTION_BANK;
  });
  const [coursesCatalog, setCoursesCatalog] = useState<CourseDefinition[]>(() => {
    return safeJsonParse<CourseDefinition[]>('smart_interview_courses', COURSES_CATALOG);
  });
  const [jobRolesCatalog, setJobRolesCatalog] = useState<JobRoleDefinition[]>(() => {
    return safeJsonParse<JobRoleDefinition[]>('smart_interview_roles', JOB_ROLES_CATALOG);
  });

  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState<string[]>(['qb_01', 'qb_mech_01', 'qb_com_01', 'qb_ph_01']);
  const [bookmarkedReportIds, setBookmarkedReportIds] = useState<string[]>(['rep_001']);
  const [bookmarkedStudyIds, setBookmarkedStudyIds] = useState<string[]>(['sp_1', 'sp_4', 'sp_mech_1']);
  const [activeCompareSessions, setActiveCompareSessions] = useState<[string | null, string | null]>(['sess_001', 'sess_003']);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [isAiEvaluating, setIsAiEvaluating] = useState<boolean>(false);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('smart_interview_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('smart_interview_sessions', JSON.stringify(pastSessions));
  }, [pastSessions]);

  useEffect(() => {
    localStorage.setItem('smart_interview_skills', JSON.stringify(skills));
  }, [skills]);

  useEffect(() => {
    localStorage.setItem('smart_interview_study_plan', JSON.stringify(studyPlan));
  }, [studyPlan]);

  useEffect(() => {
    localStorage.setItem('smart_interview_notifs', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('smart_interview_courses', JSON.stringify(coursesCatalog));
  }, [coursesCatalog]);

  useEffect(() => {
    localStorage.setItem('smart_interview_roles', JSON.stringify(jobRolesCatalog));
  }, [jobRolesCatalog]);

  // Persist current active view so user stays on the same page across page refreshes
  useEffect(() => {
    if (currentView) {
      localStorage.setItem('smart_interview_view', currentView);
    }
  }, [currentView]);

  // Dynamic ML Readiness recalculation when past interviews change
  useEffect(() => {
    const features = extractUserFeatures(pastSessions);
    const prediction = predictInterviewReadiness(features);
    setUser((prev) => ({
      ...prev,
      readinessScore: prediction.readinessScore,
      readinessLevel: prediction.readinessLevel,
      totalInterviews: pastSessions.filter((s) => s.status === 'completed').length,
      avgScore: Math.round(
        pastSessions.filter((s) => s.status === 'completed' && s.overallScore).reduce((acc, s) => acc + (s.overallScore || 0), 0) /
          Math.max(1, pastSessions.filter((s) => s.status === 'completed').length)
      ),
    }));
  }, [pastSessions]);

  const login = async (email?: string, passwordOrAsAdmin?: string | boolean) => {
    const targetEmail = (email || '').trim();
    const targetPassword = typeof passwordOrAsAdmin === 'string' ? passwordOrAsAdmin : '';

    if (!targetEmail || !targetPassword) {
      throw new Error('Please provide both email address and password to sign in.');
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, password: targetPassword }),
    });

    const responseText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Server returned status ${res.status}: ${responseText.slice(0, 120)}`);
    }

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Invalid email or password');
    }

    if (data.token) {
      localStorage.setItem('smart_interview_token', data.token);
      localStorage.setItem('smart_interview_view', 'dashboard');
      setAuthToken(data.token);
      setIsAuthenticated(true);
    }
    if (data.user) {
      setUser((prev) => ({ ...prev, ...data.user }));
    }
    setCurrentView('dashboard');
    return data;
  };

  const register = async (name: string, email: string, password: string, targetRole?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, targetRole }),
    });

    const responseText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Server returned status ${res.status}: ${responseText.slice(0, 120)}`);
    }

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Registration failed');
    }

    if (data.token) {
      localStorage.setItem('smart_interview_token', data.token);
      localStorage.setItem('smart_interview_view', 'dashboard');
      setAuthToken(data.token);
      setIsAuthenticated(true);
    }
    if (data.user) {
      setUser((prev) => ({ ...prev, ...data.user }));
    }
    setCurrentView('dashboard');
    return data;
  };

  const logout = () => {
    const token = localStorage.getItem('smart_interview_token');
    if (token) {
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    }
    localStorage.removeItem('smart_interview_token');
    localStorage.removeItem('smart_interview_user');
    localStorage.removeItem('smart_interview_view');
    setAuthToken(null);
    setIsAuthenticated(false);
    setUser(INITIAL_USER);
    setCurrentView('landing');
  };

  const updateProfile = (profileUpdates: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...profileUpdates }));
  };

  // Change user course & dynamic role adaptation
  const changeUserCourse = (courseId: string, specialization?: string, targetRoleId?: string) => {
    const foundCourse = coursesCatalog.find((c) => c.id === courseId);
    if (!foundCourse) return;

    const chosenSpec = specialization || foundCourse.specializations[0] || 'General';
    const compatibleRoles = jobRolesCatalog.filter(
      (r) => r.associatedCourseIds?.includes(courseId) || r.courseCategory === foundCourse.category
    );
    const chosenRole = targetRoleId
      ? jobRolesCatalog.find((r) => r.id === targetRoleId)?.title || targetRoleId || compatibleRoles[0]?.title || 'Professional'
      : compatibleRoles[0]?.title || 'Professional';

    // Update skills dynamically from course core subjects
    const newSkills: SkillItem[] = foundCourse.coreSubjects.map((subj, idx) => ({
      id: `sk_gen_${courseId}_${idx}`,
      name: subj,
      category: idx % 2 === 0 ? 'Technical' : 'Analytical',
      currentProficiency: 70 + (idx % 4) * 6,
      targetProficiency: 90,
      importance: idx === 0 ? 'High' : 'Medium',
      verifiedInterviews: 1,
      recommendedResources: [`${subj} Masterclass`, `${subj} Standard Case Studies & Interview Bank`],
      lastAssessedDate: new Date().toISOString().split('T')[0],
    }));

    setSkills(newSkills);

    setUser((prev) => ({
      ...prev,
      courseId: foundCourse.id,
      courseName: foundCourse.name,
      degree: foundCourse.name,
      courseCategory: foundCourse.category,
      specialization: chosenSpec,
      targetRole: chosenRole,
      targetIndustry: foundCourse.name,
      topSkills: foundCourse.coreSubjects.slice(0, 5),
    }));

    // Generate discipline-specific notification
    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      userId: user.id,
      title: `Curriculum Adapted to ${foundCourse.name}`,
      message: `Your interview coach, question bank, and ML evaluation engine are now specialized for ${chosenSpec} and ${chosenRole}.`,
      type: 'plan_update',
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [notif, ...prev]);
  };

  const addNewCourseToCatalog = (newCourse: CourseDefinition) => {
    setCoursesCatalog((prev) => [newCourse, ...prev]);
    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      userId: user.id,
      title: `New Course Added: ${newCourse.name}`,
      message: `Admin successfully created "${newCourse.name}" (${newCourse.degreeCode}) with ${newCourse.specializations.length} specializations.`,
      type: 'system',
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [notif, ...prev]);
  };

  const addNewJobRoleToCatalog = (newRole: JobRoleDefinition) => {
    setJobRolesCatalog((prev) => [newRole, ...prev]);
  };

  const startNewInterview = async (config: {
    course?: string;
    specialization?: string;
    role: string;
    difficulty: DifficultyLevel;
    type: InterviewType;
    language?: Language;
    skills: string[];
    questionCount: number;
    durationMinutes: number;
  }) => {
    if (!isAuthenticated) {
      setCurrentView('login');
      throw new Error('Interview access requires an active account. Please sign in or create an account to begin.');
    }

    setIsAiGenerating(true);
    try {
      const activeCourse = config.course || user.courseName || user.degree || 'B.Tech';
      const activeSpec = config.specialization || user.specialization || 'General';

      const generatedQuestions = await generateAIQuestions({
        course: activeCourse,
        specialization: activeSpec,
        role: config.role,
        difficulty: config.difficulty,
        type: config.type,
        language: config.language || user.preferredLanguage || 'English',
        skills: config.skills,
        resumeText: user.resumeText || user.resumeFileName,
        count: config.questionCount,
      });

      const newSession: InterviewSession = {
        id: `sess_${Date.now()}`,
        userId: user.id,
        title: `${activeCourse} ${config.role} ${config.type} Mock`,
        course: activeCourse,
        specialization: activeSpec,
        role: config.role,
        difficulty: config.difficulty,
        type: config.type,
        language: config.language || user.preferredLanguage || 'English',
        skills: config.skills,
        totalQuestions: generatedQuestions.length,
        currentQuestionIndex: 0,
        questions: generatedQuestions,
        durationMinutes: config.durationMinutes,
        startedAt: new Date().toISOString(),
        status: 'in_progress',
      };

      setActiveSession(newSession);
      setCurrentView('live-interview');
    } catch (e) {
      console.error('Failed to start interview:', e);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const submitAnswer = async (userAnswer: string, mode: 'voice' | 'text', behaviorTelemetry?: BehaviorTelemetry) => {
    if (!activeSession) return;
    const qIndex = activeSession.currentQuestionIndex;
    const currentQ = activeSession.questions[qIndex];
    if (!currentQ) return;

    setIsAiEvaluating(true);
    try {
      const evaluation = await evaluateAIAnswer({
        question: currentQ.question,
        userAnswer,
        course: activeSession.course || user.courseName,
        specialization: activeSession.specialization || user.specialization,
        role: activeSession.role,
        difficulty: currentQ.difficulty,
        type: currentQ.type,
        answerMode: mode,
        language: activeSession.language || user.preferredLanguage,
        behaviorTelemetry,
      });

      const updatedQuestions = [...activeSession.questions];
      updatedQuestions[qIndex] = {
        ...currentQ,
        userAnswer,
        answerMode: mode,
        evaluation,
        behaviorTelemetry,
        status: 'answered',
      };

      const updatedSession = {
        ...activeSession,
        questions: updatedQuestions,
      };

      setActiveSession(updatedSession);
    } catch (e) {
      console.error('Answer evaluation failed:', e);
    } finally {
      setIsAiEvaluating(false);
    }
  };

  const skipCurrentQuestion = () => {
    if (!activeSession) return;
    const qIndex = activeSession.currentQuestionIndex;
    const currentQ = activeSession.questions[qIndex];
    if (!currentQ) return;

    const updatedQuestions = [...activeSession.questions];
    updatedQuestions[qIndex] = {
      ...currentQ,
      status: 'skipped',
    };

    if (qIndex + 1 < activeSession.totalQuestions) {
      setActiveSession({
        ...activeSession,
        currentQuestionIndex: qIndex + 1,
        questions: updatedQuestions,
      });
    } else {
      completeActiveInterview();
    }
  };

  const nextQuestion = () => {
    if (!activeSession) return;
    const nextIdx = activeSession.currentQuestionIndex + 1;
    if (nextIdx < activeSession.totalQuestions) {
      setActiveSession({
        ...activeSession,
        currentQuestionIndex: nextIdx,
      });
    } else {
      completeActiveInterview();
    }
  };

  const completeActiveInterview = async () => {
    if (!activeSession) return;
    setIsAiEvaluating(true);

    try {
      const report: InterviewReport = await analyzeFullInterview({
        session: activeSession,
        course: activeSession.course || user.courseName,
        role: activeSession.role,
      });

      const completedSession: InterviewSession = {
        ...activeSession,
        completedAt: new Date().toISOString(),
        status: 'completed',
        overallScore: report.overallScore,
        behaviorScore: report.behaviorScore,
        report,
      };

      setPastSessions((prev) => [completedSession, ...prev]);
      setSelectedReportId(report.id);
      setActiveSession(null);

      // Trigger Confetti Celebration
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981'],
        });
      } catch {}

      // Persist to MongoDB Atlas Database
      try {
        const token = localStorage.getItem('smart_interview_token');
        fetch('/api/db/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            candidateName: user.name || 'Candidate',
            candidateEmail: user.email || 'candidate@example.com',
            course: activeSession.course || user.courseName || 'B.Tech',
            specialization: user.specialization || 'General',
            targetRole: activeSession.role || user.targetRole,
            difficulty: activeSession.difficulty || 'Medium',
            interviewType: activeSession.type || 'Technical',
            language: user.preferredLanguage || 'English',
            status: 'completed',
            overallScore: report.overallScore,
            behaviorScore: report.behaviorScore,
            readinessLevel: report.performanceLabel || user.readinessLevel,
            placementProbability: report.overallScore >= 75 ? 'High' : report.overallScore >= 50 ? 'Medium' : 'Low',
            feedbackSummary: report.aiExecutiveSummary || '',
            strengths: report.topStrengths || [],
            improvements: report.personalizedImprovementPlan || [],
            rubricScores: {
              technicalAccuracy: report.technicalScore || 0,
              structuralDelivery: report.structureScore || 0,
              completenessAndDepth: report.completenessScore || 0,
              relevanceAndPrecision: report.relevanceScore || 0,
              communicationFluency: report.communicationScore || 0,
              confidenceAndConviction: report.confidenceScore || 0,
              problemSolvingMethod: report.problemSolvingScore || 0,
              disciplineSynthesis: report.domainSpecificScore || 0,
            },
            questions: activeSession.questions.map((q) => ({
              question: q.question,
              category: q.category,
              difficulty: q.difficulty,
              userAnswer: q.userAnswer || '',
              score: q.evaluation?.overall_score || 0,
              feedback: q.evaluation?.feedback_summary || q.evaluation?.better_answer || '',
              expectedKeyPoints: q.expectedKeyPoints || [],
            })),
            notes: `Mock interview session completed on ${new Date().toLocaleDateString()}`,
          }),
        })
          .then((res) => (res.ok ? res.json().catch(() => null) : null))
          .then((data) => {
            if (data?.success) {
              console.log('✅ Session saved to MongoDB Atlas:', data.data?._id);
            }
          })
          .catch((err) => console.error('Failed to save session to MongoDB:', err));
      } catch (err) {
        console.error('Error dispatching MongoDB save:', err);
      }

      // Add Notification
      const newNotif: NotificationItem = {
        id: `notif_${Date.now()}`,
        userId: user.id,
        title: 'Interview Completed & Saved to Cloud',
        message: `Your ${completedSession.title} report is ready and synced to MongoDB Atlas. Score: ${report.overallScore}/100.`,
        type: 'report_ready',
        read: false,
        actionUrl: `/report/${report.id}`,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [newNotif, ...prev]);

      // Update question counts
      setUser((prev) => ({
        ...prev,
        questionsAnswered: prev.questionsAnswered + completedSession.questions.length,
        bestScore: Math.max(prev.bestScore, report.overallScore),
        currentStreak: prev.currentStreak + 1,
      }));

      setCurrentView('report');
    } catch (e) {
      console.error('Failed to complete interview:', e);
      setCurrentView('dashboard');
    } finally {
      setIsAiEvaluating(false);
    }
  };

  const abandonInterview = () => {
    setActiveSession(null);
    setCurrentView('dashboard');
  };

  const toggleStudyPlanItem = (itemId: string) => {
    setStudyPlan((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, completed: !item.completed } : item)),
    }));
  };

  const toggleBookmark = (type: 'question' | 'report' | 'study', id: string) => {
    if (type === 'question') {
      setBookmarkedQuestionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else if (type === 'report') {
      setBookmarkedReportIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setBookmarkedStudyIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const analyzeResumeText = async (text: string, role: string, course?: string, fileName = 'Uploaded_Resume.pdf') => {
    setIsAiGenerating(true);
    try {
      const result = await analyzeResumeWithAI({
        resumeText: text,
        targetRole: role,
        course: course || user.courseName || user.degree,
        fileName,
      });
      setResumeAnalysis(result);
      setUser((prev) => ({
        ...prev,
        resumeText: text,
        resumeFileName: fileName,
        resumeScore: result.overallScore,
      }));
    } catch (e) {
      console.error('Resume analysis failed:', e);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const parseResumeDocumentFile = async (file: File): Promise<{ text: string; fileName: string; wordCount: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const fileData = reader.result as string;
          const res = await fetch('/api/resume/parse-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData,
              fileName: file.name,
              fileType: file.type,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to extract text from the resume document.');
          }
          // Update profile with extracted text and file name
          updateProfile({
            resumeFileName: file.name,
            resumeText: data.text,
          });
          resolve({ text: data.text, fileName: file.name, wordCount: data.wordCount });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read document file.'));
      reader.readAsDataURL(file);
    });
  };

  const addCustomQuestionToBank = (q: Omit<QuestionBankItem, 'id'>) => {
    const newItem: QuestionBankItem = {
      ...q,
      id: `qb_custom_${Date.now()}`,
    };
    setQuestionBank((prev) => [newItem, ...prev]);
  };

  const resetToDefaultData = () => {
    localStorage.removeItem('smart_interview_user');
    localStorage.removeItem('smart_interview_sessions');
    localStorage.removeItem('smart_interview_skills');
    localStorage.removeItem('smart_interview_study_plan');
    localStorage.removeItem('smart_interview_notifs');
    localStorage.removeItem('smart_interview_qb');
    localStorage.removeItem('smart_interview_courses');
    localStorage.removeItem('smart_interview_roles');
    localStorage.removeItem('smart_interview_resume');

    setUser(INITIAL_USER);
    setPastSessions(DEMO_PAST_SESSIONS);
    setSkills(INITIAL_SKILLS);
    setStudyPlan(INITIAL_STUDY_PLAN);
    setResumeAnalysis(INITIAL_RESUME_ANALYSIS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setQuestionBank(QUESTION_BANK);
    setCoursesCatalog(COURSES_CATALOG);
    setJobRolesCatalog(JOB_ROLES_CATALOG);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        currentView,
        setCurrentView,
        selectedReportId,
        setSelectedReportId,
        activeSession,
        pastSessions,
        skills,
        studyPlan,
        resumeAnalysis,
        notifications,
        bookmarkedQuestionIds,
        bookmarkedReportIds,
        bookmarkedStudyIds,
        activeCompareSessions,
        setActiveCompareSessions,
        globalSearchQuery,
        setGlobalSearchQuery,
        isAiGenerating,
        isAiEvaluating,
        questionBank,
        coursesCatalog,
        jobRolesCatalog,
        authToken,
        isAuthenticated,
        login,
        register,
        logout,
        updateProfile,
        changeUserCourse,
        addNewCourseToCatalog,
        addNewJobRoleToCatalog,
        startNewInterview,
        submitAnswer,
        nextQuestion,
        skipCurrentQuestion,
        completeActiveInterview,
        abandonInterview,
        toggleStudyPlanItem,
        toggleBookmark,
        markNotificationRead,
        markAllNotificationsRead,
        analyzeResumeText,
        parseResumeDocumentFile,
        addCustomQuestionToBank,
        resetToDefaultData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
