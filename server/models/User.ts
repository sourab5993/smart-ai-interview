import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
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
      required: [true, 'Password hash is required'],
      select: false, // Do not return by default in queries
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
      default: ['JavaScript', 'TypeScript', 'React.js', 'Node.js', 'MongoDB', 'REST APIs', 'Data Structures & Algorithms'],
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

// In-Memory fallback store if MongoDB cluster is unreachable (e.g. offline or IP whitelist)
const memoryUsers = new Map<string, any>();

function wrapUserWithMethods(userData: any): any {
  if (!userData) return null;
  const user = { ...userData };
  user._id = user._id || new mongoose.Types.ObjectId();
  user.id = user._id.toString();
  user.comparePassword = async (candidatePassword: string) => {
    if (!user.passwordHash) return false;
    return bcrypt.compare(candidatePassword, user.passwordHash);
  };
  user.toSafeJSON = () => {
    const copy = { ...user };
    delete copy.passwordHash;
    delete copy.__v;
    return copy;
  };
  return user;
}

export const UserService = {
  async findByEmail(email: string): Promise<any> {
    const normalized = email.trim().toLowerCase();
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
      try {
        const user = await User.findOne({ email: normalized }).select('+passwordHash');
        if (user) return user;
      } catch (err) {
        // Fallback to memory store if query fails
      }
    }
    const memUser = memoryUsers.get(normalized);
    return memUser ? wrapUserWithMethods(memUser) : null;
  },

  async findById(id: string): Promise<any> {
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
    for (const u of memoryUsers.values()) {
      if (u._id?.toString() === id || u.id === id) {
        return wrapUserWithMethods(u);
      }
    }
    return null;
  },

  async create(userData: any): Promise<any> {
    const normalized = userData.email.trim().toLowerCase();
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
    if (mongoose.connection.readyState === 1) {
      try {
        const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
        if (user) {
          memoryUsers.set(user.email, user.toObject ? user.toObject() : user);
          return user;
        }
      } catch (err) {
        // Fallback
      }
    }

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
    if (mongoose.connection.readyState === 1) {
      try {
        return await User.countDocuments();
      } catch {
        // Fallback
      }
    }
    return memoryUsers.size;
  },

  async findAll(): Promise<any[]> {
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
