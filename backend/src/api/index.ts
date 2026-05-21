/**
 * API Routes Aggregator
 * Central router for all /api/v1 routes
 */

import { Router } from 'express';
import { phiGatewayMiddleware } from '../middleware/phiGateway';
import authRoutes from './auth';
import didRoutes from './did';
import vcRoutes from './vc';
import phiRoutes from './phi';
import agentRoutes from './agent';
import newsRoutes from './news';
import governanceRoutes from './governance';
import fediverseRoutes from './fediverse';  // 新增：Fediverse (ActivityPub) 路由
import avatarRoutes from './avatar';  // 新增：Avatar Fusion (化身合体) 路由
import { hottTypeChecker } from '../services/hottTypeChecker';
import { dualTrackRouter } from '../services/dualTrackRouter';  // 新增：Dual-Track 双轨桥接器

const router = Router();

// Φ-Gateway 中间件（语义网关）
router.use(phiGatewayMiddleware);

// =============== API Info ===============
router.get('/', (_req, res) => {
  res.json({
    name: 'AgentWeb API',
    version: '2.0.0',  // 升级到 V2.0
    description: 'AgentWeb 西格玛云 - Next-generation digital society infrastructure (Fediverse + Four-Token + IGCTR)',
    endpoints: {
      auth: '/api/v1/auth',
      did: '/api/v1/did',
      vc: '/api/v1/vc',
      phi: '/api/v1/phi',
      agent: '/api/v1/agent',
      news: '/api/v1/news',
      governance: '/api/v1/governance',
      fediverse: '/api/v1/fediverse',  // 新增：Fediverse (ActivityPub)
      avatar: '/api/v1/avatar',  // 新增：Avatar Fusion (化身合体)
      dualtrack: '/api/v1/dualtrack',  // 新增：Dual-Track 双轨桥接器
      hott: '/api/v1/hott'
    },
    documentation: process.env.ENABLE_SWAGGER === 'true' ? '/api-docs' : undefined,
    versionNotes: 'V2.0: Added Fediverse (ActivityPub), Four-Token System, IGCTR unified field theory, Avatar Fusion'
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
router.use('/fediverse', fediverseRoutes);  // 新增：Fediverse (ActivityPub)
router.use('/avatar', avatarRoutes);  // 新增：Avatar Fusion (化身合体)
router.use('/dualtrack', dualTrackRouter.createRouter());  // 新增：Dual-Track 双轨桥接器

// =============== HoTT Type Checker Route ===============
router.get('/hott/types', (_req, res) => {
  res.json({
    code: 0,
    data: {
      registeredTypes: hottTypeChecker.getRegisteredTypes(),
      version: '2.0.0',
    },
  });
});

export default router;
