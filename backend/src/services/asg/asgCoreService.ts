/**
 * ASG (Agent Security Gateway) 编排层
 *
 * 统一入口，协调6个核心引擎的完整操作生命周期：
 *   AgentOperationRequest
 *     → L1 IdentityRegistry.verify()
 *     → L2 PolicySandboxEngine.evaluate()
 *     → L3 TransactionGatePipeline.runFullPipeline()
 *       → [需要HITL?]
 *         → L4 HumanInLoopService.createHitlRequest()
 *           → 用户approve/reject
 *       → [通过]
 *         → L5 TeeKeyManager.sign() — TEE内签名
 *         → L6 EconomicSafetyPool.recordExecution()
 *     → 返回AgentOperationResponse
 *
 * @version V17.0
 */

import {
  AgentOperationRequest,
  AgentOperationResponse,
  ASGSystemState,
  FullGatePipelineResult,
} from './types';

import { AgentIdentityRegistry, getInstance as getRegistry } from './agentIdentityRegistry';
import { PolicySandboxEngine, getInstance as getPolicyEngine } from './policySandboxEngine';
import { TransactionGatePipeline, getInstance as getGatePipeline } from './transactionGatePipeline';
import { HumanInLoopService, getInstance as getHitlService } from './humanInLoopService';
import { TeeKeyManager, getInstance as getTeeKeyMgr } from './teeKeyManager';
import { EconomicSafetyPool, getInstance as getEcoPool } from './economicSafetyPool';

// ============================================================================
// ASGCoreService 类
// ============================================================================

export class ASGCoreService {
  private readonly registry: AgentIdentityRegistry;
  private readonly policyEngine: PolicySandboxEngine;
  private readonly gatePipeline: TransactionGatePipeline;
  private readonly hitlService: HumanInLoopService;
  private readonly teeKeyMgr: TeeKeyManager;
  private readonly ecoPool: EconomicSafetyPool;

  // 每日请求计数器（用于系统状态）
  private todayRequests: number = 0;
  private todayGatePassed: number = 0;
  private todayDate: string = '';

  constructor(
    registry?: AgentIdentityRegistry,
    policyEngine?: PolicySandboxEngine,
    gatePipeline?: TransactionGatePipeline,
    hitlService?: HumanInLoopService,
    teeKeyMgr?: TeeKeyManager,
    ecoPool?: EconomicSafetyPool,
  ) {
    this.registry = registry || getRegistry();
    this.policyEngine = policyEngine || getPolicyEngine();
    this.gatePipeline = gatePipeline || getGatePipeline();
    this.hitlService = hitlService || getHitlService();
    this.teeKeyMgr = teeKeyMgr || getTeeKeyMgr();
    this.ecoPool = ecoPool || getEcoPool();
    this.resetDailyIfNeeded();
  }

  /**
   * 执行完整的Agent操作生命周期
   *
   * 这是ASG的主入口方法——所有AI Agent的链上操作必须经过此方法
   */
  async executeOperation(request: AgentOperationRequest): Promise<AgentOperationResponse> {
    const startTime = Date.now();

    this.resetDailyIfNeeded();
    this.todayRequests++;

    try {
      // ===== 阶段0: 身份验证 (L1) =====
      const agent = this.registry.getAgent(request.agentDid);
      if (!agent) {
        return this.buildErrorResponse(request, 'error', 'Agent not registered');
      }

      if (
        agent.status === 'suspended' ||
        agent.status === 'revoked' ||
        agent.status === 'frozen'
      ) {
        return this.buildErrorResponse(request, 'error', `Agent status: ${agent.status}`);
      }

      // PoH验证
      if (!this.registry.verifyPoh(request.agentDid)) {
        return this.buildErrorResponse(request, 'error', 'Proof of Human expired');
      }

      // ===== 阶段1: 策略评估 (L2) =====
      const policyResult = this.policyEngine.evaluate(
        request,
        agent.currentPolicy,
        agent.status,
      );

      if (!policyResult.allowed && !policyResult.hitlTrigger) {
        // 策略硬拒绝
        this.registry.recordOperation(request.agentDid, false);
        return this.buildGateRejectedResponse(
          request,
          undefined,          // no gate result yet
          policyResult.denialReason || 'POLICY_VIOLATION',
          startTime,
        );
      }

      // ===== 阶段2: 门控管线 (L3) =====
      // 即使策略允许，仍需通过三重安全门控
      const gateResult = await this.gatePipeline.runFullPipeline(request);

      if (!gateResult.overallPassed) {
        this.registry.recordOperation(request.agentDid, false);
        return this.buildGateRejectedResponse(
          request,
          gateResult,
          gateResult.simulation.reasonCode ||
          gateResult.threatScan.reasonCode ||
          'GATE_REJECTED',
          startTime,
        );
      }

      this.todayGatePassed++;

      // ===== 阶段3: HITL判定 (L4) =====
      if (
        !request.forceHitl &&              // 未强制HITL
        policyResult.hitlTrigger ||        // 策略触发
        gateResult.requiresHitlEscalation   // 门控升级
      ) {
        const hitlReq = await this.hitlService.createHitlRequest({
          agentDid: request.agentDid,
          transactionId: gateResult.transactionId,
          gateResult,
          triggeredCondition:
            policyResult.hitlTrigger || {
              triggerId: `auto_gate_${Date.now()}`,
              conditionType: 'high_risk_score',
              requiredAction: 'approve',
            },
          userSummary: {
            title: `${request.operationType} 操作待确认`,
            description: `Agent ${agent.displayName} 请求在 ${request.targetProtocol} 上执行 ${request.operationType}`,
            amount: request.assetMovements
              .filter((m) => m.direction === 'out')
              .map((m) => `${m.amount} ${m.asset}`)
              .join(' + ') || 'N/A',
            riskLevel: gateResult.aggregateRiskScore >= 8 ? 'CRITICAL'
              : gateResult.aggregateRiskScore >= 5 ? 'HIGH'
              : gateResult.aggregateRiskScore >= 3 ? 'MEDIUM'
              : 'LOW',
          },
        });

        // HITL流程：返回等待用户响应的状态
        this.registry.recordOperation(request.agentDid, false); // 暂时记为未完成
        return {
          requestId: request.requestId,
          operationType: request.operationType,
          finalStatus: 'hitl_pending',
          gateResult,
          hitlFlow: hitlReq,
          totalLatencyMs: Date.now() - startTime,
          completedAt: new Date(),
        } as unknown as AgentOperationResponse;
      }

      // Guard模式下始终要求HITL
      if (agent.currentPolicy.mode === 'guard') {
        const hitlReq = await this.hitlService.createHitlRequest({
          agentDid: request.agentDid,
          transactionId: gateResult.transactionId,
          gateResult,
          triggeredCondition: {
            triggerId: `guard_mode_${Date.now()}`,
            conditionType: 'manual_override',
            requiredAction: 'approve',
          },
          userSummary: {
            title: `[GUARD] ${request.operationType} 待审批`,
            description: `Guard模式：${agent.displayName} 的操作需人工确认`,
            amount: request.assetMovements
              .filter((m) => m.direction === 'out')
              .map((m) => `${m.amount} ${m.asset}`)
              .join(' + ') || 'N/A',
            riskLevel: 'LOW',
          },
        });

        return {
          requestId: request.requestId,
          operationType: request.operationType,
          finalStatus: 'hitl_pending',
          gateResult,
          hitlFlow: hitlReq,
          totalLatencyMs: Date.now() - startTime,
          completedAt: new Date(),
        } as unknown as AgentOperationResponse;
      }

      // ===== 阶段4: TEE签名 + 执行 (L5) =====

      // 获取或创建TEE密钥
      let signingKeys = this.teeKeyMgr.listKeysByAgent(request.agentDid);
      let signingKey = signingKeys.find((k) => k.keyType === 'signing');

      if (!signingKey) {
        signingKey = this.teeKeyMgr.generateKeyForAgent(request.agentDid, 'signing');
      }

      // 在TEE中签名交易（模拟）
      const txHash = `${gateResult.transactionId}_signed_${Date.now().toString(36)}`;

      // 记录消费
      const totalOut = request.assetMovements
        .filter((m) => m.direction === 'out')
        .reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
      this.policyEngine.confirmSpending(request.agentDid, totalOut);

      // 更新Agent统计
      this.registry.recordOperation(request.agentDid, true);

      // ===== 完成 =====
      return {
        requestId: request.requestId,
        operationType: request.operationType,
        finalStatus: 'executed',
        gateResult,
        onChainResult: {
          txHash,
          blockNumber: Math.floor(Date.now() / 12_000), // ~12s per block (Ethereum)
          gasUsed: gateResult.simulation.estimatedGasUsed,
          actualOutput: gateResult.simulation.estimatedOutput,
        },
        totalLatencyMs: Date.now() - startTime,
        completedAt: new Date(),
      };
    } catch (error) {
      console.error('[ASG] Operation execution error:', error);
      this.registry.recordOperation(request.agentDid, false);
      return this.buildErrorResponse(request, 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * 处理HITL响应后的交易执行
   */
  async continueAfterHITL(hitlRequestId: string): Promise<AgentOperationResponse | null> {
    const req = this.hitlService.getRequest(hitlRequestId);
    if (!req || req.status !== 'approved') return null;

    // 从HITL请求中恢复原始信息并继续执行
    const mockRequest: AgentOperationRequest = {
      requestId: `resume_${hitlRequestId}`,
      agentDid: req.agentDid,
      operationType: 'resumed_operation',
      params: {},
      targetProtocol: '',
      assetMovements: [],
      maxLatencyMs: 30_000,
      forceHitl: false,
      submittedAt: req.createdAt,
    };

    return this.executeOperation(mockRequest);
  }

  /**
   * 获取ASG完整系统状态
   */
  getSystemState(): ASGSystemState {
    this.resetDailyIfNeeded();

    const registryStats = this.registry.getStats();
    const policyStats = this.policyEngine.getStats();
    const gateStats = this.gatePipeline.getStats();
    const hitlStats = this.hitlService.getStats();
    const teeStats = this.teeKeyMgr.getStats();
    const ecoStats = this.ecoPool.getPoolStats();

    return {
      totalAgents: registryStats.totalAgents,
      activeAgents: registryStats.activeAgents,
      todayTotalRequests: this.todayRequests,
      todayGatePassed: this.todayGatePassed,
      todayHitlRequests: hitlStats.totalRequests - (registryStats.totalAgents > 0 ? 0 : hitlStats.totalRequests),
      avgHitlResponseMs: hitlStats.avgResponseMs,
      gateRejectionRate: gateStats.passRate > 0 ? 1 - gateStats.passRate : 0,
      riskTrend24h: this.generateRiskTrend(gateStats),
      economicPool: ecoStats,
      teeKeyStats: {
        totalKeys: teeStats.totalKeys,
        activeKeys: teeStats.activeKeys,
        exportedKeys: teeStats.exportedKeys,
      },
    };
  }

  /** 快速健康检查 */
  healthCheck(): {
    status: string;
    version: string;
    uptime: number;
    components: Record<string, boolean>;
  } {
    return {
      status: 'operational',
      version: '17.0.0',
      uptime: process.uptime?.() ?? 0,
      components: {
        identityRegistry: !!this.registry,
        policySandbox: !!this.policyEngine,
        gatePipeline: !!this.gatePipeline,
        hitlService: !!this.hitlService,
        teeKeyManager: !!this.teeKeyMgr,
        economicPool: !!this.ecoPool,
      },
    };
  }

  // ========================================================================
  // 内部方法
  // ========================================================================

  private buildErrorResponse(
    request: AgentOperationRequest,
    status: AgentOperationResponse['finalStatus'],
    errorMsg: string,
  ): AgentOperationResponse {
    return {
      requestId: request.requestId,
      operationType: request.operationType,
      finalStatus: status,
      totalLatencyMs: 0,
      completedAt: new Date(),
    };
  }

  private buildGateRejectedResponse(
    request: AgentOperationRequest,
    gateResult: FullGatePipelineResult | undefined,
    reasonCode: string,
    startTime: number,
  ): AgentOperationResponse {
    return {
      requestId: request.requestId,
      operationType: request.operationType,
      finalStatus: 'gate_rejected',
      ...(gateResult ? { gateResult } : {}),
      totalLatencyMs: Date.now() - startTime,
      completedAt: new Date(),
    };
  }

  private resetDailyIfNeeded(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.todayDate !== today) {
      this.todayDate = today;
      this.todayRequests = 0;
      this.todayGatePassed = 0;
    }
  }

  private generateRiskTrend(gateStats: ReturnType<TransactionGatePipeline['getStats']>): ASGSystemState['riskTrend24h'] {
    // 基于门控统计生成模拟风险趋势
    const baseScore = gateStats.rejectedCount > 0
      ? Math.min(10, 2 + gateStats.rejectedCount)
      : 1;

    const trend: ASGSystemState['riskTrend24h'] = [];
    for (let h = 0; h < 24; h++) {
      // 模拟：白天风险略高，夜间降低
      const isDaytime = h >= 8 && h <= 22;
      trend.push({
        hour: h,
        avgRiskScore: isDaytime
          ? Math.min(10, baseScore + Math.random() * 2)
          : Math.max(0, baseScore - 1 + Math.random()),
      });
    }
    return trend;
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let instance: ASGCoreService | null = null;

export function getInstance(): ASGCoreService {
  if (!instance) {
    instance = new ASGCoreService();
  }
  return instance;
}
