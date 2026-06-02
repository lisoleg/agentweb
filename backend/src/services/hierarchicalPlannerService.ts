/**
 * HierarchicalPlannerService — V13.0 HG-STR 分层Planner服务
 * 借鉴HG-STR三层MDP分层决策架构
 *
 * 三层决策:
 * - L1 战略层(Macro): 全局态势 → Goal ∈ {Search, Engage, RTB, Observe}
 * - L2 战役层(Target Select): 局部观测 → Target ID (目标分配)
 * - L3 战术层(Action Param): 目标+自身状态 → 具体执行参数
 *
 * 核心优势: 避免Flat Policy在高维空间陷入局部最优(Local Optima)或死锁(Deadlock)
 * 层间绑定: ITA-Trigger在层间切换点触发预判型智能
 *
 * Algorithm 1: 太乙AGI分层Planner (受HG-STR启发)
 */

import logger from '../utils/logger';
import { itaTriggerEngine, TriggerPriority, TriggerStatus, InformationType, ThresholdType, ActionType, ActionStatus } from './itaTriggerEngine';

// =============== Types ===============

/**
 * L1 战略层目标
 */
export enum MacroGoal {
  SEARCH = 'SEARCH',           // 搜索/发现
  ENGAGE = 'ENGAGE',           // 交战/执行
  RTB = 'RTB',                 // 返回基地(Return To Base)
  OBSERVE = 'OBSERVE',         // 观察等待
  EMERGENCY = 'EMERGENCY',     // 紧急干预
  COLLABORATE = 'COLLABORATE', // 协同合作
  HIBERNATE = 'HIBERNATE',     // 休眠节能
}

/**
 * L2 战役层目标选择
 */
export interface TargetSelection {
  targetId: string;
  targetType: TargetType;
  priority: number;          // 0-1, 越高越优先
  riskScore: number;         // 0-1, 风险评分
  estimatedResources: number; // 预估资源消耗
  deadline: number;          // 截止时间戳
  constraints: string[];     // 约束条件
}

export enum TargetType {
  TASK = 'TASK',
  AGENT = 'AGENT',
  RESOURCE = 'RESOURCE',
  THREAT = 'THREAT',
  GOVERNANCE_ITEM = 'GOVERNANCE_ITEM',
  GC_ANOMALY = 'GC_ANOMALY',
}

/**
 * L3 战术层执行参数
 */
export interface ActionParams {
  actionType: PlanActionType;
  targetId: string;
  params: Record<string, unknown>;
  confidence: number;        // 0-1, 执行信心
  alternativeActions: AlternativeAction[];
  requiresApproval: boolean; // 是否需要人类确认
  estimatedDuration: number; // 预估执行时间(秒)
  rollbackPlan: string;      // 回滚方案
}

export enum PlanActionType {
  EXECUTE_TASK = 'EXECUTE_TASK',
  ALLOCATE_RESOURCE = 'ALLOCATE_RESOURCE',
  SEND_MESSAGE = 'SEND_MESSAGE',
  ADJUST_PRIORITY = 'ADJUST_PRIORITY',
  REQUEST_COLLABORATION = 'REQUEST_COLLABORATION',
  TRIGGER_ITA = 'TRIGGER_ITA',
  EMERGENCY_STOP = 'EMERGENCY_STOP',
  DELEGATE = 'DELEGATE',
  SELF_MODIFY = 'SELF_MODIFY',
}

export interface AlternativeAction {
  actionType: PlanActionType;
  params: Record<string, unknown>;
  confidence: number;
  reason: string;
}

/**
 * 全局态势 (L1输入)
 */
export interface GlobalSituation {
  agentId: string;
  /** Φ值综合评分 */
  phiScore: number;
  /** GC余额 */
  gcBalance: number;
  /** 代谢率 */
  metabolicRate: number;
  /** 活跃任务数 */
  activeTaskCount: number;
  /** 待处理威胁数 */
  pendingThreats: number;
  /** 可用协作Agent数 */
  availableCollaborators: number;
  /** 系统负载 */
  systemLoad: number;         // 0-1
  /** 信用评级 */
  creditRating: string;
  /** 最近违规数 */
  recentViolations: number;
  /** 上下文信息 */
  context: Record<string, unknown>;
}

/**
 * 局部观测 (L2输入)
 */
export interface LocalObservation {
  agentId: string;
  /** 可见目标列表 */
  visibleTargets: TargetSelection[];
  /** 自身能力评估 */
  selfCapability: number;      // 0-1
  /** 可用资源 */
  availableResources: number;
  /** 邻居Agent状态 */
  neighborStates: Array<{
    agentId: string;
    status: string;
    capability: number;
  }>;
  /** 威胁评分列表 */
  threatScores: Array<{
    targetId: string;
    score: number;
  }>;
}

/**
 * 分层决策结果
 */
export interface HierarchicalDecision {
  /** L1 战略目标 */
  macroGoal: MacroGoal;
  macroReason: string;
  /** L2 目标选择 */
  selectedTarget: TargetSelection | null;
  targetSelectionReason: string;
  /** L3 执行参数 */
  actionParams: ActionParams | null;
  actionReason: string;
  /** ITA-Trigger绑定 */
  itaTriggers: string[];
  /** 决策置信度 */
  confidence: number;
  /** 决策时间戳 */
  timestamp: number;
  /** 备选方案 */
  alternatives: Array<{
    macroGoal: MacroGoal;
    reason: string;
    confidence: number;
  }>;
}

/**
 * 决策历史记录
 */
export interface DecisionRecord {
  id: string;
  agentId: string;
  decision: HierarchicalDecision;
  executedAt: number;
  outcome: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'PENDING';
  actualDuration: number;
  lessonsLearned: string[];
}

/**
 * 分层Planner统计
 */
export interface HierarchicalPlannerStats {
  totalDecisions: number;
  decisionsByGoal: Record<string, number>;
  avgConfidence: number;
  successRate: number;
  avgDecisionTimeMs: number;
  deadlockPreventions: number;   // 避免死锁次数
  localOptimaEscapes: number;    // 逃出局部最优次数
  itaTriggerBindings: number;    // ITA-Trigger绑定次数
}

// =============== L1 战略层决策规则 ===============

interface MacroDecisionRule {
  condition: (s: GlobalSituation) => boolean;
  goal: MacroGoal;
  reason: string;
  priority: number;
}

const MACRO_DECISION_RULES: MacroDecisionRule[] = [
  {
    condition: (s) => s.pendingThreats > 0 && s.phiScore >= 0.7,
    goal: MacroGoal.ENGAGE,
    reason: '存在待处理威胁且Φ值充足，进入交战模式',
    priority: 90,
  },
  {
    condition: (s) => s.gcBalance < s.metabolicRate * 86400 * 3, // 3天以下
    goal: MacroGoal.EMERGENCY,
    reason: 'GC余额不足3天代谢，进入紧急模式',
    priority: 95,
  },
  {
    condition: (s) => s.recentViolations > 2,
    goal: MacroGoal.OBSERVE,
    reason: '近期违规过多，进入观察等待模式',
    priority: 85,
  },
  {
    condition: (s) => s.activeTaskCount === 0 && s.phiScore >= 0.5,
    goal: MacroGoal.SEARCH,
    reason: '无活跃任务且Φ值正常，进入搜索发现模式',
    priority: 60,
  },
  {
    condition: (s) => s.activeTaskCount === 0 && s.phiScore < 0.5,
    goal: MacroGoal.HIBERNATE,
    reason: '无任务且Φ值低，进入休眠节能模式',
    priority: 50,
  },
  {
    condition: (s) => s.activeTaskCount > 0 && s.availableCollaborators > 0,
    goal: MacroGoal.COLLABORATE,
    reason: '有任务且有可用协作者，进入协同模式',
    priority: 70,
  },
  {
    condition: (s) => s.systemLoad > 0.9,
    goal: MacroGoal.RTB,
    reason: '系统负载过高，返回基地释放资源',
    priority: 88,
  },
  {
    condition: () => true, // 默认规则
    goal: MacroGoal.OBSERVE,
    reason: '默认观察等待模式',
    priority: 10,
  },
];

// =============== Service ===============

class HierarchicalPlannerService {
  private decisionHistory: Map<string, DecisionRecord[]> = new Map();
  private activeDecisions: Map<string, HierarchicalDecision> = new Map();
  private stats: {
    totalDecisions: number;
    decisionsByGoal: Record<string, number>;
    deadlockPreventions: number;
    localOptimaEscapes: number;
    itaTriggerBindings: number;
    totalConfidence: number;
    successCount: number;
  } = {
    totalDecisions: 0,
    decisionsByGoal: {},
    deadlockPreventions: 0,
    localOptimaEscapes: 0,
    itaTriggerBindings: 0,
    totalConfidence: 0,
    successCount: 0,
  };

  /**
   * 三层决策 — 核心方法
   * Algorithm 1: 太乙AGI分层Planner
   */
  async plan(
    agentId: string,
    situation: GlobalSituation,
    observation: LocalObservation
  ): Promise<HierarchicalDecision> {
    logger.info(`[HierarchicalPlanner] Planning for agent: ${agentId}`);

    // Step 1: L1 战略层 — Macro Goal
    const macroResult = this._decideMacroGoal(situation);

    // Step 2: L2 战役层 — Target Selection
    const targetResult = this._selectTarget(macroResult.goal, observation);

    // Step 3: L3 战术层 — Action Params
    const actionResult = targetResult
      ? this._decideActionParams(agentId, macroResult.goal, targetResult, situation)
      : null;

    // 层间ITA-Trigger绑定
    const itaTriggers = this._bindITATriggers(agentId, macroResult.goal, targetResult, situation);

    // 检测死锁/局部最优
    const deadlockCheck = this._checkDeadlock(agentId, macroResult.goal);
    if (deadlockCheck.deadlockDetected) {
      this.stats.deadlockPreventions++;
      logger.warn(`[HierarchicalPlanner] Deadlock detected for ${agentId}: ${deadlockCheck.reason}`);
    }

    // 构建决策
    const decision: HierarchicalDecision = {
      macroGoal: deadlockCheck.alternativeGoal || macroResult.goal,
      macroReason: deadlockCheck.reason || macroResult.reason,
      selectedTarget: targetResult,
      targetSelectionReason: targetResult ? `Selected ${targetResult.targetId} (priority: ${targetResult.priority.toFixed(2)})` : 'No target selected',
      actionParams: actionResult,
      actionReason: actionResult ? `${actionResult.actionType} with confidence ${actionResult.confidence.toFixed(2)}` : 'No action planned',
      itaTriggers,
      confidence: this._calculateConfidence(macroResult, targetResult, actionResult),
      timestamp: Date.now() / 1000,
      alternatives: this._generateAlternatives(situation),
    };

    // 记录决策
    this.activeDecisions.set(agentId, decision);
    this.stats.totalDecisions++;
    this.stats.decisionsByGoal[decision.macroGoal] = (this.stats.decisionsByGoal[decision.macroGoal] || 0) + 1;
    this.stats.totalConfidence += decision.confidence;
    this.stats.itaTriggerBindings += itaTriggers.length;

    logger.info(`[HierarchicalPlanner] Decision for ${agentId}: L1=${decision.macroGoal}, L2=${decision.selectedTarget?.targetId || 'none'}, L3=${decision.actionParams?.actionType || 'none'}`);
    return decision;
  }

  /**
   * 报告决策结果 — 用于学习和调整
   */
  reportOutcome(agentId: string, outcome: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'PENDING', duration: number, lessons: string[] = []): void {
    const decision = this.activeDecisions.get(agentId);
    if (!decision) return;

    const record: DecisionRecord = {
      id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      decision,
      executedAt: Date.now() / 1000,
      outcome,
      actualDuration: duration,
      lessonsLearned: lessons,
    };

    if (!this.decisionHistory.has(agentId)) {
      this.decisionHistory.set(agentId, []);
    }
    this.decisionHistory.get(agentId)!.push(record);

    if (outcome === 'SUCCESS' || outcome === 'PARTIAL') {
      this.stats.successCount++;
    }

    // 局部最优逃逸检测
    if (outcome === 'FAILED' && lessons.some(l => l.includes('stuck') || l.includes('deadlock'))) {
      this.stats.localOptimaEscapes++;
    }

    this.activeDecisions.delete(agentId);
  }

  /**
   * 获取Agent当前决策
   */
  getActiveDecision(agentId: string): HierarchicalDecision | null {
    return this.activeDecisions.get(agentId) || null;
  }

  /**
   * 获取Agent决策历史
   */
  getDecisionHistory(agentId: string, limit: number = 20): DecisionRecord[] {
    const history = this.decisionHistory.get(agentId) || [];
    return history.slice(-limit);
  }

  /**
   * 获取统计
   */
  getStats(): HierarchicalPlannerStats {
    return {
      totalDecisions: this.stats.totalDecisions,
      decisionsByGoal: { ...this.stats.decisionsByGoal },
      avgConfidence: this.stats.totalDecisions > 0
        ? this.stats.totalConfidence / this.stats.totalDecisions
        : 0,
      successRate: this.stats.totalDecisions > 0
        ? this.stats.successCount / this.stats.totalDecisions
        : 0,
      avgDecisionTimeMs: 0,
      deadlockPreventions: this.stats.deadlockPreventions,
      localOptimaEscapes: this.stats.localOptimaEscapes,
      itaTriggerBindings: this.stats.itaTriggerBindings,
    };
  }

  // =============== L1 战略层 ===============

  /**
   * L1 Macro Goal 决策
   * 输入: 全局态势 S_global
   * 输出: Goal ∈ {Search, Engage, RTB, Observe, ...}
   */
  private _decideMacroGoal(situation: GlobalSituation): {
    goal: MacroGoal;
    reason: string;
    confidence: number;
  } {
    // 按优先级评估规则
    const matchedRules = MACRO_DECISION_RULES
      .filter(rule => rule.condition(situation))
      .sort((a, b) => b.priority - a.priority);

    if (matchedRules.length === 0) {
      return { goal: MacroGoal.OBSERVE, reason: 'No matching rule, defaulting to observe', confidence: 0.5 };
    }

    const best = matchedRules[0];
    const confidence = Math.min(1.0, best.priority / 100);

    return { goal: best.goal, reason: best.reason, confidence };
  }

  // =============== L2 战役层 ===============

  /**
   * L2 Target Selection
   * 输入: 局部观测 o_i, 威胁列表
   * 输出: Target ID
   */
  private _selectTarget(macroGoal: MacroGoal, observation: LocalObservation): TargetSelection | null {
    let candidates = observation.visibleTargets;

    // 根据L1目标过滤候选
    switch (macroGoal) {
      case MacroGoal.ENGAGE:
        // 交战模式: 优先高威胁目标
        candidates = candidates.filter(t =>
          t.targetType === TargetType.THREAT || t.targetType === TargetType.TASK
        );
        break;
      case MacroGoal.SEARCH:
        // 搜索模式: 优先未探索资源
        candidates = candidates.filter(t =>
          t.targetType === TargetType.RESOURCE || t.targetType === TargetType.TASK
        );
        break;
      case MacroGoal.EMERGENCY:
        // 紧急模式: 优先GC异常
        candidates = candidates.filter(t =>
          t.targetType === TargetType.GC_ANOMALY || t.targetType === TargetType.RESOURCE
        );
        break;
      case MacroGoal.COLLABORATE:
        // 协同模式: 优先其他Agent
        candidates = candidates.filter(t =>
          t.targetType === TargetType.AGENT || t.targetType === TargetType.TASK
        );
        break;
      default:
        break;
    }

    if (candidates.length === 0) return null;

    // 综合评分: priority × (1 - riskScore) × selfCapability
    const scored = candidates.map(t => ({
      target: t,
      score: t.priority * (1 - t.riskScore * 0.5) * observation.selfCapability,
    }));

    scored.sort((a, b) => b.score - a.score);

    // 解决目标分配冲突 — 同一目标不重复选择
    return scored[0].target;
  }

  // =============== L3 战术层 ===============

  /**
   * L3 Action Params
   * 输入: 目标 g_t, 自身状态 s_i
   * 输出: 攻击角度, 弹药量, 协同呼叫等具体参数
   */
  private _decideActionParams(
    agentId: string,
    macroGoal: MacroGoal,
    target: TargetSelection,
    situation: GlobalSituation
  ): ActionParams {
    // 根据L1+L2决定L3动作
    let actionType: PlanActionType;
    let params: Record<string, unknown> = {};
    let requiresApproval = false;

    switch (macroGoal) {
      case MacroGoal.ENGAGE:
        actionType = PlanActionType.EXECUTE_TASK;
        params = {
          targetId: target.targetId,
          intensity: Math.min(1.0, situation.phiScore * 1.5),
          gcBudget: Math.floor(situation.gcBalance * 0.3),
        };
        if (target.riskScore > 0.7) requiresApproval = true;
        break;

      case MacroGoal.EMERGENCY:
        actionType = PlanActionType.ALLOCATE_RESOURCE;
        params = {
          targetId: target.targetId,
          amount: Math.floor(situation.gcBalance * 0.5),
          reason: 'Emergency GC replenishment',
        };
        break;

      case MacroGoal.COLLABORATE:
        actionType = PlanActionType.REQUEST_COLLABORATION;
        params = {
          targetId: target.targetId,
          taskType: target.targetType,
          sharedResources: situation.gcBalance * 0.2,
        };
        break;

      case MacroGoal.SEARCH:
        actionType = PlanActionType.EXECUTE_TASK;
        params = {
          targetId: target.targetId,
          explorationRadius: 0.8,
          maxGcSpend: situation.gcBalance * 0.1,
        };
        break;

      default:
        actionType = PlanActionType.ADJUST_PRIORITY;
        params = { targetId: target.targetId, newPriority: target.priority };
    }

    // 生成备选方案
    const alternatives: AlternativeAction[] = [
      {
        actionType: PlanActionType.DELEGATE,
        params: { targetId: target.targetId, delegateTo: 'best_available' },
        confidence: 0.6,
        reason: 'Delegate to better-suited agent if available',
      },
      {
        actionType: PlanActionType.TRIGGER_ITA,
        params: { targetId: target.targetId, triggerType: 'reassessment' },
        confidence: 0.4,
        reason: 'Re-assess situation with ITA-Trigger',
      },
    ];

    return {
      actionType,
      targetId: target.targetId,
      params,
      confidence: Math.min(1.0, situation.phiScore * 0.8 + 0.2),
      alternativeActions: alternatives,
      requiresApproval,
      estimatedDuration: target.estimatedResources * 10,
      rollbackPlan: `Revert to ${MacroGoal.OBSERVE} and release resources`,
    };
  }

  // =============== ITA-Trigger 层间绑定 ===============

  /**
   * 在层间切换点绑定ITA-Trigger
   * HG-STR的L1切换(Search → Engage)是ITA-Trigger的完美实例
   */
  private _bindITATriggers(
    agentId: string,
    macroGoal: MacroGoal,
    target: TargetSelection | null,
    situation: GlobalSituation
  ): string[] {
    const triggers: string[] = [];

    // L1层间切换Trigger: 当GC余额恢复时，从EMERGENCY→SEARCH
    if (macroGoal === MacroGoal.EMERGENCY) {
      const triggerId = `ita_${agentId}_emergency_exit`;
      itaTriggerEngine.registerTrigger({
        id: triggerId,
        name: `${agentId}: Emergency→Search transition`,
        description: 'GC余额恢复后自动切换到搜索模式',
        information: {
          type: InformationType.GC_METRICS, // GC_METRICS
          source: agentId,
          watchKey: 'gc.balance',
          dataType: 'number',
          samplingInterval: 30,
        },
        trigger: {
          expression: 'gc.balance > metabolicRate * 86400 * 7',
          thresholdType: ThresholdType.GREATER_THAN, // GREATER_THAN
          numericThreshold: situation.metabolicRate * 86400 * 7,
          contextConditions: [],
          sustainDuration: 0,
          vetoConditions: ['systemLoad > 0.95'],
        },
        actions: [{
          id: `act_${triggerId}_1`,
          type: ActionType.TRIGGER_PLANNER, // TRIGGER_PLANNER
          target: agentId,
          params: { newGoal: MacroGoal.SEARCH },
          requiresHumanApproval: false,
          timeout: 60,
          delayAfterPrevious: 0,
          status: ActionStatus.PENDING, // PENDING
        }],
        priority: TriggerPriority.HIGH,
        status: TriggerStatus.ACTIVE,
        createdAt: Date.now() / 1000,
        lastFiredAt: null,
        fireCount: 0,
        cooldownSeconds: 300,
      });
      triggers.push(triggerId);
    }

    // L2目标完成Trigger: 目标完成时通知
    if (target) {
      const triggerId = `ita_${agentId}_target_done_${target.targetId}`;
      itaTriggerEngine.registerTrigger({
        id: triggerId,
        name: `${agentId}: Target ${target.targetId} completion`,
        description: '目标完成时触发下一步决策',
        information: {
          type: InformationType.AGENT_STATE, // AGENT_STATE
          source: agentId,
          watchKey: `task.${target.targetId}.status`,
          dataType: 'string',
          samplingInterval: 10,
        },
        trigger: {
          expression: `task.${target.targetId}.status == 'COMPLETED'`,
          thresholdType: ThresholdType.EQUALS, // EQUALS
          stringMatch: 'COMPLETED',
          contextConditions: [],
          sustainDuration: 0,
          vetoConditions: [],
        },
        actions: [{
          id: `act_${triggerId}_1`,
          type: ActionType.TRIGGER_PLANNER, // TRIGGER_PLanner
          target: agentId,
          params: { rePlan: true, completedTarget: target.targetId },
          requiresHumanApproval: false,
          timeout: 30,
          delayAfterPrevious: 0,
          status: ActionStatus.PENDING, // PENDING
        }],
        priority: TriggerPriority.MEDIUM,
        status: TriggerStatus.ACTIVE,
        createdAt: Date.now() / 1000,
        lastFiredAt: null,
        fireCount: 0,
        cooldownSeconds: 60,
      });
      triggers.push(triggerId);
    }

    return triggers;
  }

  // =============== 死锁/局部最优检测 ===============

  /**
   * 检测死锁 — 同一Agent连续3次相同目标
   */
  private _checkDeadlock(agentId: string, newGoal: MacroGoal): {
    deadlockDetected: boolean;
    reason?: string;
    alternativeGoal?: MacroGoal;
  } {
    const history = this.decisionHistory.get(agentId) || [];
    const recent = history.slice(-3);

    if (recent.length < 3) return { deadlockDetected: false };

    const allSameGoal = recent.every(r => r.decision.macroGoal === newGoal);
    const anySuccess = recent.some(r => r.outcome === 'SUCCESS');

    if (allSameGoal && !anySuccess) {
      // 死锁检测: 连续3次相同目标且无成功
      const alternatives = Object.values(MacroGoal).filter(g => g !== newGoal);
      const escape = alternatives[Math.floor(Math.random() * alternatives.length)];

      return {
        deadlockDetected: true,
        reason: `Deadlock detected: 3 consecutive ${newGoal} with no success, escaping to ${escape}`,
        alternativeGoal: escape,
      };
    }

    return { deadlockDetected: false };
  }

  /**
   * 生成备选方案
   */
  private _generateAlternatives(situation: GlobalSituation): Array<{
    macroGoal: MacroGoal;
    reason: string;
    confidence: number;
  }> {
    const alternatives: Array<{ macroGoal: MacroGoal; reason: string; confidence: number }> = [];

    for (const rule of MACRO_DECISION_RULES.slice(0, -1)) { // 排除默认规则
      if (rule.condition(situation)) {
        alternatives.push({
          macroGoal: rule.goal,
          reason: rule.reason,
          confidence: rule.priority / 100,
        });
      }
    }

    return alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * 计算综合置信度
   */
  private _calculateConfidence(
    macro: { confidence: number },
    target: TargetSelection | null,
    action: ActionParams | null
  ): number {
    const l1 = macro.confidence;
    const l2 = target ? target.priority * 0.8 : 0.3;
    const l3 = action ? action.confidence : 0.3;
    return l1 * 0.4 + l2 * 0.3 + l3 * 0.3;
  }
}

export const hierarchicalPlannerService = new HierarchicalPlannerService();
