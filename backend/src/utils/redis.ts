/**
 * Redis client utility
 * Provides Redis connection and common cache operations
 */

import Redis from 'ioredis';
import logger from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const isProduction = process.env.NODE_ENV === 'production';

// Create Redis client
const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    logger.error('Redis reconnect on error', err);
    return true;
  },
});

// Handle Redis events
redisClient.on('connect', () => {
  logger.info('Redis connected successfully');
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error', err);
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('close', () => {
  logger.warn('Redis connection closed');
});

// Cache helper functions
export const cache = {
  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Parsed value or null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}`, error);
      return null;
    }
  },

  /**
   * Set value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redisClient.setex(key, ttl, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}`, error);
    }
  },

  /**
   * Delete value from cache
   * @param key - Cache key or pattern
   */
  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}`, error);
    }
  },

  /**
   * Delete keys by pattern
   * @param pattern - Key pattern (e.g., "user:*")
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (error) {
      logger.error(`Cache delete pattern error for pattern ${pattern}`, error);
    }
  },

  /**
   * Check if key exists
   * @param key - Cache key
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}`, error);
      return false;
    }
  },

  /**
   * Set key expiration
   * @param key - Cache key
   * @param ttl - Time to live in seconds
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      await redisClient.expire(key, ttl);
    } catch (error) {
      logger.error(`Cache expire error for key ${key}`, error);
    }
  },
};

// Session helper functions
export const session = {
  /**
   * Store session data
   * @param sessionId - Session ID
   * @param data - Session data
   * @param ttl - Time to live in seconds (default 7 days)
   */
  async set(sessionId: string, data: any, ttl: number = 7 * 24 * 3600): Promise<void> {
    await cache.set(`session:${sessionId}`, data, ttl);
  },

  /**
   * Get session data
   * @param sessionId - Session ID
   */
  async get<T>(sessionId: string): Promise<T | null> {
    return cache.get<T>(`session:${sessionId}`);
  },

  /**
   * Delete session
   * @param sessionId - Session ID
   */
  async del(sessionId: string): Promise<void> {
    await cache.del(`session:${sessionId}`);
  },
};

// Export Redis client for direct access if needed
export const redis = redisClient;
export default redisClient;
