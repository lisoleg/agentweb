/**
 * DID Routes
 * POST /api/v1/did/create, GET /api/v1/did/resolve/:did, etc.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { createDID, resolveDID, updateDID, verifyDIDOwnership } from '../services/didService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// =============== Validation Schemas ===============
const CreateDIDSchema = z.object({
  userId: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

const UpdateDIDSchema = z.object({
  did: z.string().startsWith('did:'),
  document: z.record(z.any()),
});

// =============== Routes ===============

/**
 * POST /api/v1/did/create
 * Create a new DID
 */
router.post('/create', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreateDIDSchema.parse(req.body);

    const result = await createDID(validated);

    res.status(201).json({
      code: 0,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/did/resolve/:did
 * Resolve a DID to its DID Document
 */
router.get('/resolve/:did', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { did } = req.params;

    if (!did) {
      res.status(400).json({ code: 1001, message: 'DID parameter is required' });
      return;
    }

    const result = await resolveDID(did);

    res.json({
      code: 0,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/did/update
 * Update a DID Document
 */
router.post('/update', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = UpdateDIDSchema.parse(req.body);

    const result = await updateDID(validated.did, validated.document);

    res.json({
      code: 0,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/did/verify/:did
 * Verify DID ownership
 */
router.get('/verify/:did', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { did } = req.params;
    const { challenge, signature } = req.query;

    if (!did) {
      res.status(400).json({ code: 1001, message: 'DID parameter is required' });
      return;
    }

    const isValid = await verifyDIDOwnership(
      did,
      challenge as string,
      signature as string
    );

    res.json({
      code: 0,
      data: { valid: isValid },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/did/my
 * Get current user's DID
 */
router.get('/my', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    // TODO: Implement get user's DID
    res.json({
      code: 0,
      data: { message: 'Not implemented yet' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
