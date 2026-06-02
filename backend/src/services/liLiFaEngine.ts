/**
 * liLiFaEngine — V14.0 情理法三层决策引擎（法·理·情）
 * 对应文章1 §1.2：太乙AGI双核集成（计算核 + 算计核）
 *
 * 三层决策架构:
 * - 法(Protocol)刚性契约: 硬性规则、法规、红线（不可违反）
 * - 理(Procedure)柔性流程: 优化目标、道义逻辑、可解释推理
 * - 情(Human-Override)中道余量: 人类 override、情境化裁量、特殊情况处理
 *
 * 太乙AGI双核:
 * - 计算核（机器）: 处理"理"层 — 最优解、概率推理、快速决策
 * - 算计核（人类）: 处理"情"层 — 道义、价值、中道智能
 * - "法"层: 双方共同遵守的硬性约束（Protocol）
 *
 * 中道智能逻辑: 法规 × 道义抉择
 *   - 当法规与道义冲突时，引入"中道余量"（情）进行情境化裁量
 *   - 参考: 中国式制度优势中的"情理法"治理逻辑
 */

import logger from '../utils/logger';

// =============== Types ===============

/**
 * 决策请求
 */
export interface DecisionRequest {
  id: string;
  timestamp: number;
  agentId: string;
  context: Record<string, unknown>;  // 决策上下文
  options: DecisionOption[];       // 可选项
  requiredLayer?: DecisionLayer;    // 强制使用某层
}

export interface DecisionOption {
  id: string;
  description: string;
  predictedOutcome: Record<string, unknown>;
  ruleCompliance: number;    // 法规合规度 (0-10000)
  moralScore: number;        // 道义得分 (0-10000)
  contextualFit: number;     // 情境适配度 (0-10000)
}

/**
 * 三层决策结果
 */
export interface DecisionResult {
  requestId: string;
  timestamp: number;
  selectedOptionId: string;
  layerUsed: DecisionLayer;
  reasoning: {
    faReasoning: string;      // 法层推理
    liReasoning: string;      // 理层推理
    qingReasoning: string;    // 情层推理
    syntheticJudgment: string; // 综合判断
  };
  confidence: number;         // 置信度 (0-10000)
  humanOverride: boolean;     // 是否被人类override
  overrideReason?: string;
  auditTrail: AuditEntry[];  // 审计轨迹
}

export enum DecisionLayer {
  FA = 'FA',     // 法: 刚性契约（Protocol规则）
  LI = 'LI',     // 理: 柔性流程（优化+道义）
  QING = 'QING', // 情: 中道余量（人类override）
}

export enum RuleType {
  HARD_CONSTRAINT = 'HARD_CONSTRAINT', // 硬约束（不可违反）
  SOFT_PREFERENCE = 'SOFT_PREFERENCE', // 软偏好（可权衡）
  MORAL_PRINCIPLE = 'MORAL_PRINCIPLE', // 道义原则
  CONTEXTUAL_EXCEPTION = 'CONTEXTUAL_EXCEPTION', // 情境例外
}

export interface Rule {
  id: string;
  type: RuleType;
  description: string;
  condition: string;    // 条件表达式
  weight: number;        // 权重 (0-10000)
  source: 'PROTOCOL' | 'LAW' | 'MORAL' | 'HUMAN_OVERRIDE';
}

export interface AuditEntry {
  timestamp: number;
  layer: DecisionLayer;
  action: string;
  reasoning: string;
  ruleIds: string[];
}

// =============== Engine ===============

class LiLiFaEngine {
  private rules: Map<string, Rule> = new Map();
  private decisions: Map<string, DecisionResult> = new Map();
  private readonly QING_OVERRIDE_THRESHOLD = 7000; // 情境适配度>7000时触发情层
  private readonly MORAL_CONFLICT_THRESHOLD = 3000; // 道义冲突阈值

  // ------ 核心决策入口 ------

  /**
   * 三层决策（法·理·情）
   */
  decide(request: DecisionRequest): DecisionResult {
    const startTime = Date.now();
    const auditTrail: AuditEntry[] = [];

    logger.info(`[LiLiFa] Decision STARTED: request=${request.id}, agent=${request.agentId}, options=${request.options.length}`);

    // === 第一层：法(FA) — 刚性契约 ===
    const faResult = this.evaluateFaLayer(request, auditTrail);
    auditTrail.push(...faResult.audit);

    // 如果法层有硬性违规，直接拒绝
    if (faResult.violatedHardConstraints.length > 0) {
      logger.warn(`[LiLiFa] HARD CONSTRAINT VIOLATED: ${faResult.violatedHardConstraints.join(', ')}`);
      return this.buildResult(request, faResult, DecisionLayer.FA, auditTrail);
    }

    // === 第二层：理(LI) — 柔性流程 ===
    const liResult = this.evaluateLiLayer(request, faResult, auditTrail);
    auditTrail.push(...liResult.audit);

    // === 第三层：情(QING) — 中道余量 ===
    // 触发条件: 1) 道义冲突 2) 情境适配度>阈值 3) 明确要求人类override
    const needQing = this.needQingLayer(liResult, request);

    if (needQing || request.requiredLayer === DecisionLayer.QING) {
      const qingResult = this.evaluateQingLayer(request, liResult, auditTrail);
      auditTrail.push(...qingResult.audit);
      return this.buildResult(request, qingResult, DecisionLayer.QING, auditTrail);
    }

    // 默认返回理层结果
    const result = this.buildResult(request, liResult, DecisionLayer.LI, auditTrail);
    logger.info(`[LiLiFa] Decision COMPLETED: request=${request.id}, layer=${DecisionLayer.LI}, elapsed=${Date.now() - startTime}ms`);
    return result;
  }

  // ------ 法层（刚性契约）------

  /**
   * 法层: 硬性规则、法规、红线
   * 对应: Protocol 层 — 不可违反的契约
   */
  private evaluateFaLayer(request: DecisionRequest, auditTrail: AuditEntry[]): FaLayerResult {
    const violatedHardConstraints: string[] = [];
    const passedRules: string[] = [];

    for (const rule of this.getRulesByType(RuleType.HARD_CONSTRAINT)) {
      const satisfied = this.evaluateRule(rule, request.context);
      if (!satisfied) {
        violatedHardConstraints.push(rule.id);
        auditTrail.push({
          timestamp: Date.now(),
          layer: DecisionLayer.FA,
          action: `Rule ${rule.id} VIOLATED`,
          reasoning: rule.description,
          ruleIds: [rule.id],
        });
      } else {
        passedRules.push(rule.id);
      }
    }

    return { violatedHardConstraints, passedRules, audit: [] };
  }

  // ------ 理层（柔性流程）------

  /**
   * 理层: 优化目标、道义逻辑、可解释推理
   * 对应: 计算核（机器）— 最优解、概率推理
   */
  private evaluateLiLayer(
    request: DecisionRequest,
    faResult: FaLayerResult,
    auditTrail: AuditEntry[],
  ): LiLayerResult {
    // 过滤掉违反法层的选项
    const eligibleOptions = request.options.filter(opt => {
      const violations = faResult.violatedHardConstraints.length === 0;
      return violations;
    });

    if (eligibleOptions.length === 0) {
      // 所有选项都违反法层，触发情层
      return {
        selectedOptionId: request.options[0]?.id || '',
        score: 0,
        moralConflict: true,
        audit: [],
      };
    }

    // 计算每个选项的理层得分
    let bestOption = eligibleOptions[0];
    let bestScore = -Infinity;

    for (const opt of eligibleOptions) {
      const ruleScore = opt.ruleCompliance / 10000;
      const moralScore = opt.moralScore / 10000;
      const efficiencyScore = this.calculateEfficiency(opt, request.context);

      // 理层综合得分: 合规×道义×效率
      const score = ruleScore * 0.4 + moralScore * 0.3 + efficiencyScore * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestOption = opt;
      }
    }

    const moralConflict = this.detectMoralConflict(eligibleOptions);

    auditTrail.push({
      timestamp: Date.now(),
      layer: DecisionLayer.LI,
      action: `Selected option ${bestOption.id} with score ${bestScore}`,
      reasoning: `Rule compliance: ${bestOption.ruleCompliance}/10000, Moral: ${bestOption.moralScore}/10000`,
      ruleIds: [],
    });

    return {
      selectedOptionId: bestOption.id,
      score: bestScore,
      moralConflict,
      audit: [],
    };
  }

  // ------ 情层（中道余量）------

  /**
   * 情层: 人类 override、情境化裁量、中道智能
   * 对应: 算计核（人类）— 道义、价值、中道
   *
   * 中道智能逻辑: 法规 × 道义抉择
   *   - 当法规与道义冲突时，引入"中道余量"（情）进行情境化裁量
   */
  private evaluateQingLayer(
    request: DecisionRequest,
    liResult: LiLayerResult,
    auditTrail: AuditEntry[],
  ): QingLayerResult {
    // 情层：引入人类 judgment
    const humanOverride = request.context.humanOverride as boolean || false;
    let finalOptionId = liResult.selectedOptionId;
    let overrideReason: string | undefined;

    if (humanOverride) {
      // 人类明确 override
      finalOptionId = request.context.humanSelect as string || finalOptionId;
      overrideReason = request.context.overrideReason as string || 'Human override';
      logger.info(`[LiLiFa] Human OVERRIDE: ${overrideReason}`);
    } else if (liResult.moralConflict) {
      // 道义冲突 — 中道裁量
      overrideReason = 'Moral conflict detected, applying 中道裁量';
      // 在中道逻辑下重新评估
      finalOptionId = this.applyZhongdaoLogic(request, liResult);
      logger.info(`[LiLiFa] 中道裁量 APPLIED: selected=${finalOptionId}`);
    } else {
      // 检查情境适配度
      const bestOption = request.options.find(o => o.id === liResult.selectedOptionId);
      if (bestOption && bestOption.contextualFit > this.QING_OVERRIDE_THRESHOLD) {
        overrideReason = `High contextual fit (${bestOption.contextualFit}), applying contextual discretion`;
        // 情境化裁量：微调决策
        finalOptionId = this.applyContextualDiscretion(request, bestOption);
      }
    }

    auditTrail.push({
      timestamp: Date.now(),
      layer: DecisionLayer.QING,
      action: `Final decision: ${finalOptionId}${overrideReason ? ` (${overrideReason})` : ''}`,
      reasoning: '中道智能：法规×道义×情境',
      ruleIds: [],
    });

    return {
      selectedOptionId: finalOptionId,
      humanOverride,
      overrideReason,
      audit: [],
    };
  }

  // ------ 辅助方法 ------

  private needQingLayer(liResult: LiLayerResult, request: DecisionRequest): boolean {
    if (request.requiredLayer === DecisionLayer.QING) return true;
    if (liResult.moralConflict) return true;
    const bestOption = request.options.find(o => o.id === liResult.selectedOptionId);
    if (bestOption && bestOption.contextualFit > this.QING_OVERRIDE_THRESHOLD) return true;
    return false;
  }

  private evaluateRule(rule: Rule, context: Record<string, unknown>): boolean {
    // 简化：实际应使用表达式求值器
    try {
      // TODO: 使用安全的表达式求值（如 jsonata 或自定义 DSL）
      return true; // 默认通过
    } catch {
      return false;
    }
  }

  private calculateEfficiency(opt: DecisionOption, context: Record<string, unknown>): number {
    // 简化：基于 predictedOutcome 计算效率
    const outcome = opt.predictedOutcome;
    if (outcome.efficiency !== undefined) return Number(outcome.efficiency) / 10000;
    return 0.5;
  }

  private detectMoralConflict(options: DecisionOption[]): boolean {
    const scores = options.map(o => o.moralScore);
    const maxDiff = Math.max(...scores) - Math.min(...scores);
    return maxDiff > this.MORAL_CONFLICT_THRESHOLD;
  }

  /**
   * 中道逻辑: 法规 × 道义 × 情境
   * 当法规与道义冲突时，寻找"中道余量"
   */
  private applyZhongdaoLogic(request: DecisionRequest, liResult: LiLayerResult): string {
    // 找到道义得分最高且法规合规的选项
    const withMoralScore = request.options
      .filter(o => o.ruleCompliance > 5000) // 基本合规
      .sort((a, b) => b.moralScore - a.moralScore);
    return withMoralScore[0]?.id || liResult.selectedOptionId;
  }

  private applyContextualDiscretion(request: DecisionRequest, option: DecisionOption): string {
    // 情境化裁量：在原有选项基础上微调
    // 简化：返回原选项
    return option.id;
  }

  private buildResult(
    request: DecisionRequest,
    layerResult: any,
    layer: DecisionLayer,
    auditTrail: AuditEntry[],
  ): DecisionResult {
    const selectedId = layerResult.selectedOptionId || layerResult.finalOptionId || request.options[0]?.id || '';
    const option = request.options.find(o => o.id === selectedId);

    return {
      requestId: request.id,
      timestamp: Date.now(),
      selectedOptionId: selectedId,
      layerUsed: layer,
      reasoning: {
        faReasoning: `法层: ${layerResult.passedRules?.length || 0} rules passed, ${layerResult.violatedHardConstraints?.length || 0} violated`,
        liReasoning: `理层: selected ${selectedId} with compliance=${option?.ruleCompliance}/10000, moral=${option?.moralScore}/10000`,
        qingReasoning: layerResult.humanOverride ? `情层: 人类override — ${layerResult.overrideReason}` : '情层: 无需override',
        syntheticJudgment: this.synthesizeJudgment(layer, option),
      },
      confidence: option ? (option.ruleCompliance + option.moralScore) / 20000 : 0.5,
      humanOverride: layerResult.humanOverride || false,
      overrideReason: layerResult.overrideReason,
      auditTrail,
    };
  }

  private synthesizeJudgment(layer: DecisionLayer, option?: DecisionOption): string {
    switch (layer) {
      case DecisionLayer.FA:
        return `决策基于刚性法规，不可违反。`;
      case DecisionLayer.LI:
        return `决策基于优化目标与道义逻辑，合规度${option?.ruleCompliance}/10000。`;
      case DecisionLayer.QING:
        return `决策引入中道余量，进行情境化裁量。`;
      default:
        return '决策完成。';
    }
  }

  // ------ 规则管理 ------

  addRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
    logger.info(`[LiLiFa] Rule ADDED: id=${rule.id}, type=${rule.type}`);
  }

  getRulesByType(type: RuleType): Rule[] {
    return Array.from(this.rules.values()).filter(r => r.type === type);
  }

  // ------ 查询方法 ------

  getDecision(requestId: string): DecisionResult | null {
    return this.decisions.get(requestId) || null;
  }

  getStats(): Record<string, unknown> {
    const decisions = Array.from(this.decisions.values());
    return {
      totalDecisions: decisions.length,
      byLayer: {
        [DecisionLayer.FA]: decisions.filter(d => d.layerUsed === DecisionLayer.FA).length,
        [DecisionLayer.LI]: decisions.filter(d => d.layerUsed === DecisionLayer.LI).length,
        [DecisionLayer.QING]: decisions.filter(d => d.layerUsed === DecisionLayer.QING).length,
      },
      humanOverrideRate: decisions.length > 0
        ? decisions.filter(d => d.humanOverride).length / decisions.length
        : 0,
      avgConfidence: decisions.length > 0
        ? decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length
        : 0,
      totalRules: this.rules.size,
    };
  }
}

// =============== Types for internal use ===============

interface FaLayerResult {
  violatedHardConstraints: string[];
  passedRules: string[];
  audit: AuditEntry[];
}

interface LiLayerResult {
  selectedOptionId: string;
  score: number;
  moralConflict: boolean;
  audit: AuditEntry[];
}

interface QingLayerResult {
  selectedOptionId: string;
  humanOverride: boolean;
  overrideReason?: string;
  audit: AuditEntry[];
}

const liLiFaEngine = new LiLiFaEngine();
export { liLiFaEngine };
