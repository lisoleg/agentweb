/**
 * L3: 交易门控管线 (Transaction Gate Pipeline)
 *
 * 基于MetaMask Agent Wallet的"三重审核管线"设计：
 *   阶段1: Simulation  — 链上交易模拟（预估gas/输出/滑点）
 *   阶段2: Threat Scan — 威胁扫描（Blockaid风格安全引擎）
 *   阶段3: MEV Protect — MEV防护（防夹子/三明治攻击）
 *
 * 设计模式：**串联安全门控 (Serial Security Gate)**
 * 任何一关未通过 → 交易直接被打回
 * 综合风险评分 = max(各阶段风险评分)
 *
 * @version V17.0
 */

import crypto from 'crypto';
import {
  GateStage,
  GateResult,
  SimulationResult,
  ThreatScanResult,
  MEVProtectionResult,
  FullGatePipelineResult,
  AgentOperationRequest,
} from './types';
import type { TransactionId } from '../oplc/types';

// ============================================================================
// 已知恶意合约库（模拟Blockaid数据库）
// ============================================================================

const KNOWN_MALICIOUS_CONTRACTS = new Set([
  // 模拟数据：实际应从Blockaid/Scam Sniffer等API实时获取
  '0xdead000000000000000000000000000000000000',
  '0xcafe000000000000000000000000000000000000',
]);

const PHISHING_DOMAINS = new Set([
  'malicious-wallet.xyz',
  'fake-claim-token.com',
]);

// ============================================================================
// 威胁模式规则库
// ============================================================================

interface ThreatRule {
  patternName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  check: (req: AgentOperationRequest) => { matched: boolean; confidence: number; description: string };
}

const THREAT_RULES: ThreatRule[] = [
  {
    patternName: 'unknown_protocol_risk',
    severity: 'MEDIUM',
    check: (req) => ({
      // 首次使用未知协议增加风险标记
      matched: req.targetProtocol.length < 10 || !req.targetProtocol.startsWith('0x'),
      confidence: 0.6,
      description: `Target protocol "${req.targetProtocol}" is unrecognized or non-standard`,
    }),
  },
  {
    patternName: 'large_single_transfer',
    severity: 'HIGH',
    check: (req) => {
      const totalOut = req.assetMovements
        .filter((m) => m.direction === 'out')
        .reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
      return {
        matched: totalOut > 100_000, // 超过100k单位
        confidence: 0.85,
        description: `Large single transfer detected: ${totalOut}`,
      };
    },
  },
  {
    patternName: 'multi_asset_outflow',
    severity: 'MEDIUM',
    check: (req) => {
      const outAssets = req.assetMovements.filter((m) => m.direction === 'out');
      return {
        matched: outAssets.length >= 3,
        confidence: 0.7,
        description: `Multi-asset outflow: ${outAssets.map((a) => a.asset).join(', ')}`,
      };
    },
  },
  {
    patternName: 'unusual_timing',
    severity: 'LOW',
    check: (req) => {
      const hour = new Date().getUTCHours();
      return {
        matched: hour >= 0 && hour <= 5, // 深夜操作
        confidence: 0.5,
        description: `Operation submitted during unusual hours (UTC ${hour}:00)`,
      };
    },
  },
];

// ============================================================================
// TransactionGatePipeline 类
// ============================================================================

export class TransactionGatePipeline {
  private pipelineStats = {
    totalPipelinesRun: 0,
    passedCount: 0,
    rejectedCount: 0,
    hitlEscalations: 0,
    stageStats: {
      simulation: { run: 0, failed: 0, avgMs: 0 },
      threatScan: { run: 0, flagged: 0, avgMs: 0 },
      mevProtection: { run: 0, risksDetected: 0, avgMs: 0 },
    },
    totalPipelineMs: 0,
  };

  /**
   * 执行完整的三重门控管线
   *
   * 这是ASG的核心安全机制——每个操作请求必须通过全部三关
   */
  async runFullPipeline(
    request: AgentOperationRequest,
    txId?: TransactionId,
  ): Promise<FullGatePipelineResult> {
    const startTime = Date.now();
    this.pipelineStats.totalPipelinesRun++;
    const transactionId = txId || this.generateTxId(request);

    // ===== 阶段1: 模拟执行 =====
    const simulation = await this.runSimulation(request, transactionId);
    if (!simulation.passed) {
      return this.buildFinalResult(transactionId, request.agentDid, false, {
        simulation,
        threatScan: this.emptyThreatResult(),
        mevProtection: this.emptyMevResult(),
        aggregateRiskScore: simulation.riskScore,
        requiresHitlEscalation: true,
        totalLatencyMs: Date.now() - startTime,
      });
    }

    // ===== 阶段2: 威胁扫描 =====
    const threatScan = await this.runThreatScan(request, transactionId);
    if (!threatScan.passed) {
      return this.buildFinalResult(transactionId, request.agentDid, false, {
        simulation,
        threatScan,
        mevProtection: this.emptyMevResult(),
        aggregateRiskScore: Math.max(simulation.riskScore, threatScan.riskScore),
        requiresHitlEscalation: true,
        totalLatencyMs: Date.now() - startTime,
      });
    }

    // ===== 阶段3: MEV防护 =====
    const mevProtection = await this.runMEVProtection(request, transactionId);
    if (!mevProtection.passed) {
      return this.buildFinalResult(transactionId, request.agentDid, false, {
        simulation,
        threatScan,
        mevProtection,
        aggregateRiskScore: Math.max(
          simulation.riskScore,
          threatScan.riskScore,
          mevProtection.riskScore
        ),
        requiresHitlEscalation: mevProtection.mevRiskDetected,
        totalLatencyMs: Date.now() - startTime,
      });
    }

    // ===== 全部通过 =====
    const aggregateRisk = Math.max(
      simulation.riskScore,
      threatScan.riskScore,
      mevProtection.riskScore
    );

    const requiresHITL = aggregateRisk >= 6; // 风险≥6自动升级到HITL

    if (requiresHITL) {
      this.pipelineStats.hitlEscalations++;
    } else {
      this.pipelineStats.passedCount++;
    }

    return this.buildFinalResult(transactionId, request.agentDid, true, {
      simulation,
      threatScan,
      mevProtection,
      aggregateRiskScore: aggregateRisk,
      requiresHitlEscalation: requiresHITL,
      totalLatencyMs: Date.now() - startTime,
    });
  }

  /**
   * 单独运行某个阶段（用于调试或特殊场景）
   */
  async runSingleStage(
    stage: GateStage,
    request: AgentOperationRequest,
  ): Promise<GateResult> {
    switch (stage) {
      case GateStage.SIMULATION:
        return this.runSimulation(request);
      case GateStage.THREAT_SCAN:
        return this.runThreatScan(request);
      case GateStage.MEV_PROTECTION:
        return this.runMEVProtection(request);
      default:
        return { stage, passed: false, riskScore: 10, latencyMs: 0, reasonCode: 'UNKNOWN_PROTOCOL' as const };
    }
  }

  /** 获取管线统计 */
  getStats() {
    return {
      ...this.pipelineStats,
      avgPipelineMs:
        this.pipelineStats.totalPipelinesRun > 0
          ? this.pipelineStats.totalPipelineMs / this.pipelineStats.totalPipelinesRun
          : 0,
      passRate:
        this.pipelineStats.totalPipelinesRun > 0
          ? this.pipelineStats.passedCount / this.pipelineStats.totalPipelinesRun
          : 0,
    };
  }

  // ========================================================================
  // 阶段1: 链上交易模拟
  // ========================================================================

  private async runSimulation(
    request: AgentOperationRequest,
    txId?: TransactionId,
  ): Promise<SimulationResult> {
    const start = Date.now();
    this.pipelineStats.stageStats.simulation.run++;

    try {
      // 模拟链上执行（生产环境使用tenderly/eth_call等）
      const totalOut = this.extractTotalOut(request);

      // 模拟结果计算
      const priceImpact = Math.min(5, totalOut / 50_000); // 简化模型
      const slippage = priceImpact * (0.8 + Math.random() * 0.4);
      const estimatedGasUsed = (150_000 + Math.floor(Math.random() * 200_000)).toString();

      // 输出估算（swap类操作的简化输出模型）
      const estimatedOutput = totalOut > 0
        ? (totalOut * (0.97 - slippage / 100)).toFixed(2)
        : '0';

      // 检查是否余额不足（模拟）
      const balanceSufficient = totalOut < 10_000_000; // 模拟大额上限

      if (!balanceSufficient) {
        this.pipelineStats.stageStats.simulation.failed++;
        return {
          stage: GateStage.SIMULATION,
          passed: false,
          reasonCode: 'INSUFFICIENT_BALANCE',
          riskScore: 8,
          latencyMs: Date.now() - start,
          estimatedGasUsed,
          estimatedOutput: '0',
          priceImpact: 0,
          slippage: 0,
        };
      }

      // 高滑点检测
      if (slippage > 3) {
        this.pipelineStats.stageStats.simulation.failed++;
        return {
          stage: GateStage.SIMULATION,
          passed: false,
          reasonCode: 'SLIPPAGE_TOO_HIGH',
          riskScore: Math.min(10, 4 + slippage),
          latencyMs: Date.now() - start,
          estimatedGasUsed,
          estimatedOutput,
          priceImpact,
          slippage,
        };
      }

      this.updateAvg('simulation', Date.now() - start);

      return {
        stage: GateStage.SIMULATION,
        passed: true,
        riskScore: Math.ceil(priceImpact * 1.5),
        latencyMs: Date.now() - start,
        estimatedGasUsed,
        estimatedOutput,
        priceImpact,
        slippage,
      };
    } catch (e) {
      return {
        stage: GateStage.SIMULATION,
        passed: false,
        reasonCode: 'SIMULATION_FAILED',
        riskScore: 9,
        latencyMs: Date.now() - start,
        estimatedGasUsed: '0',
        estimatedOutput: '0',
        priceImpact: 0,
        slippage: 0,
      };
    }
  }

  // ========================================================================
  // 阶段2: 威胁扫描（Blockaid风格）
  // ========================================================================

  private async runThreatScan(
    request: AgentOperationRequest,
    _txId?: TransactionId,
  ): Promise<ThreatScanResult> {
    const start = Date.now();
    this.pipelineStats.stageStats.threatScan.run++;

    const threats: ThreatScanResult['threatTypes'] = [];
    let maliciousContract = false;
    let phishing = false;
    const patterns: ThreatScanResult['suspiciousPatternMatches'] = [];
    let maxSeverity = 0;

    // 1. 恶意合约地址检测
    if (KNOWN_MALICIOUS_CONTRACTS.has(request.targetProtocol)) {
      threats.push('malicious_contract');
      maliciousContract = true;
      maxSeverity = Math.max(maxSeverity, 4);
    }

    // 2. 钓鱼域名检测（如果请求中包含URL参数）
    const urlParam = request.params?.targetUrl as string | undefined;
    if (urlParam && PHISHING_DOMAINS.has(new URL(urlParam).hostname)) {
      threats.push('private_key_compromise');
      phishing = true;
      maxSeverity = Math.max(maxSeverity, 4);
    }

    // 3. 行为模式匹配
    for (const rule of THREAT_RULES) {
      const result = rule.check(request);
      if (result.matched) {
        patterns.push({
          patternName: rule.patternName,
          severity: rule.severity,
          confidence: result.confidence,
          description: result.description,
        });

        const sevWeight = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
        maxSeverity = Math.max(maxSeverity, sevWeight[rule.severity]);
      }
    }

    if (patterns.some((p) => p.severity === 'CRITICAL')) {
      threats.push('social_engineering');
    }

    // 计算综合风险评分 (0~10)
    const baseRisk = Math.min(10, maxSeverity * 2);
    const patternBonus = patterns.reduce(
      (sum, p) => sum + p.confidence * (p.severity === 'CRITICAL' ? 3 : p.severity === 'HIGH' ? 2 : 1),
      0
    );
    const riskScore = Math.min(10, Math.round(baseRisk + patternBonus));

    const passed = riskScore < 7; // 风险<7才通过

    if (!passed) {
      this.pipelineStats.stageStats.threatScan.flagged++;
    }

    this.updateAvg('threatScan', Date.now() - start);

    return {
      stage: GateStage.THREAT_SCAN,
      passed,
      reasonCode: !passed ? ('SUSPICIOUS_PATTERN' as const) : undefined,
      riskScore,
      latencyMs: Date.now() - start,
      threatTypes: threats,
      maliciousContractDetected: maliciousContract,
      phishingDetected: phishing,
      suspiciousPatternMatches: patterns,
    };
  }

  // ========================================================================
  // 阶段3: MEV防护
  // ========================================================================

  private async runMEVProtection(
    request: AgentOperationRequest,
    _txId?: TransactionId,
  ): Promise<MEVProtectionResult> {
    const start = Date.now();
    this.pipelineStats.stageStats.mevProtection.run++;

    const totalAmount = this.extractTotalOut(request);
    let mevRiskDetected = false;

    // 简化的MEV风险评估模型
    // 实际实现应接入Flashbots/CoW Protocol等私有内存池
    let recommendedStrategy: MEVProtectionResult['recommendedStrategy'] = 'none_required';
    let estimatedMevLoss: number | undefined;

    // 大额交易有更高被夹子风险
    if (totalAmount > 50_000) {
      // 模拟MEV损失估算（基于交易金额和池子深度）
      const lossRatio = 0.001 + Math.random() * 0.003; // 0.1%~0.4%
      estimatedMevLoss = totalAmount * lossRatio;

      if (estimatedMevLoss > 100) {
        mevRiskDetected = true;
        recommendedStrategy = 'flashbots_bundle';
      }
    }

    // 多步操作容易被三明治
    if (request.assetMovements.length >= 4) {
      mevRiskDetected = true;
      if (recommendedStrategy === 'none_required') {
        recommendedStrategy = 'private_mempool';
      }
    }

    const riskScore = mevRiskDetected
      ? Math.min(10, 3 + Math.floor(totalAmount / 20_000))
      : 1;

    this.updateAvg('mevProtection', Date.now() - start);

    return {
      stage: GateStage.MEV_PROTECTION,
      passed: true, // MEV阶段通常不拒绝，仅标记和建议策略
      riskScore,
      latencyMs: Date.now() - start,
      mevRiskDetected,
      recommendedStrategy,
      estimatedMevLoss,
    };
  }

  // ========================================================================
  // 内部工具方法
  // ========================================================================

  private generateTxId(request: AgentOperationRequest): string {
    const data = JSON.stringify({
      agentDid: request.agentDid,
      operationType: request.operationType,
      targetProtocol: request.targetProtocol,
      timestamp: Date.now(),
    });

    return `0x${crypto.createHash('sha256').update(data).digest('hex').substring(0, 64)}` as TransactionId;
  }

  private extractTotalOut(request: AgentOperationRequest): number {
    return request.assetMovements
      .filter((m) => m.direction === 'out')
      .reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
  }

  private buildFinalResult(
    txId: string,
    agentDid: string,
    passed: boolean,
    details: Omit<FullGatePipelineResult, 'transactionId' | 'agentDid' | 'processedAt' | 'overallPassed'>,
  ): FullGatePipelineResult {
    if (!passed) {
      this.pipelineStats.rejectedCount++;
    }
    this.pipelineStats.totalPipelineMs += details.totalLatencyMs;

    return {
      transactionId: txId,
      agentDid,
      overallPassed: passed,
      ...details,
      processedAt: new Date(),
    };
  }

  private emptyThreatResult(): ThreatScanResult {
    return {
      stage: GateStage.THREAT_SCAN,
      passed: true,
      riskScore: 0,
      latencyMs: 0,
      threatTypes: [],
      maliciousContractDetected: false,
      phishingDetected: false,
      suspiciousPatternMatches: [],
    };
  }

  private emptyMevResult(): MEVProtectionResult {
    return {
      stage: GateStage.MEV_PROTECTION,
      passed: true,
      riskScore: 0,
      latencyMs: 0,
      mevRiskDetected: false,
      recommendedStrategy: 'none_required',
    };
  }

  private updateAvg(stage: 'simulation' | 'threatScan' | 'mevProtection', ms: number): void {
    const s = this.pipelineStats.stageStats[stage];
    s.avgMs = (s.avgMs * (s.run - 1) + ms) / s.run;
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let instance: TransactionGatePipeline | null = null;

export function getInstance(): TransactionGatePipeline {
  if (!instance) {
    instance = new TransactionGatePipeline();
  }
  return instance;
}
