/**
 * Authentication middleware
 * Verify JWT token and attach user to request
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';
import logger from '../utils/logger';
import prisma from '../utils/prisma';


// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        email?: string;
        did?: string;
      };
    }
  }
}

/**
 * Authentication middleware - verify JWT token
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from header
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        code: 3001,
        message: 'Authentication required. No token provided.',
      });
      return;
    }

    // Verify token
    const payload = verifyToken(token);

    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, email: true, isActive: true, did: true },
    });

    if (!user) {
      res.status(401).json({
        code: 3001,
        message: 'User no longer exists.',
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        code: 3002,
        message: 'User account is deactivated.',
      });
      return;
    }

    // Attach user to request
    req.user = {
      userId: user.id,
      username: user.username,
      email: user.email || undefined,
      did: user.did?.did || undefined,
    };

    logger.info(`Authenticated request: ${req.method} ${req.path}`, {
      userId: user.id,
      username: user.username,
    });

    next();
  } catch (error) {
    logger.warn('Authentication failed', error);

    if (error instanceof Error) {
      if (error.message === 'Token expired') {
        res.status(401).json({
          code: 3001,
          message: 'Token expired. Please login again.',
        });
        return;
      }
      if (error.message === 'Invalid token') {
        res.status(401).json({
          code: 3001,
          message: 'Invalid token.',
        });
        return;
      }
    }

    res.status(401).json({
      code: 3001,
      message: 'Authentication failed.',
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if no token
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, username: true, email: true, isActive: true, did: true },
      });

      if (user && user.isActive) {
        req.user = {
          userId: user.id,
          username: user.username,
          email: user.email || undefined,
          did: user.did?.did || undefined,
        };
      }
    }

    next();
  } catch (error) {
    // Ignore errors - just continue without user
    logger.debug('Optional auth failed, continuing without user', error);
    next();
  }
};

export default authMiddleware;
