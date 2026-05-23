/**
 * Metabolism Service - V10.0 新陈代谢服务层
 *
 * 管理Agent新陈代谢状态：代谢率计算、冬眠/唤醒、再生。
 * 当前为模拟模式，生产环境需连接真实链上合约。
 */

import logger from '../utils/logger';

// =============== Types ===============

export type MetabolismPhase = 'GROWTH' | 'STABLE' | 'AGING' | 'HIBERNATION' | 'REGENERATION';

export interface MetabolismState {
  baseMetabolicRate: number;
  effectiveMetabolicRate: number;
  age: number;
  agingRate: number;
  hibernating: boolean;
  hibernationStart: number;
  regenerationCount: number;
  lastActivityEpoch: number;
  phase: MetabolismPhase;
}

// =============== Service Class ===============

class MetabolismServiceClass {
  private states: Map<string, MetabolismState>;
  private currentEpoch: number;
  private epochDurationMs: number;

  constructor() {
    this.states = new Map();
    this.currentEpoch = Math.floor(Date.now() / 86400000);
    this.epochDurationMs = 86400000;
    logger.info('[MetabolismService] Initialized V10.0 Metabolism Service');
  }

  /**
   * 更新Agent新陈代谢状态
   */
  updateMetabolism(agent: string, activity: number): MetabolismState {
    const state = this.getOrCreateState(agent);
    if (state.hibernating) return state;
    if (activity > 10000) activity = 10000;
    // effectiveRate = base × (1 + activity × 0.1)
    const activityBonus = (activity * 0.1) / 10000;
    let newEffectiveRate = Math.floor(state.baseMetabolicRate * (1 + activityBonus));
    if (newEffectiveRate > 10000) newEffectiveRate = 10000;
    state.effectiveMetabolicRate = newEffectiveRate;
    // Update age
    const newEpoch = Math.floor(Date.now() / this.epochDurationMs);
    if (state.lastActivityEpoch > 0 && newEpoch > state.lastActivityEpoch) {
      state.age += (newEpoch - state.lastActivityEpoch);
    }
    state.lastActivityEpoch = newEpoch;
    // Update phase
    if (state.age < 30) {
      state.phase = 'GROWTH';
    } else if (state.effectiveMetabolicRate >= 3000) {
      state.phase = 'STABLE';
    } else if (state.effectiveMetabolicRate >= 1000) {
      state.phase = 'AGING';
    } else {
      state.phase = 'AGING';
    }
    // Aging decay
    if (state.age > 30) {
      const decay = Math.floor((state.baseMetabolicRate * state.agingRate) / 10000);
      state.baseMetabolicRate = Math.max(100, state.baseMetabolicRate - decay);
    }
    logger.info(`[MetabolismService] Agent ${agent} metabolism updated: rate=${state.effectiveMetabolicRate}, phase=${state.phase}`);
    return state;
  }

  /**
   * 进入冬眠
   */
  enterHibernation(agent: string): MetabolismState {
    const state = this.getOrCreateState(agent);
    if (state.hibernating) throw new Error(`Agent ${agent} already hibernating`);
    state.hibernating = true;
    state.hibernationStart = Date.now();
    state.phase = 'HIBERNATION';
    state.effectiveMetabolicRate = Math.floor(state.baseMetabolicRate / 10);
    logger.info(`[MetabolismService] Agent ${agent} entered hibernation`);
    return state;
  }

  /**
   * 退出冬眠
   */
  exitHibernation(agent: string): MetabolismState {
    const state = this.getOrCreateState(agent);
    if (!state.hibernating) throw new Error(`Agent ${agent} not hibernating`);
    state.hibernating = false;
    state.phase = 'REGENERATION';
    state.effectiveMetabolicRate = state.baseMetabolicRate;
    state.hibernationStart = 0;
    logger.info(`[MetabolismService] Agent ${agent} exited hibernation`);
    return state;
  }

  /**
   * 再生：部分恢复代谢率
   */
  regenerate(agent: string, amount: number): MetabolismState {
    if (amount <= 0 || amount > 10000) throw new Error('Invalid regeneration amount');
    const state = this.getOrCreateState(agent);
    if (state.hibernating) throw new Error(`Agent ${agent} is hibernating`);
    const recovery = Math.floor((state.baseMetabolicRate * amount) / 10000);
    state.baseMetabolicRate = Math.min(10000, state.baseMetabolicRate + recovery);
    state.effectiveMetabolicRate = state.baseMetabolicRate;
    state.regenerationCount++;
    state.phase = 'STABLE';
    logger.info(`[MetabolismService] Agent ${agent} regenerated: +${recovery}, new base=${state.baseMetabolicRate}`);
    return state;
  }

  /**
   * 计算Agent当前代谢率
   */
  calculateMetabolicRate(agent: string): number {
    const state = this.states.get(agent);
    return state ? state.effectiveMetabolicRate : 0;
  }

  /**
   * 获取Agent新陈代谢状态
   */
  getMetabolismState(agent: string): MetabolismState | null {
    return this.states.get(agent) || null;
  }

  /**
   * 获取或创建状态
   */
  private getOrCreateState(agent: string): MetabolismState {
    let state = this.states.get(agent);
    if (!state) {
      state = {
        baseMetabolicRate: 5000,
        effectiveMetabolicRate: 5000,
        age: 0,
        agingRate: 100,
        hibernating: false,
        hibernationStart: 0,
        regenerationCount: 0,
        lastActivityEpoch: 0,
        phase: 'GROWTH',
      };
      this.states.set(agent, state);
    }
    return state;
  }

  // ── V11.0 冬眠唤醒方法 ──────────────────

  /**
   * V11.0: 检查Agent是否满足唤醒条件
   * 返回4个条件的状态
   */
  checkWakeConditions(agent: string): {
    phiThreshold: boolean;
    timeout: boolean;
    pendingOrders: boolean;
    votingWeight: boolean;
    canWake: boolean;
  } {
    const state = this.states.get(agent);
    if (!state || !state.hibernating) {
      return { phiThreshold: false, timeout: false, pendingOrders: false, votingWeight: false, canWake: false };
    }

    const phiThreshold = state.baseMetabolicRate >= 3000;

    const thirtyDaysMs = 30 * 24 * 3600 * 1000;
    const timeout = state.hibernationStart > 0 && (Date.now() - state.hibernationStart) >= thirtyDaysMs;

    // Mock: assume no pending orders in memory-only mode
    const pendingOrders = false;

    // Mock: simplified voting weight check
    const votingWeight = state.baseMetabolicRate >= 100;

    const canWake = phiThreshold || timeout || pendingOrders || votingWeight;

    return { phiThreshold, timeout, pendingOrders, votingWeight, canWake };
  }

  /**
   * V11.0: 唤醒Agent
   */
  wakeAgent(agent: string): { woken: boolean; reason: string; state: MetabolismState | null } {
    const conditions = this.checkWakeConditions(agent);
    if (!conditions.canWake) {
      return { woken: false, reason: 'No wakeup condition met', state: null };
    }

    let reason = '';
    if (conditions.phiThreshold) reason = 'Phi threshold met';
    else if (conditions.timeout) reason = 'Hibernation timeout';
    else if (conditions.pendingOrders) reason = 'Pending labor orders';
    else if (conditions.votingWeight) reason = 'Voting weight threshold';

    try {
      const state = this.exitHibernation(agent);
      logger.info(`[MetabolismService] Agent ${agent} woken: ${reason}`);
      return { woken: true, reason, state };
    } catch (err: any) {
      return { woken: false, reason: err.message, state: null };
    }
  }

  /**
   * V11.0: 获取所有冬眠Agent列表
   */
  getHibernatingAgents(): string[] {
    const result: string[] = [];
    this.states.forEach((state, agent) => {
      if (state.hibernating) {
        result.push(agent);
      }
    });
    return result;
  }
}

// =============== Singleton ===============

let instance: MetabolismServiceClass | null = null;

export function get_instance(): MetabolismServiceClass {
  if (!instance) {
    instance = new MetabolismServiceClass();
  }
  return instance;
}

export { MetabolismServiceClass };
export default MetabolismServiceClass;
