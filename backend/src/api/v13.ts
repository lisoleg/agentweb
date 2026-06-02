/**
 * V13 API Routes Aggregator
 * Mounts all V13.0 HG-STR routes under /api/v13/
 *
 * V13.0: 基于异构图时空推理的自主蜂群决策系统(HG-STR)三大机制
 * - Typed Edge: 类型化边通信 (取代扁平JSON RPC)
 * - Hierarchical Planner: 三层MDP分层决策 + ITA-Trigger
 * - Residual Memory: GRU残存记忆 + Gossip弱连通容错
 */

import { Router } from 'express';
import typedEdgeRoutes from './typed-edge';
import hierarchicalPlannerRoutes from './hierarchical-planner';
import residualMemoryRoutes from './residual-memory';

const router = Router();

// =============== Mount V13 Routes ===============

// Typed Edge (类型化边通信 — 异构图 + Schema-based消息)
router.use('/typed-edge', typedEdgeRoutes);

// Hierarchical Planner (分层决策 + ITA-Trigger引擎)
router.use('/planner', hierarchicalPlannerRoutes);

// Residual Memory (残存记忆 + Gossip弱连通容错)
router.use('/residual-memory', residualMemoryRoutes);

// =============== V13 Info ===============
router.get('/', (_req, res) => {
  res.json({
    code: 0,
    data: {
      version: '13.0.0',
      description: 'Σ-Cloud V13.0 HG-STR API — 异构图时空推理: 类型化边 + 分层Planner + 残存记忆',
      inspiration: '《基于异构图时空推理的自主蜂群决策系统(HG-STR)及其对下一代多智能体架构的启示》— 复合体理学',
      theorems: {
        '4.1': '异构图通信效率优势: R_het > R_hom (m_het=O(k), k≪d)',
        '4.2': '残存记忆鲁棒性: T_GRU ≪ T_noMem (无Δ_replan重规划时延)',
      },
      prophecies: {
        'P1': '50节点AgentWeb中, 异构边组任务完成率比同构组高15% (30%丢包下B组>90%, A组<75%)',
        'P2': '医疗AgentWeb中, 带ITA-Trigger的预警系统误报率比纯弹窗系统低40%',
      },
      endpoints: {
        typedEdge: '/api/v13/typed-edge',
        planner: '/api/v13/planner',
        residualMemory: '/api/v13/residual-memory',
      },
      features: {
        typedEdge: '类型化边通信 — 异构图 + Schema-based消息 + 传播规则约束',
        heterogeneousGraph: '异构图 G=(V_f∪V_t∪V_e, E, τ) 三类节点+类型映射函数',
        hierarchicalPlanner: '三层MDP分层决策 L1战略→L2战役→L3战术 + 死锁检测',
        itaTrigger: 'ITA-Trigger预判型引擎 (Information→Trigger→Action)',
        residualMemory: 'GRU残存记忆 h_i + Anti-entropy反熵同步',
        gossipSync: 'Gossip+TTL弱连通容错 + Last Known Good State缓存',
        deadlockPrevention: '死锁检测(连续3次同目标无成功→逃逸)',
        localOptimaEscape: '局部最优逃逸(分层决策避免Flat Policy陷阱)',
      },
    },
  });
});

export default router;
