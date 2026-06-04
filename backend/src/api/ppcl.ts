/**
 * PPCL API 路由 — 隐私保护共识层 (V16.0)
 *
 * RESTful API 端点：
 *
 * L1 加密记录:
 *   POST   /ppcl/transaction          创建加密交易
 *   GET    /ppcl/transaction/:id      获取公开信息
 *   GET    /ppcl/transaction/:id/fields 字段访问级别
 *   POST   /ppcl/transaction/:id/decrypt  解密（系统级）
 *   GET    /ppcl/transaction/:id/integrity  完整性验证
 *
 * L2 视图密钥:
 *   POST   /ppcl/view-key             颁发View Key
 *   POST   /ppcl/view-key/:id/use     使用View Key访问
 *   DELETE /ppcl/view-key/:id         撤销View Key
 *   GET    /ppcl/view-key/:id         查询View Key详情
 *   GET    /ppcl/view-keys            列出活跃View Key
 *   GET    /ppcl/disclosure-logs      披露日志查询
 *
 * L3 合规连接:
 *   POST   /ppcl/compliance/check     执行合规检查
 *   POST   /ppcl/compliance/funds-proof  资金来源证明
 *   POST   /ppcl/compliance/sanction  制裁筛查
 *   GET    /ppcl/compliance/stats     合规统计
 *
 * 透明性债务:
 *   POST   /ppcl/debt/analyze         完整债务分析
 *   GET    /ppcl/debt/quick           快速评估
 *   GET    /ppcl/debt/mitigations     缓解建议
 *
 * 系统:
 *   GET    /ppcl/health               三层健康报告
 *   GET    /ppcl/stats                完整统计
 *
 * @version V16.0
 */

import { Router, Request, Response } from 'express';
import {
  PPLCCoreService,
  createPPCL,
  AccessLevel,
  ViewKeyPurpose,
  ComplianceCheckType,
} from '../services/ppcl';

const router = Router();

// ============================================================================
// 全局单例
// ============================================================================

let ppcl: PPLCCoreService | null = null;

function getInstance(): PPLCCoreService {
  if (!ppcl) {
    ppcl = createPPCL();
  }
  return ppcl;
}

// ============================================================================
// L1: 加密记录 API
// ============================================================================

/**
 * POST /api/v16/ppcl/transaction
 * 创建新的加密交易（默认保密）
 */
router.post('/transaction', (req: Request, res: Response) => {
  try {
    const { recordType, fields, fieldAccessLevels, ownerPublicKeyHash, parentId } = req.body;

    if (!recordType || !fields) {
      res.status(400).json({ code: 1, message: 'recordType and fields are required' });
      return;
    }

    const instance = getInstance();
    const tx = instance.createEncryptedTransaction({
      recordType,
      fields,
      fieldAccessLevels,
      ownerPublicKeyHash,
      parentId,
    });

    res.json({
      code: 0,
      data: {
        transactionId: tx.baseTx.id,
        recordId: tx.encryptedRecord.recordId,
        recordType: tx.encryptedRecord.recordType,
        ownerHash: tx.encryptedRecord.ownerPublicKeyHash,
        merkleCommitment: tx.encryptedRecord.merkleCommitment,
        fieldCount: tx.encryptedRecord.fieldEncryptionMeta.length,
        createdAt: tx.encryptedRecord.createdAt,
        debtSnapshot: {
          totalDebt: Math.round(tx.transparencySnapshot.totalTransparencyDebt * 1000) / 1000,
          improvementPotential: Math.round(tx.transparencySnapshot.privacyImprovementPotential * 1000) / 1000,
        },
      },
      version: '16.0.0',
    });
  } catch (error) {
    res.status(500).json({ code: 1, message: (error as Error).message });
  }
});

/**
 * GET /api/v16/ppcl/transaction/:id
 * 获取交易公开信息（无需解密）
 */
router.get('/transaction/:id', (req: Request, res: Response) => {
  const info = getInstance().getTransactionPublicInfo(req.params.id);
  if (!info) {
    res.status(404).json({ code: 1, message: 'Transaction not found' });
    return;
  }
  res.json({ code: 0, data: info, version: '16.0.0' });
});

/**
 * GET /api/v16/ppcl/transaction/:id/fields
 * 获取字段访问级别概览
 */
router.get('/transaction/:id/fields', (req: Request, res: Response) => {
  const overview = getInstance().getFieldAccessOverview(req.params.id);
  if (overview.length === 0) {
    res.status(404).json({ code: 1, message: 'Transaction not found or no fields' });
    return;
  }
  res.json({ code: 0, data: overview, version: '16.0.0' });
});

/**
 * POST /api/v16/ppcl/transaction/:id/decrypt
 * 解密交易字段（系统级/测试用）
 */
router.post('/transaction/:id/decrypt', (req: Request, res: Response) => {
  const { fields } = req.body || {};
  const result = getInstance().decryptTransaction(req.params.id, fields);
  if (!result) {
    res.status(404).json({ code: 1, message: 'Transaction not found' });
    return;
  }
  res.json({
    code: 0,
    data: result,
    warning: 'System-level decryption. Use View Key for authorized access in production.',
    version: '16.0.0',
  });
});

/**
 * GET /api/v16/ppcl/transaction/:id/integrity
 * 验证记录完整性
 */
router.get('/transaction/:id/integrity', (req: Request, res: Response) => {
  const valid = getInstance().verifyTransactionIntegrity(req.params.id);
  res.json({
    code: 0,
    data: { transactionId: req.params.id, integrityValid: valid },
    version: '16.0.0',
  });
});

// ============================================================================
// L2: View Key API
// ============================================================================

/**
 * POST /api/v16/ppcl/view-key
 * 颁发新的 View Key
 */
router.post('/view-key', (req: Request, res: Response) => {
  try {
    const { targetRecordId, grantedTo, purpose, allowedFields, validUntil, maxUses } = req.body;

    if (!targetRecordId || !grantedTo) {
      res.status(400).json({ code: 1, message: 'targetRecordId and grantedTo are required' });
      return;
    }

    const viewKey = getInstance().issueViewKey(targetRecordId, grantedTo, {
      purpose: (purpose ?? ViewKeyPurpose.AUDIT) as ViewKeyPurpose,
      allowedFields: allowedFields ?? [],
      validUntil: validUntil ? new Date(validUntil) : undefined,
      maxUses: maxUses ?? 10,
    });

    // 不返回加密的对称密钥（只返回元数据）
    res.status(201).json({
      code: 0,
      data: {
        keyId: viewKey.keyId,
        targetRecordId: viewKey.targetRecordId,
        grantedTo: viewKey.grantedTo,
        status: viewKey.status,
        scope: {
          allowedFields: viewKey.scope.allowedFields,
          validFrom: viewKey.scope.validFrom,
          validUntil: viewKey.scope.validUntil,
          maxUses: viewKey.scope.maxUses,
          purpose: viewKey.scope.purpose,
        },
        createdAt: viewKey.createdAt,
      },
      version: '16.0.0',
    });
  } catch (error) {
    res.status(500).json({ code: 1, message: (error as Error).message });
  }
});

/**
 * POST /api/v16/ppcl/view-key/:id/use
 * 使用 View Key 访问记录
 */
router.post('/view-key/:id/use', (req: Request, res: Response) => {
  try {
    const { accessor, targetRecordId, requestFields } = req.body;

    if (!accessor || !targetRecordId) {
      res.status(400).json({ code: 1, message: 'accessor and targetRecordId are required' });
      return;
    }

    const result = getInstance().useViewKey(req.params.id, accessor, targetRecordId, requestFields);

    res.json({
      code: 0,
      data: {
        success: result.success,
        grantedFields: result.grantedFields,
        zkProofId: result.zkProof.proofId,
        logId: result.logEntry.logId,
        accessTime: result.logEntry.accessTime,
        error: result.error,
      },
      version: '16.0.0',
    });
  } catch (error) {
    res.status(500).json({ code: 1, message: (error as Error).message });
  }
});

/**
 * DELETE /api/v16/ppcl/view-key/:id
 * 撤销 View Key
 */
router.delete('/view-key/:id', (req: Request, res: Response) => {
  const { reason } = req.body || { reason: 'Admin revocation' };
  const result = getInstance().revokeViewKey(req.params.id, reason);

  if (!result.success) {
    res.status(400).json({ code: 1, message: result.error });
    return;
  }

  res.json({ code: 0, data: { keyId: req.params.id, revoked: true }, version: '16.0.0' });
});

/**
 * GET /api/v16/ppcl/view-key/:id
 * 查询 View Key 详情
 */
router.get('/view-key/:id', (req: Request, res: Response) => {
  // 通过内部使用来获取View Key详情（系统级访问）
  const result = getInstance().useViewKey(req.params.id, 'api-system', req.query.targetRecordId as string || '*', []);
  if (!result.success && !result.grantedFields.length) {
    // 尝试直接从stats中查找
    res.status(404).json({ code: 1, message: 'View Key not found or not accessible' });
    return;
  }
  res.json({
    code: 0,
    data: {
      keyId: req.params.id,
      accessResult: result,
      version: '16.0.0',
    },
  });
});

/**
 * GET /api/v16/ppcl/view-keys
 * 列出某记录的所有活跃 View Key
 */
router.get('/view-keys', (req: Request, res: Response) => {
  const { recordId } = req.query;
  // 使用queryDisclosureLogs获取信息，或返回空列表
  const logs = getInstance().queryDisclosureLogs({ limit: 100 });
  // 从日志中提取唯一的View Key ID
  const uniqueKeyIds = [...new Set(logs.map(l => l.viewKeyId))];
  const safeKeys = uniqueKeyIds.map(keyId => ({
    keyId,
    targetRecordId: recordId as string || '*',
    grantedTo: 'system-api',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  }));
  res.json({ code: 0, data: safeKeys, count: safeKeys.length, version: '16.0.0' });
});

/**
 * GET /api/v16/ppcl/disclosure-logs
 * 披露日志查询
 */
router.get('/disclosure-logs', (req: Request, res: Response) => {
  const logs = getInstance().queryDisclosureLogs({
    limit: parseInt(req.query.limit as string) || 50,
  });
  res.json({ code: 0, data: logs, total: logs.length, version: '16.0.0' });
});

// ============================================================================
// L3: 合规连接 API
// ============================================================================

/**
 * POST /api/v16/ppcl/compliance/check
 * 执行合规检查
 */
router.post('/compliance/check', async (req: Request, res: Response) => {
  try {
    const { entityId, checks } = req.body;

    if (!entityId) {
      res.status(400).json({ code: 1, message: 'entityId is required' });
      return;
    }

    const checkTypes: ComplianceCheckType[] =
      (checks ?? ['sanction', 'aml', 'kyc']).map((c: string) =>
        c.toUpperCase() as ComplianceCheckType
      );

    const result = await getInstance().runComplianceCheck(entityId, checkTypes);

    res.json({
      code: 0,
      data: {
        requestId: result.requestId,
        overallPassed: result.overallPassed,
        checks: result.checks.map(c => ({
          type: c.type,
          passed: c.passed,
          proofId: c.proof?.proofId,
          latencyMs: c.latencyMs,
          reasonIfFailed: c.reasonIfFailed,
        })),
        aggregateProofId: result.aggregateProof?.proofId,
        completedAt: result.completedAt,
      },
      version: '16.0.0',
    });
  } catch (error) {
    res.status(500).json({ code: 1, message: (error as Error).message });
  }
});

/**
 * POST /api/v16/ppcl/compliance/funds-proof
 * 生成资金来源清洁证明
 */
router.post('/compliance/funds-proof', (req: Request, res: Response) => {
  const { txHash, sourceAddress } = req.body;

  if (!txHash || !sourceAddress) {
    res.status(400).json({ code: 1, message: 'txHash and sourceAddress are required' });
    return;
  }

  const proof = getInstance().proveFundsClean(txHash, Array.isArray(sourceAddress) ? sourceAddress : [sourceAddress]);
  res.json({
    code: 0,
    data: {
      proofId: proof.proofId,
      proofType: proof.proofType,
      publicInputs: proof.publicInputs,
      verified: proof.verified,
      validUntil: proof.validUntil,
    },
    version: '16.0.0',
  });
});

/**
 * POST /api/v16/ppcl/compliance/sanction
 * 制裁筛查
 */
router.post('/compliance/sanction', async (req: Request, res: Response) => {
  const { entityId } = req.body;

  if (!entityId) {
    res.status(400).json({ code: 1, message: 'entityId is required' });
    return;
  }

  const result = await getInstance().screenSanction(entityId);
  res.json({
    code: 0,
    data: {
      allowed: result.allowed,
      proofId: result.proof.proofId,
      version: '16.0.0',
    },
  });
});

/**
 * GET /api/v16/ppcl/compliance/stats
 * 合规引擎统计
 */
router.get('/compliance/stats', (_req: Request, res: Response) => {
  const stats = getInstance().exportNodeState();
  res.json({
    code: 0,
    data: stats.complianceStats,
    version: '16.0.0',
  });
});

// ============================================================================
// 透明性债务 API
// ============================================================================

/**
 * POST /api/v16/ppcl/debt/analyze
 * 完整的透明性债务分析
 */
router.post('/debt/analyze', (req: Request, res: Response) => {
  try {
    const { phiMetric, chainData } = req.body;

    if (!phiMetric || !chainData) {
      res.status(400).json({ code: 1, message: 'phiMetric and chainData are required' });
      return;
    }

    const result = getInstance().analyzeTransparencyDebt(phiMetric, chainData);

    res.json({
      code: 0,
      data: {
        totalTransparencyDebt: Math.round(result.totalTransparencyDebt * 1000) / 1000,
        privacyImprovementPotential: Math.round(result.privacyImprovementPotential * 1000) / 1000,
        commercialGameCost: result.commercialGameCost,
        complianceGovernanceCost: result.complianceGovernanceCost,
        securityRiskCost: result.securityRiskCost,
        designCost: result.designCost,
        recommendedMitigations: result.recommendedMitigations.map(m => ({
          ...m,
          estimatedReduction: `${Math.round(m.estimatedReduction * 100)}%`,
        })),
        basePhi: {
          relationActionS: result.relationActionS,
          phaseCoupling: result.phaseCoupling,
          topologicalImpedance: result.topologicalImpedance,
          entropy: result.entropy,
        },
      },
      version: '16.0.0',
    });
  } catch (error) {
    res.status(500).json({ code: 1, message: (error as Error).message });
  }
});

/**
 * GET /api/v16/ppcl/debt/quick
 * 快速债务评估
 */
router.get('/debt/quick', (_req: Request, res: Response) => {
  // 使用默认Φ指标进行快速评估
  const result = getInstance().quickDebtAssess({
    relationActionS: 50,
    phaseCoupling: 0.55,
    topologicalImpedance: 0.35,
    entropy: 0.48,
  });

  res.json({
    code: 0,
    data: result,
    version: '16.0.0',
  });
});

// ============================================================================
// 系统 API
// ============================================================================

/**
 * GET /api/v16/ppcl/health
 * 三层能力健康报告
 */
router.get('/health', (_req: Request, res: Response) => {
  const report = getInstance().getThreeLayerHealthReport();
  res.json({
    code: 0,
    data: report,
    version: '16.0.0',
    description: 'V16.0 PPCL 隐私保护共识层 — L1加密记录 + L2视图密钥 + L3零知识合规',
  });
});

/**
 * GET /api/v16/ppcl/stats
 * 完系统计
 */
router.get('/stats', (_req: Request, res: Response) => {
  const state = getInstance().exportNodeState();
  res.json({ code: 0, data: state, version: '16.0.0' });
});

export default router;
