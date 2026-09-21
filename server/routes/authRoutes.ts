import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { User, IUser, UserService } from '../models/User';
import {
  authenticateToken,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  AuthenticatedUserPayload,
} from '../middleware/authMiddleware';

const router = Router();

// Rate limiting: Protect login & registration against brute-force attacks
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 authentication requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
    default: false,
  },
  message: {
    success: false,
    message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
  },
});

// Helper to generate standard JWT token
function generateToken(user: any): string {
  const payload: AuthenticatedUserPayload = {
    userId: (user._id ? user._id.toString() : user.id),
    email: user.email,
    role: user.role,
    isAdmin: Boolean(user.isAdmin),
    name: user.name,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });
}

// Strict email format validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 1. REGISTER NEW USER
 * POST /api/auth/register
 */
router.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      role = 'Candidate',
      degree,
      courseCategory,
      specialization,
      targetRole,
      skills,
    } = req.body;

    // A. Validation
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your email.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // B. Duplicate check in MongoDB / UserService
    const existingUser = await UserService.findByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // C. Bcrypt password hashing (Salt Rounds: 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // D. Safe user persistence
    const candidateName =
      name && typeof name === 'string' && name.trim()
        ? name.trim()
        : normalizedEmail.split('@')[0].replace('.', ' ');

    // Admin rights are strictly reserved for the authorized platform administrator
    const isAdmin = Boolean(normalizedEmail === 'sourabstar786@gmail.com');

    const savedUser = await UserService.create({
      name: candidateName,
      email: normalizedEmail,
      passwordHash,
      role: isAdmin ? 'Admin' : 'Candidate',
      isAdmin,
      degree: degree || 'B.Tech',
      courseCategory: courseCategory || 'Engineering & Technology',
      specialization: specialization || 'Computer Science & Engineering',
      targetRole: targetRole || 'Full Stack Developer',
      skills: Array.isArray(skills) && skills.length > 0 ? skills : undefined,
    });

    // E. JWT Generation
    const token = generateToken(savedUser);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: savedUser.toSafeJSON(),
    });
  } catch (error: any) {
    // Handle duplicate key error gracefully
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    console.error('[Auth Service] Registration error:', error?.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during registration. Please try again.',
      error: error?.message,
    });
  }
});

/**
 * 2. LOGIN FLOW
 * POST /api/auth/login
 * Strict server-side verification: Email Existence -> Bcrypt Password Compare -> JWT Generation
 */
router.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // A. Validation
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your email.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please enter your password.',
      });
    }

    // B. Search database for user by normalized email
    const user = await UserService.findByEmail(normalizedEmail);

    // Generic security message to prevent email enumeration
    const genericInvalidMsg = 'Invalid email or password';

    if (!user) {
      return res.status(401).json({
        success: false,
        message: genericInvalidMsg,
      });
    }

    // C. Password verification using bcrypt
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: genericInvalidMsg,
      });
    }

    // D. JWT Generation
    const token = generateToken(user);

    // E. Return authenticated user payload (never leak passwordHash)
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: user.toSafeJSON(),
    });
  } catch (error: any) {
    console.error('[Auth Service] Login error:', error?.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to connect to the authentication service. Please try again.',
      error: error?.message,
    });
  }
});

/**
 * 3. GET AUTHENTICATED USER DETAILS
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await UserService.findById(req.user?.userId || '');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Authenticated account not found in database.',
      });
    }

    return res.json({
      success: true,
      user: user.toSafeJSON(),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve authenticated profile.',
      error: error?.message,
    });
  }
});

/**
 * 4. UPDATE USER PROFILE
 * PUT /api/auth/profile
 */
router.put('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const allowedUpdates = [
      'name',
      'degree',
      'courseId',
      'courseName',
      'courseCategory',
      'specialization',
      'targetRole',
      'targetIndustry',
      'skills',
      'topSkills',
      'avatar',
      'college',
      'graduationYear',
      'experienceLevel',
    ];

    const updatePayload: Record<string, any> = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updatePayload[key] = req.body[key];
      }
    }

    const updatedUser = await UserService.updateById(req.user?.userId || '', updatePayload);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: updatedUser.toSafeJSON(),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile.',
      error: error?.message,
    });
  }
});

/**
 * 5. LOGOUT
 * POST /api/auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'Logged out successfully.',
  });
});

/**
 * 6. GET ALL USERS (Admin / Verification / Dashboard)
 * GET /api/auth/users
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await UserService.findAll();
    return res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve registered users.',
      error: error?.message,
    });
  }
});

/**
 * Automatic Seeding Utility: Ensures test candidate and admin accounts exist with bcrypt-hashed credentials
 */
export async function seedAuthUsers(): Promise<void> {
  try {
    // 1. Candidate Account
    const candidateEmail = 'candidate@evaluator.edu';
    const existingCandidate = await UserService.findByEmail(candidateEmail);
    if (!existingCandidate) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('CandidatePassword@123', salt);
      await UserService.create({
        name: 'Candidate User',
        email: candidateEmail,
        passwordHash,
        role: 'Candidate',
        isAdmin: false,
        degree: 'B.Tech',
        courseCategory: 'Engineering & Technology',
        specialization: 'Computer Science & Engineering',
        targetRole: 'Full Stack Developer',
        skills: ['React.js', 'Node.js', 'TypeScript', 'MongoDB', 'REST APIs', 'System Design'],
        readinessScore: 88,
      });
      console.log(`  [Auth Seeder] Seeded default candidate account: ${candidateEmail}`);
    }

    // 2. Sole Authorized Admin Account (sourabstar786@gmail.com / sourab2004)
    const adminEmail = 'sourabstar786@gmail.com';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('sourab2004', salt);

    const existingAdmin = await UserService.findByEmail(adminEmail);
    if (existingAdmin) {
      await UserService.updateById(existingAdmin._id || existingAdmin.id, {
        passwordHash,
        role: 'Admin',
        isAdmin: true,
        name: 'Sourab (Administrator)',
      });
      console.log(`  [Auth Seeder] Synchronized authorized admin: ${adminEmail}`);
    } else {
      await UserService.create({
        name: 'Sourab (Administrator)',
        email: adminEmail,
        passwordHash,
        role: 'Admin',
        isAdmin: true,
        degree: 'B.Tech',
        courseCategory: 'Administration & Governance',
        specialization: 'System Administration & Placement Evaluation',
        targetRole: 'Placement Director / Bar Raiser',
      });
      console.log(`  [Auth Seeder] Seeded authorized admin account: ${adminEmail}`);
    }

    // Demote any other accounts if they previously had admin rights
    const legacyAdmin = await UserService.findByEmail('admin@evaluator.edu');
    if (legacyAdmin && legacyAdmin.isAdmin) {
      await UserService.updateById(legacyAdmin._id || legacyAdmin.id, {
        role: 'Candidate',
        isAdmin: false,
      });
    }
  } catch (err: any) {
    console.warn(`  [Auth Seeder] Seed note: ${err?.message || err}`);
  }
}

export default router;
