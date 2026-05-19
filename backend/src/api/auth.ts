/**
 * Authentication Routes
 * POST /api/v1/auth/register, /login, /logout, /profile
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { register, login, logout, getProfile } from '../services/authService';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

// =============== Validation Schemas ===============
const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().optional(),
  did: z.string().optional(),
});

// =============== Routes ===============

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const validated = RegisterSchema.parse(req.body);

    // Register user
    const result = await register(validated);

    logger.info('User registered', { username: validated.username });

    res.status(201).json({
      code: 0,
      message: 'Registration successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const validated = LoginSchema.parse(req.body);

    // Login user
    const result = await login(validated);

    logger.info('User logged in', { username: validated.username });

    res.json({
      code: 0,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout user
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    await logout(userId);

    res.json({
      code: 0,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/profile
 * Get current user profile
 */
router.get('/profile', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    const profile = await getProfile(userId);

    res.json({
      code: 0,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
