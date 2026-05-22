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
