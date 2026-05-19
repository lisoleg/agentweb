/**
 * Verifiable Credential (VC) Routes
 * POST /api/v1/vc/issue, POST /api/v1/vc/verify, GET /api/v1/vc/list/:did
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { issueVC, verifyVC, listVCs, revokeVC } from '../services/vcService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// =============== Validation Schemas ===============
const IssueVCSchema = z.object({
  issuer: z.string().startsWith('did:'),
  subject: z.object({
    id: z.string().optional(),
    claims: z.record(z.any()).optional(),
  }),
  type: z.array(z.string()).optional(),
  expirationDate: z.string().optional(),
});

const VerifyVCSchema = z.object({
  vc: z.object({
    '@context': z.array(z.string()),
    type: z.array(z.string()),
    issuer: z.string(),
    credentialSubject: z.object({}).passthrough(),
  }).passthrough(),
});

// =============== Routes ===============

/**
 * POST /api/v1/vc/issue
 * Issue a new Verifiable Credential
 */
router.post('/issue', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = IssueVCSchema.parse(req.body);

    const result = await issueVC({
      issuer: validated.issuer,
      subject: validated.subject,
      type: validated.type,
      expirationDate: validated.expirationDate,
    });

    res.status(201).json({
      code: 0,
      data: { vc: result },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/vc/verify
 * Verify a Verifiable Credential
 */
router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = VerifyVCSchema.parse(req.body);

    const result = await verifyVC({ vc: validated.vc as any });

    res.json({
      code: 0,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/vc/list/:did
 * List VCs for a DID (as subject)
 */
router.get('/list/:did', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { did } = req.params;

    if (!did) {
      res.status(400).json({ code: 1001, message: 'DID parameter is required' });
      return;
    }

    const vcs = await listVCs(did);

    res.json({
      code: 0,
      data: { vcs },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/vc/revoke/:vcId
 * Revoke a VC
 */
router.post('/revoke/:vcId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vcId } = req.params;

    if (!vcId) {
      res.status(400).json({ code: 1001, message: 'VC ID parameter is required' });
      return;
    }

    await revokeVC(vcId);

    res.json({
      code: 0,
      message: 'VC revoked successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
