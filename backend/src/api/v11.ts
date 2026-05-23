/**
 * V11 API Routes Aggregator
 * Mounts all V11.0 routes under /api/v11/
 */

import { Router } from 'express';
import courtRoutes from './court';
import passportRoutes from './passport';
import bridgeV2Routes from './bridge-v2';
import wakeupRoutes from './wakeup';
import laborMatchRoutes from './labor-match';

const router = Router();

// =============== Mount V11 Routes ===============

// Court (宪法法院)
router.use('/court', courtRoutes);

// Passport (Agent通行证)
router.use('/passport', passportRoutes);

// BridgeV2 (跨链桥接V2)
router.use('/bridge-v2', bridgeV2Routes);

// Wakeup (冬眠唤醒)
router.use('/wakeup', wakeupRoutes);

// Labor Match (链下匹配索引)
router.use('/labor', laborMatchRoutes);

// =============== V11 Info ===============
router.get('/', (_req, res) => {
  res.json({
    code: 0,
    data: {
      version: '11.0.0',
      description: 'Σ-Cloud V11.0 API — ConstitutionCourt + AgentPassport + SigmaBridgeV2 + HibernationWakeup + LaborIndexer',
      endpoints: {
        court: '/api/v11/court',
        passport: '/api/v11/passport',
        bridgeV2: '/api/v11/bridge-v2',
        wakeup: '/api/v11/wakeup',
        laborMatch: '/api/v11/labor/match',
      },
    },
  });
});

export default router;
