import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { getDatabaseStatus, isDbConnected } from '../config/database';
import { InterviewSession, SessionService } from '../models/InterviewSession';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

/**
 * 1. Health-Check: Returns database connectivity status, latency ping, and active host
 * GET /api/db/health (Public)
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const status = await getDatabaseStatus();
    let collections: string[] = [];

    if (status.isConnected && mongoose.connection.db) {
      try {
        const cols = await mongoose.connection.db.listCollections().toArray();
        collections = cols.map((c) => c.name);
      } catch {
        // Non-fatal if listCollections fails
      }
    }

    res.json({
      success: true,
      service: 'smart-ai-interview-database',
      timestamp: new Date().toISOString(),
      database: {
        ...status,
        collections,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database health',
      message: error?.message,
    });
  }
});

/**
 * 2. CREATE: Add a new interview session / record
 * POST /api/db/sessions (Protected)
 * Associates session with authenticated user ID and email. Never trusts client-supplied userId.
 */
router.post('/sessions', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected. Please verify MongoDB connection string in .env',
      });
    }

    const {
      candidateName,
      course,
      specialization,
      targetRole,
      difficulty,
      interviewType,
      language,
      status,
      overallScore,
      behaviorScore,
      readinessLevel,
      placementProbability,
      feedbackSummary,
      strengths,
      improvements,
      rubricScores,
      questions,
      notes,
    } = req.body;

    if (!course || !targetRole) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error: course and targetRole are required fields.',
      });
    }

    // Authenticated user ID & email extracted directly from verified JWT
    const authenticatedUserId = req.user?.userId;
    const authenticatedEmail = req.user?.email;
    const effectiveName = candidateName || req.user?.name || 'Candidate';

    const sessionPayload = {
      userId: authenticatedUserId ? new mongoose.Types.ObjectId(authenticatedUserId) : undefined,
      candidateName: effectiveName,
      candidateEmail: authenticatedEmail,
      course,
      specialization,
      targetRole,
      difficulty: difficulty || 'Medium',
      interviewType: interviewType || 'Technical',
      language: language || 'English',
      status: status || 'completed',
      overallScore: overallScore ?? 0,
      behaviorScore: behaviorScore ?? 80,
      readinessLevel: readinessLevel || 'Needs Practice',
      placementProbability: placementProbability || 'Medium',
      feedbackSummary: feedbackSummary || '',
      strengths: strengths || [],
      improvements: improvements || [],
      rubricScores: rubricScores || {},
      questions: questions || [],
      notes: notes || '',
    };

    const savedSession = await SessionService.create(sessionPayload);

    res.status(201).json({
      success: true,
      message: 'Interview session record created successfully in MongoDB',
      data: savedSession,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Error creating interview session',
      message: error?.message,
    });
  }
});

/**
 * 3. READ ALL: Fetch interview sessions
 * GET /api/db/sessions (Protected)
 * Regular users ONLY see their own records. Admin users can access all records.
 */
router.get('/sessions', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected. Please verify MongoDB connection string in .env',
      });
    }

    const {
      course,
      targetRole,
      difficulty,
      search,
      page = '1',
      limit = '10',
    } = req.query;

    const filter: Record<string, any> = {};

    // Strict user isolation: Regular users can NEVER access another user's sessions
    if (!req.user?.isAdmin) {
      const userConditions: any[] = [];
      if (req.user?.userId && mongoose.Types.ObjectId.isValid(req.user.userId)) {
        userConditions.push({ userId: new mongoose.Types.ObjectId(req.user.userId) });
      }
      if (req.user?.email) {
        userConditions.push({ candidateEmail: req.user.email.toLowerCase() });
      }

      if (userConditions.length > 0) {
        filter.$or = userConditions;
      }
    }

    if (course) filter.course = course;
    if (targetRole) filter.targetRole = targetRole;
    if (difficulty) filter.difficulty = difficulty;

    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNumber - 1) * pageSize;

    const { total, data: sessions } = await SessionService.find(filter, skip, pageSize);

    res.json({
      success: true,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
      data: sessions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Error fetching interview sessions',
      message: error?.message,
    });
  }
});

/**
 * Helper to verify interview session ownership or admin privilege
 */
function isSessionAuthorized(session: any, user: any): boolean {
  if (user.isAdmin) return true;
  if (session.userId && user.userId && session.userId.toString() === user.userId) return true;
  if (session.candidateEmail && user.email && session.candidateEmail.toLowerCase() === user.email.toLowerCase()) return true;
  return false;
}

/**
 * 4. READ ONE: Retrieve single session by MongoDB ID
 * GET /api/db/sessions/:id (Protected)
 */
router.get('/sessions/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await SessionService.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: `Interview session with ID "${id}" not found`,
      });
    }

    // Verify ownership: User A cannot read User B's report
    if (!isSessionAuthorized(session, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to access another user\'s interview report.',
      });
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Error retrieving session',
      message: error?.message,
    });
  }
});

/**
 * 5. UPDATE: Update session by ID
 * PUT /api/db/sessions/:id (Protected)
 */
router.put('/sessions/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await SessionService.findById(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: `Interview session with ID "${id}" not found`,
      });
    }

    if (!isSessionAuthorized(session, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to modify this interview session.',
      });
    }

    // Prevent changing ownership
    delete req.body.userId;
    delete req.body.candidateEmail;

    const updatedSession = await SessionService.findByIdAndUpdate(id, req.body);

    res.json({
      success: true,
      message: 'Interview session updated successfully',
      data: updatedSession,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Error updating session',
      message: error?.message,
    });
  }
});

/**
 * 6. DELETE: Remove session by ID
 * DELETE /api/db/sessions/:id (Protected)
 */
router.delete('/sessions/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await SessionService.findById(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: `Interview session with ID "${id}" not found`,
      });
    }

    if (!isSessionAuthorized(session, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to delete this interview session.',
      });
    }

    await SessionService.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `Interview session with ID "${id}" deleted successfully`,
      deletedId: id,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Error deleting session',
      message: error?.message,
    });
  }
});

/**
 * 7. SEED SAMPLE: Helper to quickly generate a sample record for verification
 * POST /api/db/seed-sample (Protected)
 */
router.post('/seed-sample', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected. Please verify MongoDB connection string in .env',
      });
    }

    const sample = await SessionService.create({
      userId: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
      candidateName: req.user?.name || 'Test Candidate',
      candidateEmail: req.user?.email || 'candidate@example.com',
      course: 'B.Tech',
      specialization: 'Computer Science',
      targetRole: 'Full Stack Engineer',
      difficulty: 'Medium',
      interviewType: 'Technical',
      language: 'English',
      status: 'completed',
      overallScore: 84,
      readinessLevel: 'Interview Ready',
      placementProbability: 'High',
      feedbackSummary: 'Strong conceptual clarity on database indexing and async architecture.',
      strengths: ['Clean code structure', 'Accurate DB terminology', 'STAR response format'],
      improvements: ['Deepen knowledge of distributed transactions', 'Review cache invalidation strategies'],
      rubricScores: {
        technicalAccuracy: 88,
        structuralDelivery: 82,
        completenessAndDepth: 80,
        relevanceAndPrecision: 85,
        communicationFluency: 84,
        confidenceAndConviction: 82,
        problemSolvingMethod: 86,
        disciplineSynthesis: 85,
      },
      questions: [
        {
          question: 'Explain the difference between SQL and NoSQL indexing techniques.',
          category: 'Database Architecture',
          difficulty: 'Medium',
          userAnswer: 'SQL engines typically use B-Trees for balanced lookups, while MongoDB uses B-Tree indexes and compound indexes for document keys.',
          score: 85,
          feedback: 'Accurate distinction with good technical terms.',
        },
      ],
      notes: 'Initial test document automatically seeded for verification.',
    });

    res.status(201).json({
      success: true,
      message: 'Sample test document created successfully in MongoDB',
      data: sample,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to seed sample record',
      message: error?.message,
    });
  }
});

export default router;
