/**
 * V17.0 ASG (Agent Security Gateway) API 路由
 *
 * 基于 MetaMask Agent Wallet 四道安全防线的完整RESTful API
 * 16个端点覆盖6层安全架构
 *
 * @version V17.0
 * @base /api/v17/asg
 */

import { Router, Request, Response } from 'express';
import { getInstance as getAsgCore } from '../services/asg/asgCoreService';
import {
  AgentMode,
} from '../services/asg/types';

const router = Router();
const asg = getAsgCore();

// ============================================================================
// 系统级端点
// ============================================================================

/** GET /api/v17/asg/health — 健康检查 */
router.get('/health', (_req: Request, res: Response) => {
  const health = asg.healthCheck();
  res.json({
    code: 0,
    data: {
      ...health,
      timestamp: new Date().toISOString(),
    },
    version: '17.0.0',
  });
});

/** GET /api/v17/asg/stats — ASG完整系统状态 */
router.get('/stats', (_req: Request, res: Response) => {
  const state = asg.getSystemState();
  res.json({ code: 0, data: state, version: '17.0.0' });
});

// ============================================================================
// L1: Agent 身份管理 (4端点)
// ============================================================================

/** POST /api/v17/asg/agents — 注册新Agent */
router.post('/agents', (req: Request, res: Response) => {
  try {
    const registry = require('../services/asg/agentIdentityRegistry').getInstance();
    const agent = registry.registerAgent({
      ownerDid: req.body.ownerDid || `did:owner:${Date.now()}`,
      displayName: req.body.displayName || 'New Agent',
      agentType: req.body.agentType || 'trading_bot',
      skills: req.body.skills || [
        { name: 'swap', description: 'Token swap', minTrustLevel: 0.3, involvesFundMovement: true, maxSingleOperationRatio: 0.2 },
      ],
      initialPolicy: {
        dailySpendingLimit: req.body.dailySpendingLimit || 10_000,
        perTransactionLimit: req.body.perTransactionLimit || 1_000,
        protocolWhitelist: req.body.protocolWhitelist || ['*'],
        assetWhitelist: req.body.assetWhitelist || ['*'],
        timeWindow: req.body.timeWindow || { activeFrom: '00:00', activeUntil: '23:59', timezone: 'Asia/Shanghai' },
        mode: req.body.mode || AgentMode.GUARD,
        hitlTriggers: [],
      },
      pohMethod: req.body.pohMethod || 'stake_bonded',
    });

    res.status(201).json({
      code: 0,
      data: agent,
      version: '17.0.0',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(400).json({ code: 1, message: `Registration failed: ${msg}` });
  }
});

/** GET /api/v17/asg/agents — 列出所有Agent */
router.get('/agents', (req: Request, res: Response) => {
  const registry = require('../services/asg/agentIdentityRegistry').getInstance();
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const agents = registry.listAllAgents({ limit });
  res.json({
    code: 0,
    data: agents.map((a: any) => ({
      did: a.did,
      displayName: a.displayName,
      agentType: a.agentType,
      status: a.status,
      trustScore: a.trustScore,
      totalOperations: a.totalOperations,
      mode: a.currentPolicy?.mode,
      registeredAt: a.registeredAt?.toISOString(),
    })),
    count: agents.length,
    version: '17.0.0',
  });
});

/** GET /api/v17/asg/agents/:did — 获取Agent详情 */
router.get('/agents/:did', (req: Request, res: Response) => {
  const registry = require('../services/asg/agentIdentityRegistry').getInstance();
  const agent = registry.getAgent(req.params.did);
  if (!agent) {
    res.status(404).json({ code: 1, message: 'Agent not found' });
    return;
  }

  // 返回脱敏信息（不暴露私钥相关数据）
  res.json({
    code: 0,
    data: {
      did: agent.did,
      displayName: agent.displayName,
      agentType: agent.agentType,
      ownerDid: agent.ownerDid,
      skills: agent.skills,
      currentPolicy: {
        policyId: agent.currentPolicy.policyId,
        mode: agent.currentPolicy.mode,
        dailySpendingLimit: agent.currentPolicy.dailySpendingLimit,
        perTransactionLimit: agent.currentPolicy.perTransactionLimit,
        protocolWhitelist: agent.currentPolicy.protocolWhitelist,
        hitlTriggerCount: agent.currentPolicy.hitlTriggers.length,
        version: agent.currentPolicy.version,
      },
      trustScore: agent.trustScore,
      proofOfHuman: {
        method: agent.proofOfHuman.method,
        valid: agent.proofOfHuman.valid,
        expiresAt: agent.proofOfHuman.expiresAt.toISOString(),
      },
      stats: {
        totalOperations: agent.totalOperations,
        successfulOperations: agent.successfulOperations,
        successRate: agent.totalOperations > 0 ? (agent.successfulOperations / agent.totalOperations).toFixed(3) : 'N/A',
      },
      status: agent.status,
      registeredAt: agent.registeredAt.toISOString(),
      lastActiveAt: agent.lastActiveAt.toISOString(),
    },
    version: '17.0.0',
  });
});

/** PATCH /api/v17/asg/agents/:did/mode — 切换Guard/Beast模式 */
router.patch('/agents/:did/mode', (req: Request, res: Response) => {
  const registry = require('../services/asg/agentIdentityRegistry').getInstance();
  const success = registry.switchMode(req.params.did, req.body.mode as AgentMode);
  if (!success) {
    res.status(404).json({ code: 1, message: 'Agent not found or mode invalid' });
    return;
  }
  res.json({ code: 0, message: `Mode switched to ${req.body.mode}`, version: '17.0.0' });
});

// ============================================================================
// L2/L3: 操作执行与门控 (3端点)
// ============================================================================

/** POST /api/v17/asg/operations — 提交操作请求（主入口） */
router.post('/operations', async (req: Request, res: Response) => {
  try {
    const result = await asg.executeOperation({
      requestId: `op_${Date.now()}`,
      agentDid: req.body.agentDid,
      operationType: req.body.operationType || 'swap',
      params: req.body.params || {},
      targetProtocol: req.body.targetProtocol || '',
      assetMovements: req.body.assetMovements || [],
      maxLatencyMs: req.body.maxLatencyMs || 30_000,
      forceHitl: req.body.forceHitl || false,
      submittedAt: new Date(),
    });

    const status = (result.finalStatus as string) === 'executed' ? 200 :
      (result.finalStatus as string) === 'hitl_pending' ? 202 : 400;
    res.status(status).json({
      code: 0,
      data: result,
      version: '17.0.0',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ code: 1, message: `Operation failed: ${msg}` });
  }
});

/** GET /api/v17/asg/operations/:id — 查询操作结果 */
router.get('/operations/:id', (req: Request, res: Response) => {
  // 从HITL服务查找（如果是HITL状态的操作）
  const hitlService = require('../services/asg/humanInLoopService').getInstance();
  const hitlReq = hitlService.getRequest(req.params.id);

  if (hitlReq) {
    res.json({
      code: 0,
      data: {
        id: req.params.id,
        status: hitlReq.status,
        transactionId: hitlReq.transactionId,
        riskLevel: hitlReq.userFacingSummary.riskLevel,
        summary: hitlReq.userFacingSummary,
        createdAt: hitlReq.createdAt.toISOString(),
        expiresAt: hitlReq.expiresAt.toISOString(),
      },
      version: '17.0.0',
    });
    return;
  }

  res.status(404).json({ code: 1, message: 'Operation not found' });
});

/** GET /api/v17/asg/gate/stats — 门控管线统计 */
router.get('/gate/stats', (_req: Request, res: Response) => {
  const gatePipeline = require('../services/asg/transactionGatePipeline').getInstance();
  res.json({
    code: 0,
    data: gatePipeline.getStats(),
    version: '17.0.0',
  });
});

// ============================================================================
// L4: 人机回环 HITL (4端点)
// ============================================================================

/** GET /api/v17/asg/hitl — 列出HITL请求 */
router.get('/hitl', (req: Request, res: Response) => {
  const hitlService = require('../services/asg/humanInLoopService').getInstance();

  if (req.query.agentDid) {
    const requests = hitlService.listRequestsByAgent(req.query.agentDid as string);
    res.json({
      code: 0,
      data: requests.map((r: any) => ({
        requestId: r.requestId,
        agentDid: r.agentDid,
        status: r.status,
        riskLevel: r.userFacingSummary?.riskLevel,
        title: r.userFacingSummary?.title,
        amount: r.userFacingSummary?.amount,
        createdAt: r.createdAt?.toISOString(),
        expiresAt: r.expiresAt?.toISOString(),
      })),
      count: requests.length,
      version: '17.0.0',
    });
  } else {
    res.json({
      code: 0,
      data: hitlService.getStats(),
      version: '17.0.0',
    });
  }
});

/** POST /api/v17/asg/hitl/:id/approve — 批准HITL请求 */
router.post('/hitl/:id/approve', (req: Request, res: Response) => {
  const hitlService = require('../services/asg/humanInLoopService').getInstance();
  const result = hitlService.approveRequest(req.params.id, req.body.signature);

  if (!result.success) {
    res.status(400).json({ code: 1, message: result.error, request: result.request });
    return;
  }

  res.json({
    code: 0,
    message: 'HITL request approved',
    request: {
      requestId: result.request!.requestId,
      status: result.request!.status,
      respondedAt: result.request!.respondedAt?.toISOString(),
    },
    version: '17.0.0',
  });
});

/** POST /api/v17/asg/hitl/:id/reject — 拒绝HITL请求 */
router.post('/hitl/:id/reject', (req: Request, res: Response) => {
  const hitlService = require('../services/asg/humanInLoopService').getInstance();
  const result = hitlService.rejectRequest(req.params.id, req.body.reason);

  if (!result.success) {
    res.status(400).json({ code: 1, message: result.error });
    return;
  }

  res.json({
    code: 0,
    message: 'HITL request rejected',
    requestId: req.params.id,
    version: '17.0.0',
  });
});

/** GET /api/v17/asg/hitl/notifications — 通知日志 */
router.get('/hitl/notifications', (req: Request, res: Response) => {
  const hitlService = require('../services/asg/humanInLoopService').getInstance();
  const limit = parseInt(req.query.limit as string, 10) || 50;
  res.json({
    code: 0,
    data: hitlService.getNotificationLog(limit),
    version: '17.0.0',
  });
});

// ============================================================================
// L5: TEE 密钥管理 (3端点)
// ============================================================================

/** POST /api/v17/asg/tee/keys — 为Agent生成TEE密钥对 */
router.post('/tee/keys', (req: Request, res: Response) => {
  try {
    const teeMgr = require('../services/asg/teeKeyManager').getInstance();
    const key = teeMgr.generateKeyForAgent(
      req.body.agentDid,
      req.body.keyType || 'signing'
    );

    res.status(201).json({
      code: 0,
      data: {
        keyId: key.keyId,
        agentDid: key.agentDid,
        publicKey: key.publicKey,
        keyType: key.keyType,
        algorithm: key.algorithm,
        derivationPath: key.derivationPath,
        teeAttestation: key.teeAttestation,
        status: key.status,
        createdAt: key.createdAt.toISOString(),
        warning: 'Private key is stored in TEE and cannot be exported. Use /tee/export to initiate mnemonic export.',
      },
      version: '17.0.0',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(400).json({ code: 1, message: `Key generation failed: ${msg}` });
  }
});

/** GET /api/v17/asg/tee/keys — 列出Agent的TEE密钥 */
router.get('/tee/keys', (req: Request, res: Response) => {
  const teeMgr = require('../services/asg/teeKeyManager').getInstance();
  const keys = req.query.agentDid
    ? teeMgr.listKeysByAgent(req.query.agentDid as string)
    : [];

  res.json({
    code: 0,
    data: keys.map((k: any) => ({
      keyId: k.keyId,
      agentDid: k.agentDid,
      publicKey: k.publicKey.substring(0, 32) + '...', // 截断公钥显示
      keyType: k.keyType,
      algorithm: k.algorithm,
      derivationPath: k.derivationPath,
      status: k.status,
      hasExportRecord: !!k.exportRecord,
      createdAt: k.createdAt?.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString(),
    })),
    count: keys.length,
    version: '17.0.0',
  });
});

/** POST /api/v17/asg/tee/export — 发起助记词导出 */
router.post('/tee/export', async (req: Request, res: Response) => {
  try {
    const teeMgr = require('../services/asg/teeKeyManager').getInstance();
    const exportReq = teeMgr.initiateMnemonicExport(
      req.body.agentDid,
      req.body.authMethod || 'password'
    );

    // 如果提供了认证凭证，直接完成导出（模拟）
    let mnemonic: string | undefined;
    if (req.body.credential) {
      const completeResult = teeMgr.completeMnemonicExport(
        exportReq.requestId,
        req.body.credential
      );
      if (completeResult.success && completeResult.mnemonic) {
        mnemonic = completeResult.mnemonic;
      }
    }

    res.json({
      code: 0,
      data: {
        exportRequestId: exportReq.requestId,
        status: exportReq.status,
        agentDid: exportReq.agentDid,
        authMethod: exportReq.secondaryAuthMethod,
        ...(mnemonic ? { mnemonic, warning: 'STORE THIS MNEMONIC SECURELY. It will never be shown again.' } : {}),
        ...(!mnemonic ? { nextStep: 'POST with credential field to complete export' } : {}),
      },
      version: '17.0.0',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(400).json({ code: 1, message: `Export failed: ${msg}` });
  }
});

// ============================================================================
// L6: 经济安全池 (2端点)
// ============================================================================

/** POST /api/v17/asg/stake — 质押 */
router.post('/stake', (req: Request, res: Response) => {
  try {
    const ecoPool = require('../services/asg/economicSafetyPool').getInstance();
    const stake = ecoPool.stake({
      agentDid: req.body.agentDid,
      stakerDid: req.body.stakerDid,
      amount: parseFloat(req.body.amount) || 0,
      currency: req.body.currency || 'USD',
      lockDurationDays: parseInt(req.body.lockDays as string, 10) || 30,
    });

    res.status(201).json({
      code: 0,
      data: stake,
      version: '17.0.0',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(400).json({ code: 1, message: `Stake failed: ${msg}` });
  }
});

/** GET /api/v17/asg/economic/pool — 经济池统计 */
router.get('/economic/pool', (_req: Request, res: Response) => {
  const ecoPool = require('../services/asg/economicSafetyPool').getInstance();
  res.json({
    code: 0,
    data: ecoPool.getFullStats(),
    version: '17.0.0',
  });
});

export default router;
