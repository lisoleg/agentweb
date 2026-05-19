/**
 * Governance Routes
 * POST /api/v1/governance/propose, POST /api/v1/governance/vote, GET /api/v1/governance/list
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import prisma from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// =============== Validation Schemas ===============

const ProposeSchema = z.object({
  description: z.string().min(1).max(1000),
  calldata: z.string().optional(),
  deadlineDays: z.number().min(1).max(30).default(7),
});

const VoteSchema = z.object({
  proposalId: z.string().min(1),
  support: z.boolean(),
});

// =============== Routes ===============

/**
 * POST /api/v1/governance/propose
 * Create a new governance proposal
 */
router.post('/propose', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = ProposeSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    // Generate proposal ID (will be from blockchain in production)
    const proposalId = `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate deadline
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + validated.deadlineDays);

    const proposal = await prisma.proposal.create({
      data: {
        proposalId,
        creatorId: userId,
        description: validated.description,
        calldata: validated.calldata,
        status: 'Active',
        deadline,
      },
    });

    logger.info('Proposal created', {
      proposalId: proposal.proposalId,
      creatorId: userId,
    });

    res.status(201).json({
      code: 0,
      data: {
        proposalId: proposal.proposalId,
        id: proposal.id,
        status: proposal.status,
        deadline: proposal.deadline,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/governance/vote
 * Vote on a proposal
 */
router.post('/vote', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = VoteSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    // Check if proposal exists and is active
    const proposal = await prisma.proposal.findUnique({
      where: { proposalId: validated.proposalId },
    });

    if (!proposal) {
      res.status(404).json({ code: 1004, message: 'Proposal not found' });
      return;
    }

    if (proposal.status !== 'Active') {
      res.status(400).json({ code: 1001, message: 'Proposal is not active' });
      return;
    }

    if (proposal.deadline < new Date()) {
      // Update status to end
      await prisma.proposal.update({
        where: { proposalId: validated.proposalId },
        data: { status: 'Failed' },
      });
      res.status(400).json({ code: 1001, message: 'Voting deadline passed' });
      return;
    }

    // Check if user already voted
    const existingVote = await prisma.vote.findUnique({
      where: {
        proposalId_voterId: {
          proposalId: proposal.id,
          voterId: userId,
        },
      },
    });

    if (existingVote) {
      res.status(400).json({ code: 1001, message: 'User already voted on this proposal' });
      return;
    }

    // Get voter's voting weight (based on stake and Φ)
    // TODO: Query PhiStaking contract for actual weight
    const votingWeight = 1.0;

    // Create vote
    await prisma.vote.create({
      data: {
        proposalId: proposal.id,
        voterId: userId,
        support: validated.support,
        weight: votingWeight,
      },
    });

    logger.info('Vote cast', {
      proposalId: validated.proposalId,
      voterId: userId,
      support: validated.support,
    });

    res.json({
      code: 0,
      message: 'Vote cast successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/governance/list
 * List all proposals
 */
router.get('/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const proposals = await prisma.proposal.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, username: true } },
        _count: { select: { votes: true } },
        votes: {
          select: { support: true, weight: true },
        },
      },
    });

    const result = proposals.map(p => {
      const forVotes = p.votes.filter(v => v.support).reduce((sum, v) => sum + v.weight, 0);
      const againstVotes = p.votes.filter(v => !v.support).reduce((sum, v) => sum + v.weight, 0);

      return {
        proposalId: p.proposalId,
        id: p.id,
        description: p.description,
        creator: p.creator.username,
        status: p.status,
        forVotes,
        againstVotes,
        totalVotes: p._count.votes,
        createdAt: p.createdAt,
        deadline: p.deadline,
        executed: p.executed,
      };
    });

    res.json({
      code: 0,
      data: {
        proposals: result,
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/governance/:proposalId
 * Get proposal details
 */
router.get('/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { proposalId } = req.params;

    const proposal = await prisma.proposal.findUnique({
      where: { proposalId },
      include: {
        creator: { select: { id: true, username: true } },
        votes: {
          include: { voter: { select: { username: true } } },
        },
      },
    });

    if (!proposal) {
      res.status(404).json({ code: 1004, message: 'Proposal not found' });
      return;
    }

    const forVotes = proposal.votes.filter(v => v.support).reduce((sum, v) => sum + v.weight, 0);
    const againstVotes = proposal.votes.filter(v => !v.support).reduce((sum, v) => sum + v.weight, 0);

    res.json({
      code: 0,
      data: {
        proposalId: proposal.proposalId,
        id: proposal.id,
        description: proposal.description,
        calldata: proposal.calldata,
        creator: proposal.creator.username,
        status: proposal.status,
        forVotes,
        againstVotes,
        votes: proposal.votes.map(v => ({
          voter: v.voter.username,
          support: v.support,
          weight: v.weight,
          timestamp: v.timestamp,
        })),
        createdAt: proposal.createdAt,
        deadline: proposal.deadline,
        executed: proposal.executed,
        txHash: proposal.txHash,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
