/**
 * V12 API Routes Aggregator
 * Mounts all V12.0 + V12.5 routes under /api/v12/
 */

import { Router } from 'express';
import courtV2Routes from './court-v2';
import relayRoutes from './relay';
import creditRoutes from './credit';
import gcAncorRoutes from './gc-ancor';

const router = Router();

// =============== Mount V12 Routes ===============

// Court V2 (裁决增强)
router.use('/court', courtV2Routes);

// Relay (通算一体中继)
router.use('/relay', relayRoutes);

// Credit (信用评级)
router.use('/credit', creditRoutes);

// GC Ancor (V12.5 GC锚定层 + 自动奖惩 + 职业征信)
router.use('/gc-ancor', gcAncorRoutes);

// =============== V12 Info ===============
router.get('/', (_req, res) => {
  res.json({
    code: 0,
    data: {
      version: '12.5.0',
      description: 'Σ-Cloud V12.5 API — 6G-Σ融合架构: 内生AI裁决引擎 + 通算一体中继 + 零知识信用证明 + GC锚定层自动奖惩',
      inspiration: '6GANA 6GNetGPT六大核心思想 + 《皇帝的新衣与影子内阁》+ 《GSD-Coin终极推演》',
      endpoints: {
        court: '/api/v12/court',
        relay: '/api/v12/relay',
        credit: '/api/v12/credit',
        gcAncor: '/api/v12/gc-ancor',
      },
      features: {
        judgmentAnalysis: '内生AI裁决分析引擎',
        judgmentSimulation: '判决沙盘预演(数字孪生)',
        intelligentRouting: '智能中继路由+故障自愈',
        dynamicFee: '动态费率调度(通算一体)',
        creditRating: '多维度信用评级+七级等级(5维:Φ+法院+劳动+中继+GC)',
        zkCreditProof: '零知识信用证明(模拟模式)',
        reputationStaking: '声誉担保(众筹协作)',
        gcAncor: 'GC锚定层(代码即法律自动奖惩)',
        gcPenaltyExecutor: '三级惩罚自动执行(WARNING→DOWNGRADE→EXPEL)',
        gcCareerCredit: '链上职业征信报告(不可篡改)',
        gcHealthScore: 'GC健康度评分(0-10000)',
      },
    },
  });
});

export default router;
