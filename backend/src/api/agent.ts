/**
 * Agent Routes
 * POST /api/v1/agent/register, GET /api/v1/agent/list, GET /api/v1/agent/:agentId, POST /api/v1/agent/update
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import prisma from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// =============== Validation Schemas ===============

const RegisterAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  endpoint: z.string().url().optional(),
  capabilities: z.array(z.string()).optional(),
  contractAgentId: z.string().optional(),
  txHash: z.string().optional(),
});

const UpdateAgentSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  endpoint: z.string().url().optional().or(z.literal('')),
  capabilities: z.array(z.string()).optional(),
});

// =============== Routes ===============

/**
 * POST /api/v1/agent/register
 * Register a new agent
 */
router.post('/register', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = RegisterAgentSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    // Generate agent ID
    const agentId = validated.contractAgentId || `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create agent in database
    const agent = await prisma.agent.create({
      data: {
        agentId,
        ownerId: userId,
        name: validated.name,
        description: validated.description,
        endpoint: validated.endpoint,
        capabilities: validated.capabilities || [],
        txHash: validated.txHash,
        active: true,
      },
    });

    logger.info('Agent registered', {
      agentId: agent.agentId,
      ownerId: userId,
      name: agent.name,
    });

    res.status(201).json({
      code: 0,
      data: {
        agentId: agent.agentId,
        name: agent.name,
        description: agent.description,
        endpoint: agent.endpoint,
        capabilities: agent.capabilities,
        reputation: agent.reputation,
        active: agent.active,
        registeredAt: agent.registeredAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/agent/list
 * List all agents
 */
router.get('/list', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const agents = await prisma.agent.findMany({
      where: { active: true },
      orderBy: { registeredAt: 'desc' },
      include: { owner: { select: { id: true, username: true } } },
    });

    res.json({
      code: 0,
      data: {
        agents: agents.map(a => ({
          agentId: a.agentId,
          name: a.name,
          description: a.description,
          endpoint: a.endpoint,
          capabilities: a.capabilities,
          reputation: a.reputation,
          owner: a.owner.username,
          registeredAt: a.registeredAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/agent/:agentId
 * Get agent details
 */
router.get('/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { agentId },
      include: { owner: { select: { id: true, username: true } } },
    });

    if (!agent) {
      res.status(404).json({ code: 1004, message: 'Agent not found' });
      return;
    }

    res.json({
      code: 0,
      data: {
        agentId: agent.agentId,
        name: agent.name,
        description: agent.description,
        endpoint: agent.endpoint,
        capabilities: agent.capabilities,
        reputation: agent.reputation,
        stakeAmount: agent.stakeAmount,
        owner: agent.owner.username,
        registeredAt: agent.registeredAt,
        updatedAt: agent.updatedAt,
        active: agent.active,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/agent/update
 * Update agent information
 */
router.post('/update', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = UpdateAgentSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    // Check if agent exists and user is owner
    const existing = await prisma.agent.findUnique({
      where: { agentId: validated.agentId },
    });

    if (!existing) {
      res.status(404).json({ code: 1004, message: 'Agent not found' });
      return;
    }

    if (existing.ownerId !== userId) {
      res.status(403).json({ code: 1003, message: 'Not authorized to update this agent' });
      return;
    }

    // Update agent
    const updateData: any = {};
    if (validated.name) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.endpoint !== undefined) updateData.endpoint = validated.endpoint;
    if (validated.capabilities) updateData.capabilities = validated.capabilities;

    const agent = await prisma.agent.update({
      where: { agentId: validated.agentId },
      data: updateData,
    });

    logger.info('Agent updated', { agentId: agent.agentId, userId });

    res.json({
      code: 0,
      data: {
        agentId: agent.agentId,
        name: agent.name,
        description: agent.description,
        endpoint: agent.endpoint,
        capabilities: agent.capabilities,
        updatedAt: agent.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
