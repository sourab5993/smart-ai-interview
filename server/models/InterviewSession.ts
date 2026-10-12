import mongoose, { Document, Schema, Model } from 'mongoose';
import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase';

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
  userId?: any;
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

// In-Memory fallback store for interview sessions
const memorySessions = new Map<string, any>();

export function mapSupabaseToSession(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    userId: row.user_id,
    candidateName: row.candidate_name,
    candidateEmail: row.candidate_email,
    course: row.course,
    specialization: row.specialization,
    targetRole: row.target_role,
    difficulty: row.difficulty,
    interviewType: row.interview_type,
    language: row.language,
    status: row.status,
    overallScore: Number(row.overall_score || 0),
    behaviorScore: row.behavior_score !== null ? Number(row.behavior_score) : 80,
    readinessLevel: row.readiness_level,
    placementProbability: row.placement_probability,
    feedbackSummary: row.feedback_summary || '',
    strengths: Array.isArray(row.strengths) ? row.strengths : [],
    improvements: Array.isArray(row.improvements) ? row.improvements : [],
    rubricScores: row.rubric_scores || {},
    questions: Array.isArray(row.questions) ? row.questions : [],
    notes: row.notes || '',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

export function mapSessionToSupabase(session: any): Record<string, any> {
  const row: Record<string, any> = {};
  if (session.userId !== undefined) {
    const rawId = session.userId?.toString ? session.userId.toString() : String(session.userId);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
    if (isUUID) {
      row.user_id = rawId;
    }
  }
  if (session.candidateName !== undefined) row.candidate_name = session.candidateName;
  if (session.candidateEmail !== undefined) row.candidate_email = session.candidateEmail;
  if (session.course !== undefined) row.course = session.course;
  if (session.specialization !== undefined) row.specialization = session.specialization;
  if (session.targetRole !== undefined) row.target_role = session.targetRole;
  if (session.difficulty !== undefined) row.difficulty = session.difficulty;
  if (session.interviewType !== undefined) row.interview_type = session.interviewType;
  if (session.language !== undefined) row.language = session.language;
  if (session.status !== undefined) row.status = session.status;
  if (session.overallScore !== undefined) row.overall_score = session.overallScore;
  if (session.behaviorScore !== undefined) row.behavior_score = session.behaviorScore;
  if (session.readinessLevel !== undefined) row.readiness_level = session.readinessLevel;
  if (session.placementProbability !== undefined) row.placement_probability = session.placementProbability;
  if (session.feedbackSummary !== undefined) row.feedback_summary = session.feedbackSummary;
  if (session.strengths !== undefined) row.strengths = session.strengths;
  if (session.improvements !== undefined) row.improvements = session.improvements;
  if (session.rubricScores !== undefined) row.rubric_scores = session.rubricScores;
  if (session.questions !== undefined) row.questions = session.questions;
  if (session.notes !== undefined) row.notes = session.notes;
  return row;
}

export const SessionService = {
  async create(data: any): Promise<any> {
    // 1. Supabase PostgreSQL Provider
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const row = mapSessionToSupabase(data);
          const { data: savedRow, error } = await client
            .from('interview_sessions')
            .insert(row)
            .select()
            .single();

          if (!error && savedRow) {
            const mapped = mapSupabaseToSession(savedRow);
            memorySessions.set(mapped.id, mapped);
            return mapped;
          }
          if (error) {
            console.warn('[SessionService] Supabase insert warning:', error.message);
          }
        }
      } catch (err: any) {
        console.warn('[SessionService] Supabase create session fallback:', err?.message);
      }
    }

    // 2. MongoDB Provider
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

    // 3. In-Memory Fallback
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
    // 1. Supabase PostgreSQL Provider
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          let query = client.from('interview_sessions').select('*', { count: 'exact' });

          // Filter by candidate email or user ID if provided
          if (filter.$or && Array.isArray(filter.$or)) {
            const emailCond = filter.$or.find((c: any) => c.candidateEmail);
            const userCond = filter.$or.find((c: any) => c.userId);
            const email = emailCond?.candidateEmail;
            const uid = userCond?.userId?.toString ? userCond.userId.toString() : userCond?.userId;
            const isUUID = uid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid);

            if (isUUID && email) {
              query = query.or(`user_id.eq.${uid},candidate_email.ilike.${email}`);
            } else if (email) {
              query = query.ilike('candidate_email', email);
            } else if (isUUID) {
              query = query.eq('user_id', uid);
            }
          }

          if (filter.course) query = query.eq('course', filter.course);
          if (filter.targetRole) query = query.eq('target_role', filter.targetRole);
          if (filter.difficulty) query = query.eq('difficulty', filter.difficulty);

          const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(skip, skip + limit - 1);

          if (!error && data) {
            return {
              total: count !== null ? count : data.length,
              data: data.map(mapSupabaseToSession),
            };
          }
        }
      } catch (err: any) {
        console.warn('[SessionService] Supabase find fallback:', err?.message);
      }
    }

    // 2. MongoDB Provider
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

    // 3. In-Memory Fallback
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
    // 1. Supabase PostgreSQL Provider
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('interview_sessions')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (!error && data) {
            return mapSupabaseToSession(data);
          }
        }
      } catch (err: any) {
        console.warn('[SessionService] Supabase findById fallback:', err?.message);
      }
    }

    // 2. MongoDB Provider
    if (mongoose.connection.readyState === 1) {
      try {
        if (mongoose.isValidObjectId(id)) {
          const session = await InterviewSession.findById(id);
          if (session) return session;
        }
      } catch (err) {
        // Fallback
      }
    }

    // 3. In-Memory Fallback
    return memorySessions.get(id) || null;
  },

  async findByIdAndUpdate(id: string, updates: any): Promise<any> {
    // 1. Supabase PostgreSQL Provider
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const row = mapSessionToSupabase(updates);
          const { data, error } = await client
            .from('interview_sessions')
            .update(row)
            .eq('id', id)
            .select()
            .single();

          if (!error && data) {
            const mapped = mapSupabaseToSession(data);
            memorySessions.set(id, mapped);
            return mapped;
          }
        }
      } catch (err: any) {
        console.warn('[SessionService] Supabase findByIdAndUpdate fallback:', err?.message);
      }
    }

    // 2. MongoDB Provider
    if (mongoose.connection.readyState === 1) {
      try {
        if (mongoose.isValidObjectId(id)) {
          const updated = await InterviewSession.findByIdAndUpdate(id, { $set: updates }, { returnDocument: 'after', runValidators: true });
          if (updated) {
            memorySessions.set(id, updated.toObject ? updated.toObject() : updated);
            return updated;
          }
        }
      } catch (err) {
        // Fallback
      }
    }

    // 3. In-Memory Fallback
    const existing = memorySessions.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    memorySessions.set(id, updated);
    return updated;
  },

  async findByIdAndDelete(id: string): Promise<any> {
    // 1. Supabase PostgreSQL Provider
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { error } = await client
            .from('interview_sessions')
            .delete()
            .eq('id', id);

          memorySessions.delete(id);
          if (!error) return { id };
        }
      } catch (err: any) {
        console.warn('[SessionService] Supabase delete fallback:', err?.message);
      }
    }

    // 2. MongoDB Provider
    if (mongoose.connection.readyState === 1) {
      try {
        if (mongoose.isValidObjectId(id)) {
          const deleted = await InterviewSession.findByIdAndDelete(id);
          memorySessions.delete(id);
          if (deleted) return deleted;
        }
      } catch (err) {
        // Fallback
      }
    }

    // 3. In-Memory Fallback
    const existing = memorySessions.get(id);
    if (existing) {
      memorySessions.delete(id);
      return existing;
    }
    return null;
  },
};
