/**
 * API Routes Aggregator
 * Central router for all /api/v1 routes
 */

import { Router } from 'express';
import authRoutes from './auth';
import didRoutes from './did';
import vcRoutes from './vc';
import phiRoutes from './phi';
import agentRoutes from './agent';
import newsRoutes from './news';
import governanceRoutes from './governance';

const router = Router();

// =============== API Info ===============
router.get('/', (_req, res) => {
  res.json({
    name: 'AgentWeb API',
    version: '1.0.0',
    description: 'AgentWeb Backend API - Next-generation digital society infrastructure',
    endpoints: {
      auth: '/api/v1/auth',
      did: '/api/v1/did',
      vc: '/api/v1/vc',
      phi: '/api/v1/phi',
      agent: '/api/v1/agent',
      news: '/api/v1/news',
      governance: '/api/v1/governance',
    },
    documentation: process.env.ENABLE_SWAGGER === 'true' ? '/api-docs' : undefined,
  });
});

// =============== Mount Routes ===============
router.use('/auth', authRoutes);
router.use('/did', didRoutes);
router.use('/vc', vcRoutes);
router.use('/phi', phiRoutes);
router.use('/agent', agentRoutes);
router.use('/news', newsRoutes);
router.use('/governance', governanceRoutes);

export default router;
