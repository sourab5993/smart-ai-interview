import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedUserPayload {
  userId: string;
  email: string;
  role: string;
  isAdmin: boolean;
  name?: string;
}

// Extend express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserPayload;
    }
  }
}

export const JWT_SECRET =
  process.env.JWT_SECRET || 'super_secret_jwt_key_smart_ai_interview_prep_2026_production_safe';

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Middleware to verify JWT token and extract authenticated user context.
 * Rejects unauthenticated requests with 401 Unauthorized.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || (req.headers['x-auth-token'] as string);

  let token: string | undefined;

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUserPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    const isExpired = err?.name === 'TokenExpiredError';
    res.status(401).json({
      success: false,
      message: isExpired
        ? 'Authentication session has expired. Please sign in again.'
        : 'Invalid authentication token.',
    });
    return;
  }
}

/**
 * Middleware ensuring the authenticated user has Administrator privileges.
 * Rejects unauthorized users with 403 Forbidden.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required before verifying administrative rights.',
    });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({
      success: false,
      message: 'Access forbidden: Administrative access privileges required.',
    });
    return;
  }

  next();
}

/**
 * Optional authentication middleware.
 * Attaches user context if valid token is provided, otherwise proceeds cleanly.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUserPayload;
    req.user = decoded;
  } catch {
    // Ignore error for optional auth
  }
  next();
}
