import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IQuestionRecord {
  question: string;
  category?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  userAnswer?: string;
  score?: number;
  feedback?: string;
  expectedKeyPoints?: string[];
  suggestedAnswer?: string;
}

export interface IRubricScores {
  technicalAccuracy?: number;
  structuralDelivery?: number;
  completenessAndDepth?: number;
  relevanceAndPrecision?: number;
  communicationFluency?: number;
  confidenceAndConviction?: number;
  problemSolvingMethod?: number;
  disciplineSynthesis?: number;
  interviewBehavior?: number;
}

export interface IInterviewSession extends Document {
  userId?: mongoose.Types.ObjectId;
  candidateName: string;
  candidateEmail?: string;
  course: string;
  specialization?: string;
  targetRole: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  interviewType: string;
  language: 'English' | 'Hindi' | 'Hinglish';
  status: 'in-progress' | 'completed' | 'abandoned';
  overallScore: number;
  behaviorScore?: number;
  readinessLevel: 'Not Ready' | 'Needs Practice' | 'Interview Ready' | 'Highly Ready';
  placementProbability?: 'Low' | 'Medium' | 'High';
  feedbackSummary?: string;
  strengths: string[];
  improvements: string[];
  rubricScores?: IRubricScores;
  questions: IQuestionRecord[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionRecordSchema = new Schema<IQuestionRecord>(
  {
    question: { type: String, required: true },
    category: { type: String },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard', 'Expert'],
      default: 'Medium',
    },
    userAnswer: { type: String, default: '' },
    score: { type: Number, min: 0, max: 100, default: 0 },
    feedback: { type: String, default: '' },
    expectedKeyPoints: [{ type: String }],
    suggestedAnswer: { type: String },
  },
  { _id: false }
);

const RubricScoresSchema = new Schema<IRubricScores>(
  {
    technicalAccuracy: { type: Number, min: 0, max: 100 },
    structuralDelivery: { type: Number, min: 0, max: 100 },
    completenessAndDepth: { type: Number, min: 0, max: 100 },
    relevanceAndPrecision: { type: Number, min: 0, max: 100 },
    communicationFluency: { type: Number, min: 0, max: 100 },
    confidenceAndConviction: { type: Number, min: 0, max: 100 },
    problemSolvingMethod: { type: Number, min: 0, max: 100 },
    disciplineSynthesis: { type: Number, min: 0, max: 100 },
    interviewBehavior: { type: Number, min: 0, max: 100 },
  },
  { _id: false }
);

const InterviewSessionSchema = new Schema<IInterviewSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    candidateName: {
      type: String,
      required: [true, 'Candidate name is required'],
      trim: true,
      index: true,
    },
    candidateEmail: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    course: {
      type: String,
      required: [true, 'Course is required (e.g., B.Tech, MBA, MBBS)'],
      trim: true,
    },
    specialization: {
      type: String,
      trim: true,
    },
    targetRole: {
      type: String,
      required: [true, 'Target role is required'],
      trim: true,
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard', 'Expert'],
      default: 'Medium',
    },
    interviewType: {
      type: String,
      default: 'Technical',
    },
    language: {
      type: String,
      enum: ['English', 'Hindi', 'Hinglish'],
      default: 'English',
    },
    status: {
      type: String,
      enum: ['in-progress', 'completed', 'abandoned'],
      default: 'completed',
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    behaviorScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 80,
    },
    readinessLevel: {
      type: String,
      enum: ['Not Ready', 'Needs Practice', 'Interview Ready', 'Highly Ready'],
      default: 'Needs Practice',
    },
    placementProbability: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    feedbackSummary: {
      type: String,
      default: '',
    },
    strengths: [{ type: String }],
    improvements: [{ type: String }],
    rubricScores: {
      type: RubricScoresSchema,
      default: () => ({}),
    },
    questions: [QuestionRecordSchema],
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Helpful index for querying sessions by candidate and date
InterviewSessionSchema.index({ userId: 1, createdAt: -1 });
InterviewSessionSchema.index({ candidateName: 1, createdAt: -1 });
InterviewSessionSchema.index({ targetRole: 1, createdAt: -1 });

export const InterviewSession: Model<IInterviewSession> =
  mongoose.models.InterviewSession ||
  mongoose.model<IInterviewSession>('InterviewSession', InterviewSessionSchema);

// In-Memory fallback store for interview sessions if MongoDB cluster is unreachable
const memorySessions = new Map<string, any>();

export const SessionService = {
  async create(data: any): Promise<any> {
    if (mongoose.connection.readyState === 1) {
      try {
        const session = new InterviewSession(data);
        const saved = await session.save();
        const obj = saved.toObject ? saved.toObject() : saved;
        memorySessions.set(saved._id.toString(), obj);
        return saved;
      } catch (err) {
        // Fallback
      }
    }

    const _id = new mongoose.Types.ObjectId();
    const memSession = {
      ...data,
      _id,
      id: _id.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memorySessions.set(_id.toString(), memSession);
    return memSession;
  },

  async find(filter: any, skip = 0, limit = 10): Promise<{ total: number; data: any[] }> {
    if (mongoose.connection.readyState === 1) {
      try {
        const [total, sessions] = await Promise.all([
          InterviewSession.countDocuments(filter),
          InterviewSession.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        ]);
        return { total, data: sessions };
      } catch (err) {
        // Fallback
      }
    }

    let all = Array.from(memorySessions.values());
    if (filter.$or && Array.isArray(filter.$or)) {
      all = all.filter((s) => {
        return filter.$or.some((cond: any) => {
          if (cond.userId && s.userId) {
            return s.userId.toString() === cond.userId.toString();
          }
          if (cond.candidateEmail && s.candidateEmail) {
            return s.candidateEmail.toLowerCase() === cond.candidateEmail.toLowerCase();
          }
          return false;
        });
      });
    }

    if (filter.course) {
      all = all.filter((s) => s.course === filter.course);
    }
    if (filter.targetRole) {
      all = all.filter((s) => s.targetRole === filter.targetRole);
    }

    const total = all.length;
    const sorted = all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const data = sorted.slice(skip, skip + limit);
    return { total, data };
  },

  async findById(id: string): Promise<any> {
    if (mongoose.connection.readyState === 1) {
      try {
        const session = await InterviewSession.findById(id);
        if (session) return session;
      } catch (err) {
        // Fallback
      }
    }
    return memorySessions.get(id) || null;
  },

  async findByIdAndUpdate(id: string, updates: any): Promise<any> {
    if (mongoose.connection.readyState === 1) {
      try {
        const updated = await InterviewSession.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
        if (updated) {
          memorySessions.set(id, updated.toObject ? updated.toObject() : updated);
          return updated;
        }
      } catch (err) {
        // Fallback
      }
    }

    const existing = memorySessions.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    memorySessions.set(id, updated);
    return updated;
  },

  async findByIdAndDelete(id: string): Promise<any> {
    if (mongoose.connection.readyState === 1) {
      try {
        const deleted = await InterviewSession.findByIdAndDelete(id);
        memorySessions.delete(id);
        if (deleted) return deleted;
      } catch (err) {
        // Fallback
      }
    }

    const existing = memorySessions.get(id);
    if (existing) {
      memorySessions.delete(id);
      return existing;
    }
    return null;
  },
};

