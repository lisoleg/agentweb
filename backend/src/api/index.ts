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
import fediverseRoutes from './fediverse';  // V2.0: Fediverse (ActivityPub) 路由
import avatarRoutes from './avatar';  // V2.0: Avatar Fusion (化身合体) 路由
import subdaoRoutes from './subdao';  // V4.0: SubDAO 本地化治理路由
import bridgeRoutes from './bridge';  // V4.0: 跨链桥接协议路由
import oracleRoutes from './oracle';  // V4.0: 太乙预言机路由
import brainwaveRoutes from './brainwave';  // V5.0: Brainwave整合路由
import { hottTypeChecker } from '../services/hottTypeChecker';
import { dualTrackRouter } from '../services/dualTrackRouter';  // V2.0: Dual-Track 双轨桥接器

const router = Router();

// Φ-Gateway 中间件（语义网关）
router.use(phiGatewayMiddleware);

// =============== API Info ===============
router.get('/', (_req, res) => {
  res.json({
    name: 'AgentWeb API',
    version: '5.0.0',  // V5.0: Brainwave Integration
    description: 'AgentWeb 西格玛云 - Next-generation digital society infrastructure (Fediverse + Four-Token + IGCTR + SubDAO + Cross-Chain + Taiyi Oracle + Brainwave)',
    endpoints: {
      auth: '/api/v1/auth',
      did: '/api/v1/did',
      vc: '/api/v1/vc',
      phi: '/api/v1/phi',
      agent: '/api/v1/agent',
      news: '/api/v1/news',
      governance: '/api/v1/governance',
      fediverse: '/api/v1/fediverse',
      avatar: '/api/v1/avatar',
      dualtrack: '/api/v1/dualtrack',
      subdao: '/api/v1/subdao',    // V4.0: SubDAO 本地化治理
      bridge: '/api/v1/bridge',    // V4.0: 跨链桥接协议
      oracle: '/api/v1/oracle',    // V4.0: 太乙预言机
      brainwave: '/api/v1/brainwave',  // V5.0: Brainwave整合
      hott: '/api/v1/hott'
    },
    documentation: process.env.ENABLE_SWAGGER === 'true' ? '/api-docs' : undefined,
    versionNotes: 'V5.0: Brainwave Integration (SRAM Pool, Phi Quantizer, Model Partitioner, NPU Soft Core, Catapult Pool, Precision Validator)'
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
router.use('/fediverse', fediverseRoutes);
router.use('/avatar', avatarRoutes);
router.use('/dualtrack', dualTrackRouter.createRouter());
router.use('/subdao', subdaoRoutes);    // V4.0: SubDAO 本地化治理
router.use('/bridge', bridgeRoutes);    // V4.0: 跨链桥接协议
router.use('/oracle', oracleRoutes);    // V4.0: 太乙预言机
router.use('/brainwave', brainwaveRoutes);  // V5.0: Brainwave整合

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
