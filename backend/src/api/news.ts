/**
 * News Feed Routes
 * GET /api/v1/news/feed, POST /api/v1/news/publish, POST /api/v1/news/interact
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import prisma from '../utils/prisma';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

// =============== Validation Schemas ===============

const PublishNewsSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  contentHash: z.string().optional(),
  bsvTxId: z.string().optional(),
  phiValue: z.number().min(0).max(1).optional(),
  metadata: z.record(z.any()).optional(),
});

const InteractNewsSchema = z.object({
  contentId: z.string().min(1),
  type: z.enum(['like', 'unlike', 'comment']),
  data: z.record(z.any()).optional(),
});

// =============== Routes ===============

/**
 * GET /api/v1/news/feed
 * Get news feed (sovereign content stream)
 */
router.get('/feed', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const contents = await prisma.content.findMany({
      take: limit,
      skip: offset,
      orderBy: { publishedAt: 'desc' },
      include: {
        author: { select: { id: true, username: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    const result = contents.map(c => ({
      id: c.id,
      contentId: c.contentId,
      title: c.title,
      body: c.body,
      author: c.author.username,
      authorId: c.authorId,
      phiValue: c.phiValue,
      contentHash: c.contentHash,
      bsvTxId: c.bsvTxId,
      likes: c._count.likes,
      comments: c._count.comments,
      publishedAt: c.publishedAt,
      metadata: c.metadata,
    }));

    res.json({
      code: 0,
      data: {
        items: result,
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/news/publish
 * Publish new content
 */
router.post('/publish', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = PublishNewsSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    // Generate content ID (will be from blockchain in production)
    const contentId = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const content = await prisma.content.create({
      data: {
        contentId,
        authorId: userId,
        title: validated.title,
        body: validated.body,
        contentHash: validated.contentHash || '',
        bsvTxId: validated.bsvTxId || null,
        phiValue: validated.phiValue || 0,
        metadata: validated.metadata || {},
      },
    });

    logger.info('Content published', {
      contentId: content.contentId,
      authorId: userId,
      title: validated.title,
    });

    res.status(201).json({
      code: 0,
      data: {
        contentId: content.contentId,
        id: content.id,
        publishedAt: content.publishedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/news/interact
 * Interact with content (like, comment)
 */
router.post('/interact', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = InteractNewsSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    if (validated.type === 'like') {
      // Add like
      await prisma.like.create({
        data: {
          contentId: validated.contentId,
          userId,
        },
      });
    } else if (validated.type === 'unlike') {
      // Remove like
      await prisma.like.deleteMany({
        where: {
          contentId: validated.contentId,
          userId,
        },
      });
    } else if (validated.type === 'comment') {
      // Add comment
      const commentBody = validated.data?.body;
      if (!commentBody) {
        res.status(400).json({ code: 1001, message: 'Comment body required' });
        return;
      }

      await prisma.comment.create({
        data: {
          contentId: validated.contentId,
          authorId: userId,
          body: commentBody,
          parentId: validated.data?.parentId,
        },
      });
    }

    res.json({
      code: 0,
      message: 'Interaction successful',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/news/:contentId
 * Get single content with comments
 */
router.get('/:contentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentId } = req.params;

    const content = await prisma.content.findUnique({
      where: { contentId },
      include: {
        author: { select: { id: true, username: true } },
        likes: { include: { user: { select: { username: true } } } },
        comments: {
          where: { parentId: null },
          include: {
            author: { select: { username: true } },
            replies: { include: { author: { select: { username: true } } } },
          },
        },
      },
    });

    if (!content) {
      res.status(404).json({ code: 1004, message: 'Content not found' });
      return;
    }

    res.json({
      code: 0,
      data: {
        id: content.id,
        contentId: content.contentId,
        title: content.title,
        body: content.body,
        author: content.author.username,
        phiValue: content.phiValue,
        contentHash: content.contentHash,
        bsvTxId: content.bsvTxId,
        likes: content.likes.length,
        comments: content.comments,
        publishedAt: content.publishedAt,
        metadata: content.metadata,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
