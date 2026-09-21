export type EducationalCategory =
  | 'Engineering & Technology'
  | 'Medical & Healthcare'
  | 'Management & Business'
  | 'Commerce'
  | 'Science'
  | 'Arts & Humanities'
  | 'Law'
  | 'Design & Creative'
  | 'Education'
  | 'Hospitality & Tourism'
  | 'Agriculture'
  | 'Vocational & Diploma'
  | 'Other / Custom Course';

export type Language = 'English' | 'Hindi' | 'Hinglish';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export type RoleType = string;

export type InterviewType =
  | 'Technical'
  | 'HR'
  | 'Domain'
  | 'Behavioral'
  | 'Situational'
  | 'Case Study'
  | 'Coding'
  | 'Viva'
  | 'Communication'
  | 'Aptitude'
  | 'System Design'
  | 'Mixed';

export type ReadinessLevel = 'Not Ready' | 'Needs Practice' | 'Interview Ready' | 'Highly Ready';

export interface CourseDefinition {
  id: string;
  category: EducationalCategory;
  name: string; // e.g. "B.Tech", "B.Com", "MBBS", "BBA", "LLB"
  fullName: string;
  degreeCode?: string;
  coreSubjects?: string[];
  specializations: string[];
  defaultRoles: string[];
  defaultSkills: string[];
  recommendedInterviewTypes: InterviewType[];
  evaluationDimensions: string[];
}

export interface JobRoleDefinition {
  id: string;
  title: string;
  category?: string;
  courseCategory: EducationalCategory;
  recommendedCourse: string;
  associatedCourseIds?: string[];
  description: string;
  demand: 'Very High' | 'High' | 'Moderate' | 'Growing';
  keySkills: string[];
  recommendedInterviewTypes: InterviewType[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  college?: string;
  degree: string; // e.g. "B.Tech", "B.Com", "BBA", "B.Pharm", "BA English"
  courseId?: string;
  courseName?: string;
  courseCategory: EducationalCategory;
  specialization: string; // e.g. "Mechanical Engineering", "Accounting & Finance", "Pharmacology"
  semester?: string;
  graduationYear?: string;
  targetRole: string; // Dynamic e.g. "Mechanical Design Engineer", "Financial Analyst", "Staff Nurse"
  targetIndustry?: string;
  experienceLevel: 'Entry Level (0-1 yrs)' | 'Junior (1-3 yrs)' | 'Mid-Level (3-5 yrs)' | 'Senior (5+ yrs)';
  preferredIndustry?: string;
  interviewPreference: InterviewType;
  preferredLanguage: Language;
  skills: string[];
  topSkills?: string[];
  resumeText?: string;
  resumeFileName?: string;
  resumeScore?: number;
  readinessScore: number;
  readinessLevel: ReadinessLevel;
  totalInterviews: number;
  avgScore: number;
  bestScore: number;
  questionsAnswered: number;
  currentStreak: number;
  createdAt: string;
  isAdmin?: boolean;
}

export interface SkillItem {
  id: string;
  name: string;
  category: string; // Domain Specific, Core Fundamentals, Tools & Tech, Soft Skills, Legal, Clinical, etc.
  currentProficiency?: number;
  targetProficiency?: number;
  currentScore?: number;
  requiredScore?: number;
  gap?: number;
  importance?: 'High' | 'Medium' | 'Low';
  priority?: 'High' | 'Medium' | 'Low';
  verifiedInterviews?: number;
  recommendedResources?: string[];
  lastAssessedDate?: string;
  lastEvaluated?: string;
  practiceQuestionsCount?: number;
}

export interface DynamicDimensionScore {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface BehaviorTelemetry {
  eyeContactScore: number;       // 0 - 100: direct eye contact / gaze adherence
  postureStabilityScore: number; // 0 - 100: steady poise vs excessive restlessness / fidgeting
  facialComposureScore: number;  // 0 - 100: confident poise, relaxed expression, smile presence
  facePresencePct: number;       // 0 - 100: % time candidate face was in frame
  overallBehaviorScore: number;  // 0 - 100: composite non-verbal score
  behaviorNotes: string[];       // Specific observations (e.g. "Maintained strong eye contact", "Minor posture shift detected")
  detectedExpression?: 'confident' | 'attentive' | 'neutral' | 'smiling' | 'hesitant' | 'restless';
  headPose?: 'centered' | 'turned-left' | 'turned-right' | 'looking-down' | 'looking-up';
  cameraActive?: boolean;
}

export interface AnswerEvaluation {
  overall_score: number;
  technical_accuracy: number;
  relevance: number;
  completeness: number;
  clarity: number;
  communication: number;
  structure: number;
  confidence: number;
  problem_solving: number;
  behavior_score?: number;
  behavior_telemetry?: BehaviorTelemetry;
  non_verbal_feedback?: string;
  discipline_scores?: DynamicDimensionScore[];
  strengths: string[];
  weaknesses: string[];
  missing_points: string[];
  better_answer: string;
  improvement_tip: string;
  feedback_summary?: string;
}

export interface InterviewQuestion {
  id: string;
  questionNumber: number;
  question: string;
  category: string;
  difficulty: DifficultyLevel;
  type: InterviewType;
  expectedKeyPoints?: string[];
  userAnswer?: string;
  answerMode?: 'voice' | 'text';
  timeSpentSeconds?: number;
  evaluation?: AnswerEvaluation;
  behaviorTelemetry?: BehaviorTelemetry;
  status: 'pending' | 'answered' | 'skipped';
}

export interface InterviewSession {
  id: string;
  userId: string;
  title: string;
  course: string;
  specialization: string;
  role: string;
  difficulty: DifficultyLevel;
  type: InterviewType;
  language: Language;
  skills: string[];
  totalQuestions: number;
  currentQuestionIndex: number;
  questions: InterviewQuestion[];
  durationMinutes: number;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  overallScore?: number;
  behaviorScore?: number;
  report?: InterviewReport;
}

export interface InterviewReport {
  id: string;
  sessionId: string;
  userId: string;
  course: string;
  role: string;
  overallScore: number;
  performanceLabel: string;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  clarityScore: number;
  confidenceScore: number;
  completenessScore: number;
  relevanceScore: number;
  structureScore: number;
  behaviorScore?: number;
  eyeContactAverage?: number;
  postureStabilityAverage?: number;
  composureAverage?: number;
  behaviorSummary?: string;
  nonVerbalRecommendations?: string[];
  domainSpecificScore?: number;
  domainDimensions?: { dimension: string; score: number; comment: string }[];
  topStrengths: string[];
  topWeaknesses: string[];
  repeatedMistakes: string[];
  missingConcepts: string[];
  technicalKnowledgeGaps: string[];
  aiExecutiveSummary: string;
  personalizedImprovementPlan: string[];
  createdAt: string;
}

export interface QuestionBankItem {
  id: string;
  title: string;
  question: string;
  courseCategory: EducationalCategory;
  courseName: string;
  category: string; // e.g., 'Thermodynamics', 'Accounting & GST', 'Pharmacology', 'DSA', 'Constitutional Law'
  difficulty: DifficultyLevel;
  role: string;
  type: InterviewType;
  tags: string[];
  concept: string;
  approach: string;
  solutionCode?: string;
  complexity?: string;
  commonMistakes: string[];
  interviewTip: string;
  bookmarked?: boolean;
}

export interface ResumeAnalysisResult {
  id: string;
  fileName: string;
  parsedName?: string;
  parsedEmail?: string;
  extractedCourse?: string;
  extractedSpecialization?: string;
  extractedSkills: string[];
  skillsIdentified?: string[];
  education: string[];
  experience: string[];
  projects: string[];
  certifications: string[];
  overallScore: number;
  atsCompatibilityScore: number;
  targetRole: string;
  skillMatchPercentage: number;
  matchingSkills: string[];
  missingSkills: string[];
  missingKeywords?: string[];
  projectStrengthScore: number;
  experienceRelevanceScore: number;
  strengths: string[];
  recommendedImprovements: string[];
  formattingImprovements?: string[];
  summary?: string;
  analyzedAt: string;
}

export interface JobMatchResult {
  id: string;
  jobTitle: string;
  company?: string;
  matchScore: number;
  matchPercentage?: number;
  matchingSkills: string[];
  missingSkills: string[];
  relevantExperiencePoints: string[];
  suggestedResumeBulletImprovements: string[];
  suggestedBullets?: string[];
  recommendedPreparationTopics: string[];
  analyzedAt: string;
}

export interface CareerPathRecommendation {
  careerTitle: string;
  matchPercentage: number;
  suitableRoles: string[];
  requiredSkills: string[];
  missingSkills: string[];
  recommendedCertifications: string[];
  recommendedInterviewTypes: InterviewType[];
  preparationRoadmap: string;
}

export interface StudyPlanItem {
  id: string;
  dayNumber: number;
  title: string;
  topic: string;
  focusArea: string;
  description: string;
  estimatedMinutes: number;
  resources: { title: string; url?: string; type: 'doc' | 'video' | 'practice' }[];
  practiceQuestionIds: string[];
  completed: boolean;
}

export interface StudyPlan {
  id: string;
  userId: string;
  title: string;
  course: string;
  targetRole: string;
  durationDays: number; // 7, 14, 30
  currentDay: number;
  items: StudyPlanItem[];
  generatedReason: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'interview_complete' | 'report_ready' | 'study_plan' | 'skill_gap' | 'streak' | 'recommendation' | 'plan_update' | 'system';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface MLReadinessPrediction {
  readinessScore: number;
  readinessLevel: ReadinessLevel;
  confidenceProbability: number;
  classProbabilities: {
    notReady: number;
    needsPractice: number;
    interviewReady: number;
    highlyReady: number;
  };
  featureWeights: {
    feature: string;
    weight: number;
    userValue: number;
    impact: 'positive' | 'negative' | 'neutral';
  }[];
  forecastedScoreNextInterview: number;
  recommendedFocusCategory: string;
}

export interface MLModelEvaluationMetrics {
  algorithm: string;
  trainedDatasetSize: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rocAuc: number;
  confusionMatrix: {
    classes: ReadinessLevel[];
    matrix: number[][];
  };
  featureImportance: { feature: string; importance: number }[];
  trainingTimestamp: string;
}
