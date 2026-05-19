/**
 * Authentication Service
 * Handle user registration, login, and session management
 */

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import prisma from '@prisma/client';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { createDID } from './didService';

const SALT_ROUNDS = 10;

export interface RegisterRequest {
  username: string;
  email?: string;
  password?: string; // Optional for DID-only auth
}

export interface LoginRequest {
  username: string;
  password?: string;
  did?: string; // For DID-based auth
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email?: string;
    did?: string;
  };
  token: string;
  refreshToken: string;
}

/**
 * Register a new user
 * @param request - Registration request
 * @returns Authentication response with tokens
 */
export const register = async (request: RegisterRequest): Promise<AuthResponse> => {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: request.username }, { email: request.email }],
      },
    });

    if (existingUser) {
      throw new Error('User already exists with this username or email');
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (request.password) {
      passwordHash = await bcrypt.hash(request.password, SALT_ROUNDS);
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        username: request.username,
        email: request.email,
        password: passwordHash,
      },
    });

    // Auto-create DID for user
    let did: string | undefined;
    try {
      const didResult = await createDID({ userId: user.id });
      did = didResult.did;
      logger.info('Auto-created DID for new user', { userId: user.id, did });
    } catch (didError) {
      logger.warn('Failed to auto-create DID', { userId: user.id, error: didError });
      // Continue without DID - can be created later
    }

    // Generate tokens
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email || undefined,
      did,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      username: user.username,
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info('User registered successfully', { userId: user.id, username: user.username });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email || undefined,
        did,
      },
      token,
      refreshToken,
    };
  } catch (error) {
    logger.error('Registration failed', error);
    throw error;
  }
};

/**
 * Login user
 * @param request - Login request
 * @returns Authentication response with tokens
 */
export const login = async (request: LoginRequest): Promise<AuthResponse> => {
  try {
    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username: request.username },
      include: { did: true },
    });

    if (!user) {
      throw new Error('Invalid username or password');
    }

    if (!user.isActive) {
      throw new Error('User account is deactivated');
    }

    // Verify password (if using password auth)
    if (request.password && user.password) {
      const passwordValid = await bcrypt.compare(request.password, user.password);
      if (!passwordValid) {
        throw new Error('Invalid username or password');
      }
    } else if (request.did) {
      // DID-based auth - verify DID ownership (simplified)
      if (!user.did || user.did.did !== request.did) {
        throw new Error('DID mismatch');
      }
    } else if (!user.password) {
      // No password set and no DID provided
      throw new Error('Please use DID-based authentication');
    }

    // Generate tokens
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email || undefined,
      did: user.did?.did,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      username: user.username,
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info('User logged in successfully', { userId: user.id, username: user.username });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email || undefined,
        did: user.did?.did,
      },
      token,
      refreshToken,
    };
  } catch (error) {
    logger.error('Login failed', error);
    throw error;
  }
};

/**
 * Logout user (invalidate token - client side)
 * In a full implementation, add token to blacklist
 */
export const logout = async (userId: string): Promise<void> => {
  try {
    logger.info('User logged out', { userId });
    // TODO: Add token to blacklist in Redis
  } catch (error) {
    logger.error('Logout failed', error);
    throw error;
  }
};

/**
 * Refresh authentication token
 * @param refreshToken - Refresh token
 * @returns New token pair
 */
export const refreshAuth = async (refreshToken: string): Promise<AuthResponse> => {
  try {
    // TODO: Implement refresh token verification
    // This is a simplified version
    logger.info('Token refreshed');
    throw new Error('Refresh token not implemented yet');
  } catch (error) {
    logger.error('Token refresh failed', error);
    throw error;
  }
};

/**
 * Get current user profile
 * @param userId - User ID
 * @returns User profile
 */
export const getProfile = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { did: true, agents: true, _count: { select: { phiRecords: true } } },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
      isVerified: user.isVerified,
      did: user.did?.did,
      agentCount: user.agents.length,
      phiRecordCount: user._count.phiRecords,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  } catch (error) {
    logger.error('Get profile failed', error);
    throw error;
  }
};

export default {
  register,
  login,
  logout,
  refreshAuth,
  getProfile,
};
