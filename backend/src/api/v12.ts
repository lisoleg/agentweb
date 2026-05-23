/**
 * V12 API Routes Aggregator
 * Mounts all V12.0 routes under /api/v12/
 */

import { Router } from 'express';
import courtV2Routes from './court-v2';
import relayRoutes from './relay';
import creditRoutes from './credit';

const router = Router();

// =============== Mount V12 Routes ===============

// Court V2 (裁决增强)
router.use('/court', courtV2Routes);

// Relay (通算一体中继)
router.use('/relay', relayRoutes);

// Credit (信用评级)
router.use('/credit', creditRoutes);

// =============== V12 Info ===============
router.get('/', (_req, res) => {
  res.json({
    code: 0,
    data: {
      version: '12.0.0',
      description: 'Σ-Cloud V12.0 API — 6G-Σ融合架构: 内生AI裁决引擎 + 通算一体中继 + 零知识信用证明',
      inspiration: '6GANA 6GNetGPT六大核心思想',
      endpoints: {
        court: '/api/v12/court',
        relay: '/api/v12/relay',
        credit: '/api/v12/credit',
      },
      features: {
        judgmentAnalysis: '内生AI裁决分析引擎',
        judgmentSimulation: '判决沙盘预演(数字孪生)',
        intelligentRouting: '智能中继路由+故障自愈',
        dynamicFee: '动态费率调度(通算一体)',
        creditRating: '多维度信用评级+七级等级',
        zkCreditProof: '零知识信用证明(模拟模式)',
        reputationStaking: '声誉担保(众筹协作)',
      },
    },
  });
});

export default router;
