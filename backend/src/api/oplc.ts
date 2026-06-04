/**
 * OPLC API 路由 — 奇正格链 RESTful 接口
 *
 * V15.0 新增端点：
 * POST   /api/v15/oplc/transaction          — 创建交易
 * GET    /api/v15/oplc/transactions         — 查询所有交易
 * GET    /api/v15/oplc/transaction/:id      — 获取交易详情
 * POST   /api/v15/oplc/vote/:txId           — 提交三进制投票
 * GET    /api/v15/oplc/poset/stats          — Poset 统计信息
 * GET    /api/v15/oplc/maximal-elements     — 极大元集（区块链视图）
 * POST   /api/v15/oplc/consensus/run        — 运行 OP-BFT 共识
 * GET    /api/v15/oplc/consensus/rounds     — 共识轮次历史
 * POST   /api/v15/oplc/merkle/build         — 构建 Merkle Tree
 * POST   /api/v15/oplc/merkle/verify        — 验证 Merkle Proof
 * POST   /api/v15/oplc/reconcile/:a/:b      — 冲突调解
 * GET    /api/v15/oplc/health               — 系统健康报告
 * GET    /api/v15/oplc/theorems             — 定理验证状态
 *
 * @version 15.0.0
 */

import { Router } from 'express';
import {
  OPLCCoreService,
  createOPLC,
  TernaryVoteValue,
  TernaryVote,
} from '../services/oplc';

const router = Router();

// 单例 OPLC 实例（生产环境应使用依赖注入）
let oplcInstance: OPLCCoreService | null = null;

function getOPLC(): OPLCCoreService {
  if (!oplcInstance) {
    oplcInstance = createOPLC('main-node');
  }
  return oplcInstance;
}

// ============================================================================
// 交易管理
// ============================================================================

/** 创建新交易 */
router.post('/transaction', (req, res) => {
  try {
    const { data, parentIds } = req.body as {
      data: Record<string, unknown>;
      parentIds?: string[];
    };

    if (!data) {
      return res.status(400).json({ error: 'Missing required field: data' });
    }

    const oplc = getOPLC();
    const tx = oplc.createTransaction(data, parentIds || []);

    res.json({
      success: true,
      transaction: {
        id: tx.id,
        parents: tx.parents,
        creator: tx.creator,
        lamportTimestamp: tx.lamportTimestamp,
        aggregatedVote: tx.aggregatedVote,
        createdAt: tx.createdAt,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** 查询所有交易 */
router.get('/transactions', (_req, res) => {
  const oplc = getOPLC();
  const transactions = oplc.getAllTransactions().map(tx => ({
    id: tx.id,
    parents: tx.parents,
    creator: tx.creator,
    lamportTimestamp: tx.lamportTimestamp,
    aggregatedVote: tx.aggregatedVote,
    voteCount: tx.votes.size,
    finalized: tx.finalized,
    hasMerkleProof: !!tx.merkleProof,
    createdAt: tx.createdAt,
  }));

  res.json({
    success: true,
    count: transactions.length,
    transactions,
  });
});

/** 获取单笔交易详情 */
router.get('/transaction/:id', (req, res) => {
  const { id } = req.params;
  const oplc = getOPLC();
  const tx = oplc.getTransaction(id);

  if (!tx) {
    return res.status(404).json({ error: `Transaction ${id} not found` });
  }

  // 序列化 Map 类型
  const votes: Array<{ voter: string; vote: number; timestamp: string }> = [];
  for (const [, v] of tx.votes) {
    votes.push({ voter: v.voter, vote: v.vote, timestamp: v.timestamp.toISOString() });
  }

  res.json({
    success: true,
    transaction: {
      ...tx,
      votes,
      merkleProof: tx.merkleProof || null,
    },
  });
});

// ============================================================================
// 三进制投票
// ============================================================================

/** 提交三进制投票 (+1/0/-1) */
router.post('/vote/:txId', (req, res) => {
  try {
    const { txId } = req.params;
    const { voter, vote, evidence } = req.body as {
      voter?: string;
      vote?: number;
      evidence?: { targetHash: string; path: Array<{ hash: string; isRight: boolean }>; rootHash: string; allegation: string; };
    };

    if (!voter || vote === undefined) {
      return res.status(400).json({ error: 'Missing required fields: voter, vote' });
    }

    if (![TernaryVoteValue.POSITIVE, TernaryVoteValue.NEUTRAL, TernaryVoteValue.NEGATIVE].includes(vote)) {
      return res.status(400).json({ error: `Invalid vote value: ${vote}. Must be +1, 0, or -1` });
    }

    const ternaryVote: TernaryVote = {
      voter,
      vote: vote as TernaryVoteValue,
      timestamp: new Date(),
      ...(vote === TernaryVoteValue.NEGATIVE && evidence ? { evidence } : {}),
    };

    const oplc = getOPLC();
    const result = oplc.castVote(txId, ternaryVote);

    res.json({
      success: result.success,
      roundResult: result.roundResult || undefined,
      error: result.error || undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** 批量模拟投票（测试用） */
router.post('/vote/simulate/:txId', (req, res) => {
  try {
    const { txId } = req.params;
    const { nodeCount = 5, positiveRatio = 0.6 } = req.body as {
      nodeCount?: number;
      positiveRatio?: number;
    };

    const oplc = getOPLC();
    const result = oplc.castSimulatedVotes(
      txId,
      Math.min(nodeCount, 50), // 上限50个节点
      positiveRatio
    );

    res.json({
      success: true,
      txId,
      submitted: result.success,
      failed: result.failed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Poset 查询
// ============================================================================

/** Poset 结构统计 */
router.get('/poset/stats', (_req, res) => {
  const oplc = getOPLC();
  const state = oplc.exportNodeState();

  res.json({
    success: true,
    nodeId: state.nodeId,
    posetStats: state.posetStats,
    phiMetric: {
      relationActionS: state.posetStats.totalTransactions * state.posetStats.avgBranchingFactor,
      phaseCoupling: state.posetStats.finalizedCount / Math.max(state.posetStats.totalTransactions, 1),
      topologicalImpedance: 0,
      entropy: 1 - state.posetStats.finalizedCount / Math.max(state.posetStats.totalTransactions, 1),
    },
  });
});

/** 极大元集 — 区块链视图 */
router.get('/maximal-elements', (_req, res) => {
  const oplc = getOPLC();
  const blockchainView = oplc.getBlockchainView();

  res.json({
    success: true,
    blockCount: blockchainView.length,
    blocks: blockchainView,
  });
});

// ============================================================================
// OP-BFT 共识
// ============================================================================

/** 运行一轮 OP-BFT 共识 */
router.post('/consensus/run', async (req, res) => {
  try {
    const oplc = getOPLC();

    const consensusResult = await oplc.runConsensus();

    res.json({
      success: true,
      result: consensusResult.result,
      maximalElement: consensusResult.maximalElement || null,
      phiBefore: consensusResult.phiBefore,
      phiAfter: consensusResult.phiAfter,
      theorem31: consensusResult.theorem31,
      theorem32: consensusResult.theorem32,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** 查询共识轮次历史（通过健康报告间接获取） */
router.get('/consensus/status', (_req, res) => {
  const oplc = getOPLC();
  const state = oplc.exportNodeState();

  res.json({
    success: true,
    consensusStats: state.consensusStats,
  });
});

// ============================================================================
// Merkle Proof
// ============================================================================

/** 构建 Merkle Tree */
router.post('/merkle/build', (req, res) => {
  try {
    const { txIds } = req.body as { txIds?: string[] };

    if (!txIds || !Array.isArray(txIds) || txIds.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid txIds array' });
    }

    const oplc = getOPLC();
    const tree = oplc.buildMerkleTreeForTransactions(txIds);

    res.json({
      success: true,
      ...tree,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** 验证 Merkle Proof */
router.post('/merkle/verify', (req, res) => {
  try {
    const { targetHash, proof, expectedRoot } = req.body as {
      targetHash?: string;
      proof?: Array<{ hash: string; isRight: boolean }>;
      expectedRoot?: string;
    };

    if (!targetHash || !proof || !expectedRoot) {
      return res.status(400).json({
        error: 'Missing required fields: targetHash, proof, expectedRoot',
      });
    }

    const oplc = getOPLC();
    const result = oplc.verifyProof(targetHash, proof, expectedRoot);

    res.json({
      success: true,
      valid: result.valid,
      computedRoot: result.computedRoot,
      verificationSteps: result.verificationSteps,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// 冲突调解
// ============================================================================

/** 手动触发冲突调解 */
router.post('/reconcile/:txIdA/:txIdB', (req, res) => {
  try {
    const { txIdA, txIdB } = req.params;
    const oplc = getOPLC();
    const result = oplc.reconcileConflict(txIdA, txIdB);

    res.json({
      success: !!result,
      reconciliationTxId: result,
      message: result
        ? `Successfully reconciled ${txIdA} ↔ ${txIdB} → ${result}`
        : `No reconciliation needed (already comparable or invalid)`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// 系统监控
// ============================================================================

/** 系统健康报告 */
router.get('/health', (_req, res) => {
  const oplc = getOPLC();
  const health = oplc.getHealthReport();

  res.json({
    success: true,
    ...health,
  });
});

/** 定理验证状态（安全性+活性） */
router.get('/theorems', async (_req, res) => {
  try {
    const oplc = getOPLC();
    const report = await oplc.runConsensus();

    res.json({
      success: true,
      theorem3_1_safety: report.theorem31,
      theorem3_2_liveness: report.theorem32,
      consensusResult: report.result,
      phiTransition: {
        before: report.phiBefore,
        after: report.phiAfter,
        improvement: report.phiBefore.entropy - report.phiAfter.entropy > 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
