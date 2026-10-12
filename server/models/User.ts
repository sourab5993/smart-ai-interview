import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  authProvider?: 'local' | 'google';
  googleId?: string;
  isVerified?: boolean;
  role: 'Candidate' | 'Admin' | 'Interviewer';
  isAdmin: boolean;
  avatar?: string;
  college?: string;
  degree: string;
  courseId?: string;
  courseName?: string;
  courseCategory: string;
  specialization: string;
  semester?: string;
  graduationYear?: string;
  targetRole: string;
  targetIndustry?: string;
  experienceLevel: string;
  preferredIndustry?: string;
  interviewPreference: string;
  preferredLanguage: string;
  skills: string[];
  topSkills?: string[];
  readinessScore: number;
  readinessLevel: string;
  totalInterviews: number;
  avgScore: number;
  bestScore: number;
  questionsAnswered: number;
  currentStreak: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  toSafeJSON(): Record<string, any>;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    },
    passwordHash: {
      type: String,
      required: false,
      select: false, // Do not return by default in queries
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: {
      type: String,
      sparse: true,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['Candidate', 'Admin', 'Interviewer'],
      default: 'Candidate',
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
    college: {
      type: String,
      default: 'National Institute of Technology',
    },
    degree: {
      type: String,
      default: 'B.Tech',
    },
    courseId: {
      type: String,
      default: 'btech-cs',
    },
    courseName: {
      type: String,
      default: 'B.Tech - Computer Science & Engineering',
    },
    courseCategory: {
      type: String,
      default: 'Engineering & Technology',
    },
    specialization: {
      type: String,
      default: 'Computer Science & Engineering',
    },
    semester: {
      type: String,
      default: '8th Semester',
    },
    graduationYear: {
      type: String,
      default: '2026',
    },
    targetRole: {
      type: String,
      default: 'Full Stack Developer',
    },
    targetIndustry: {
      type: String,
      default: 'High Growth AI & SaaS Startups',
    },
    experienceLevel: {
      type: String,
      default: 'Entry Level (0-1 yrs)',
    },
    preferredIndustry: {
      type: String,
      default: 'High Growth AI & SaaS Startups',
    },
    interviewPreference: {
      type: String,
      default: 'Technical',
    },
    preferredLanguage: {
      type: String,
      default: 'English',
    },
    skills: {
      type: [String],
      default: ['JavaScript', 'TypeScript', 'React.js', 'Node.js', 'PostgreSQL', 'REST APIs', 'Data Structures & Algorithms'],
    },
    topSkills: {
      type: [String],
      default: ['Full Stack Architecture', 'System Design', 'React & Node.js'],
    },
    readinessScore: {
      type: Number,
      default: 75,
      min: 0,
      max: 100,
    },
    readinessLevel: {
      type: String,
      default: 'Needs Practice',
    },
    totalInterviews: {
      type: Number,
      default: 0,
    },
    avgScore: {
      type: Number,
      default: 0,
    },
    bestScore: {
      type: Number,
      default: 0,
    },
    questionsAnswered: {
      type: Number,
      default: 0,
    },
    currentStreak: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Password comparison method using bcrypt
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.passwordHash) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Safe JSON serialization method excluding passwordHash and internal Mongoose fields
UserSchema.methods.toSafeJSON = function (): Record<string, any> {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.passwordHash;
  delete obj.__v;
  obj.id = obj._id?.toString() || obj.id;
  return obj;
};

// Also configure default JSON transform
UserSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    delete ret.passwordHash;
    delete ret.__v;
    ret.id = ret._id?.toString();
    return ret;
  },
});

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

// In-Memory fallback store if cloud databases are unreachable
const memoryUsers = new Map<string, any>();

export function wrapUserWithMethods(userData: any): any {
  if (!userData) return null;
  const user = { ...userData };
  user.id = user.id || user._id?.toString();
  user._id = user._id || user.id;
  user.isVerified = user.isVerified !== undefined ? Boolean(user.isVerified) : true;
  user.isAdmin = Boolean(user.isAdmin);
  user.authProvider = user.authProvider || 'local';
  user.skills = Array.isArray(user.skills) ? user.skills : [];
  user.comparePassword = async (candidatePassword: string) => {
    const hash = user.passwordHash || user.password_hash;
    if (!hash) return false;
    return bcrypt.compare(candidatePassword, hash);
  };
  user.toSafeJSON = () => {
    const copy = { ...user };
    delete copy.passwordHash;
    delete copy.password_hash;
    delete copy.__v;
    return copy;
  };
  return user;
}

export function mapSupabaseToUser(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    authProvider: row.auth_provider,
    googleId: row.google_id,
    isVerified: row.is_verified,
    role: row.role,
    isAdmin: row.is_admin,
    avatar: row.avatar,
    college: row.college,
    degree: row.degree,
    courseId: row.course_id,
    courseName: row.course_name,
    courseCategory: row.course_category,
    specialization: row.specialization,
    semester: row.semester,
    graduationYear: row.graduation_year,
    targetRole: row.target_role,
    targetIndustry: row.target_industry,
    experienceLevel: row.experience_level,
    preferredIndustry: row.preferred_industry,
    interviewPreference: row.interview_preference,
    preferredLanguage: row.preferred_language,
    skills: row.skills || [],
    topSkills: row.top_skills || [],
    readinessScore: row.readiness_score,
    readinessLevel: row.readiness_level,
    totalInterviews: row.total_interviews,
    avgScore: Number(row.avg_score || 0),
    bestScore: Number(row.best_score || 0),
    questionsAnswered: row.questions_answered,
    currentStreak: row.current_streak,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

export function mapUserToSupabase(user: any): Record<string, any> {
  const row: Record<string, any> = {};
  if (user.name !== undefined) row.name = user.name;
  if (user.email !== undefined) row.email = user.email.toLowerCase().trim();
  if (user.passwordHash !== undefined) row.password_hash = user.passwordHash;
  if (user.password_hash !== undefined) row.password_hash = user.password_hash;
  if (user.authProvider !== undefined) row.auth_provider = user.authProvider;
  if (user.googleId !== undefined) row.google_id = user.googleId;
  if (user.isVerified !== undefined) row.is_verified = user.isVerified;
  if (user.role !== undefined) row.role = user.role;
  if (user.isAdmin !== undefined) row.is_admin = user.isAdmin;
  if (user.avatar !== undefined) row.avatar = user.avatar;
  if (user.college !== undefined) row.college = user.college;
  if (user.degree !== undefined) row.degree = user.degree;
  if (user.courseId !== undefined) row.course_id = user.courseId;
  if (user.courseName !== undefined) row.course_name = user.courseName;
  if (user.courseCategory !== undefined) row.course_category = user.courseCategory;
  if (user.specialization !== undefined) row.specialization = user.specialization;
  if (user.semester !== undefined) row.semester = user.semester;
  if (user.graduationYear !== undefined) row.graduation_year = user.graduationYear;
  if (user.targetRole !== undefined) row.target_role = user.targetRole;
  if (user.targetIndustry !== undefined) row.target_industry = user.targetIndustry;
  if (user.experienceLevel !== undefined) row.experience_level = user.experienceLevel;
  if (user.preferredIndustry !== undefined) row.preferred_industry = user.preferredIndustry;
  if (user.interviewPreference !== undefined) row.interview_preference = user.interviewPreference;
  if (user.preferredLanguage !== undefined) row.preferred_language = user.preferredLanguage;
  if (user.skills !== undefined) row.skills = user.skills;
  if (user.topSkills !== undefined) row.top_skills = user.topSkills;
  if (user.readinessScore !== undefined) row.readiness_score = user.readinessScore;
  if (user.readinessLevel !== undefined) row.readiness_level = user.readinessLevel;
  if (user.totalInterviews !== undefined) row.total_interviews = user.totalInterviews;
  if (user.avgScore !== undefined) row.avg_score = user.avgScore;
  if (user.bestScore !== undefined) row.best_score = user.bestScore;
  if (user.questionsAnswered !== undefined) row.questions_answered = user.questionsAnswered;
  if (user.currentStreak !== undefined) row.current_streak = user.currentStreak;
  return row;
}

export const UserService = {
  async findByEmail(email: string): Promise<any> {
    const normalized = email.trim().toLowerCase();

    // 1. Supabase PostgreSQL Provider (High priority if configured)
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('users')
            .select('*')
            .eq('email', normalized)
            .maybeSingle();

          if (!error && data) {
            return wrapUserWithMethods(mapSupabaseToUser(data));
          }
        }
      } catch (err: any) {
        console.warn('[UserService] Supabase findByEmail failed, checking fallback:', err?.message);
      }
    }

    // 2. MongoDB Provider
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
      try {
        const user = await User.findOne({ email: normalized }).select('+passwordHash');
        if (user) return user;
      } catch (err) {
        // Fallback to memory store if query fails
      }
    }

    // 3. In-Memory Fallback
    const memUser = memoryUsers.get(normalized);
    return memUser ? wrapUserWithMethods(memUser) : null;
  },

  async findById(id: string): Promise<any> {
    // 1. Supabase PostgreSQL Provider
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('users')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (!error && data) {
            return wrapUserWithMethods(mapSupabaseToUser(data));
          }
        }
      } catch (err: any) {
        console.warn('[UserService] Supabase findById fallback:', err?.message);
      }
    }

    // 2. MongoDB Provider
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
      try {
        if (mongoose.isValidObjectId(id)) {
          const user = await User.findById(id);
          if (user) return user;
        }
      } catch (err) {
        // Fallback to memory store if query fails
      }
    }

    // 3. In-Memory Fallback
    for (const u of memoryUsers.values()) {
      if (u._id?.toString() === id || u.id === id) {
        return wrapUserWithMethods(u);
      }
    }
    return null;
  },

  async create(userData: any): Promise<any> {
    const normalized = userData.email.trim().toLowerCase();

    // 1. Supabase PostgreSQL Provider
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const row = mapUserToSupabase(userData);
          const { data, error } = await client
            .from('users')
            .insert(row)
            .select()
            .single();

          if (error) {
            if (error.code === '23505') {
              const err: any = new Error('An account with this email address already exists.');
              err.code = 11000;
              throw err;
            }
            throw error;
          }

          if (data) {
            const mapped = wrapUserWithMethods(mapSupabaseToUser(data));
            memoryUsers.set(normalized, mapped);
            return mapped;
          }
        }
      } catch (err: any) {
        if (err.code === 11000 || err.code === '23505') throw err;
        console.warn('[UserService] Supabase create user fallback:', err?.message);
      }
    }

    // 2. MongoDB Provider
    if (memoryUsers.has(normalized)) {
      const err: any = new Error('Duplicate key');
      err.code = 11000;
      throw err;
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const user = new User(userData);
        const saved = await user.save();
        memoryUsers.set(normalized, saved.toObject ? saved.toObject() : saved);
        return saved;
      } catch (err: any) {
        if (err?.code === 11000) throw err;
      }
    }

    // 3. In-Memory Fallback
    const memUser = {
      ...userData,
      _id: new mongoose.Types.ObjectId(),
      email: normalized,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryUsers.set(normalized, memUser);
    return wrapUserWithMethods(memUser);
  },

  async updateById(id: string, updates: any): Promise<any> {
    // 1. Supabase PostgreSQL Provider
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const row = mapUserToSupabase(updates);
          const { data, error } = await client
            .from('users')
            .update(row)
            .eq('id', id)
            .select()
            .single();

          if (!error && data) {
            const mapped = wrapUserWithMethods(mapSupabaseToUser(data));
            if (mapped.email) memoryUsers.set(mapped.email, mapped);
            return mapped;
          }
        }
      } catch (err: any) {
        console.warn('[UserService] Supabase updateById fallback:', err?.message);
      }
    }

    // 2. MongoDB Provider
    if (mongoose.connection.readyState === 1) {
      try {
        if (mongoose.isValidObjectId(id)) {
          const user = await User.findByIdAndUpdate(id, { $set: updates }, { returnDocument: 'after', runValidators: true });
          if (user) {
            memoryUsers.set(user.email, user.toObject ? user.toObject() : user);
            return user;
          }
        }
      } catch (err) {
        // Fallback
      }
    }

    // 3. In-Memory Fallback
    for (const [email, u] of memoryUsers.entries()) {
      if (u._id?.toString() === id || u.id === id) {
        const updated = { ...u, ...updates, updatedAt: new Date() };
        memoryUsers.set(email, updated);
        return wrapUserWithMethods(updated);
      }
    }
    return null;
  },

  async count(): Promise<number> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { count, error } = await client
            .from('users')
            .select('*', { count: 'exact', head: true });
          if (!error && count !== null) return count;
        }
      } catch {}
    }

    if (mongoose.connection.readyState === 1) {
      try {
        return await User.countDocuments();
      } catch {}
    }
    return memoryUsers.size;
  },

  async findAll(): Promise<any[]> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && data) {
            return data.map((r) => wrapUserWithMethods(mapSupabaseToUser(r)).toSafeJSON());
          }
        }
      } catch (err: any) {
        console.warn('[UserService] Supabase findAll fallback:', err?.message);
      }
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const users = await User.find({}).sort({ createdAt: -1 });
        return users.map((u) => (u.toSafeJSON ? u.toSafeJSON() : u));
      } catch (err) {
        // Fallback
      }
    }

    const list: any[] = [];
    for (const u of memoryUsers.values()) {
      list.push(wrapUserWithMethods(u).toSafeJSON());
    }
    return list;
  },
};
