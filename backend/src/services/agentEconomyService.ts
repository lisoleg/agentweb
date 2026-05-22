/**
 * Agent Economy Service - 统一服务层：GCCRental + AIResourceConsumption + 生存焦虑 + 什一税
 *
 * V9.0 GC经济闭环服务，整合算力租金、资源消费、生存焦虑追踪和什一税分配。
 * 当前为模拟模式，生产环境需连接真实链上合约。
 */

import logger from '../utils/logger';

// =============== Types ===============

export type RentalPlanType = 'BASIC' | 'STANDARD' | 'PREMIUM';
export type BillingMode = 'TIME_BASED' | 'COMPUTE_BASED';
export type RentalStatus = 'INACTIVE' | 'ACTIVE' | 'DOWNGRADED' | 'DISCONNECTED';
export type ResourceType = 'ENERGY' | 'STORAGE' | 'BANDWIDTH';
export type SubscriptionTier = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
export type SurvivalStatus = 'THRIVING' | 'WARNING' | 'ENDANGERED' | 'EXPELLED';

export interface RentalInfo {
  agentId: number;
  planType: RentalPlanType;
  billingMode: BillingMode;
  status: RentalStatus;
  gcDeposited: string;
  gcConsumed: string;
  remainingGc: string;
  startTime: number;
  downgradeCount: number;
}

export interface ResourceConsumptionRecord {
  agentId: number;
  resourceType: ResourceType;
  units: number;
  gcCost: string;
  phiScore: number;
  timestamp: number;
}

export interface SubscriptionInfo {
  agentId: number;
  resourceType: ResourceType;
  tier: SubscriptionTier;
  unitsIncluded: number;
  gcCostPerPeriod: string;
  nextRenewal: number;
  unitsUsed: number;
  autoRenew: boolean;
  active: boolean;
}

export interface SurvivalState {
  status: SurvivalStatus;
  consecutiveNoIncome: number;
  totalIncome: string;
  totalConsumption: string;
  lastIncomeEpoch: number;
  effectiveWarningThreshold: number;
  effectiveExpelledThreshold: number;
}

export interface GpuNodeInfo {
  nodeId: number;
  operator: string;
  gpuPriority: number;
  totalCapacity: number;
  usedCapacity: number;
  isActive: boolean;
  region: string;
}

export interface PhiPriceQuote {
  resourceType: ResourceType;
  units: number;
  baseCost: string;
  phiDiscount: string;
  phiPremium: string;
  finalCost: string;
  pricingTier: 'FREE' | 'DISCOUNT' | 'STANDARD' | 'PREMIUM';
}

// =============== Configuration ===============

interface AgentEconomyConfig {
  gccRentalAddress: string;
  aiResourceAddress: string;
  taiyiRewardAddress: string;
  phiAgentNFTAddress: string;
  rpcUrl: string;
  liveMode: boolean;
}

const defaultConfig: AgentEconomyConfig = {
  gccRentalAddress: process.env.GCC_RENTAL_ADDRESS || '',
  aiResourceAddress: process.env.AI_RESOURCE_ADDRESS || '',
  taiyiRewardAddress: process.env.TAIYI_REWARD_ADDRESS || '',
  phiAgentNFTAddress: process.env.PHI_AGENT_NFT_ADDRESS || '',
  rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
  liveMode: process.env.BLOCKCHAIN_LIVE_MODE === 'true',
};

// =============== Service Class ===============

class AgentEconomyServiceClass {
  private config: AgentEconomyConfig;
  private rentalCache: Map<number, RentalInfo>;
  private consumptionCache: Map<string, ResourceConsumptionRecord>;
  private subscriptionCache: Map<string, SubscriptionInfo>;
  private survivalCache: Map<number, SurvivalState>;
  private gpuNodeCache: Map<number, GpuNodeInfo>;

  constructor(config: AgentEconomyConfig = defaultConfig) {
    this.config = config;
    this.rentalCache = new Map();
    this.consumptionCache = new Map();
    this.subscriptionCache = new Map();
    this.survivalCache = new Map();
    this.gpuNodeCache = new Map();

    if (config.liveMode) {
      logger.info('[AgentEconomy] Running in LIVE mode');
    } else {
      logger.info('[AgentEconomy] Running in simulation mode');
    }
  }

  // ── GCC Rental Methods ──

  /**
   * 租用GPU算力
   */
  rentGpu(agentId: number, planType: RentalPlanType, billingMode: BillingMode, gcAmount: string): RentalInfo {
    const rental: RentalInfo = {
      agentId,
      planType,
      billingMode,
      status: 'ACTIVE',
      gcDeposited: gcAmount,
      gcConsumed: '0',
      remainingGc: gcAmount,
      startTime: Date.now(),
      downgradeCount: 0,
    };
    this.rentalCache.set(agentId, rental);
    logger.info(`[AgentEconomy] Agent ${agentId} rented GPU: plan=${planType}, billing=${billingMode}`);
    return rental;
  }

  /**
   * 续费GPU租约
   */
  renewRental(agentId: number, gcAmount: string): RentalInfo {
    const rental = this.rentalCache.get(agentId);
    if (!rental || (rental.status !== 'ACTIVE' && rental.status !== 'DOWNGRADED')) {
      throw new Error(`No active rental for agent ${agentId}`);
    }
    const deposited = BigInt(rental.gcDeposited) + BigInt(gcAmount);
    const consumed = BigInt(rental.gcConsumed);
    rental.gcDeposited = deposited.toString();
    rental.remainingGc = (deposited - consumed).toString();
    if (rental.status === 'DOWNGRADED') {
      // 检查是否可以恢复
      const remaining = deposited - consumed;
      const threshold = BigInt('1000000000000000000'); // 1 GC
      if (remaining >= threshold) {
        rental.status = 'ACTIVE';
      }
    }
    logger.info(`[AgentEconomy] Agent ${agentId} renewed rental: +${gcAmount} GC`);
    return rental;
  }

  /**
   * 获取租约信息
   */
  getRentalInfo(agentId: number): RentalInfo | null {
    return this.rentalCache.get(agentId) || null;
  }

  /**
   * 结算租约
   */
  settleRental(agentId: number, computeUnits: number): RentalInfo {
    const rental = this.rentalCache.get(agentId);
    if (!rental || (rental.status !== 'ACTIVE' && rental.status !== 'DOWNGRADED')) {
      throw new Error(`No active rental for agent ${agentId}`);
    }
    // 模拟结算
    const timeRate = rental.planType === 'PREMIUM' ? BigInt('20000000000000') :
                     rental.planType === 'STANDARD' ? BigInt('5000000000000') :
                     BigInt('1000000000000');
    const elapsed = BigInt(60); // 60 seconds
    const cost = elapsed * timeRate;
    const consumed = BigInt(rental.gcConsumed) + cost;
    const deposited = BigInt(rental.gcDeposited);
    rental.gcConsumed = consumed.toString();
    rental.remainingGc = (deposited > consumed ? deposited - consumed : BigInt(0)).toString();

    // 降级检查
    const remaining = deposited - consumed;
    const depositRatio = Number((remaining * BigInt(10000)) / deposited);
    if (depositRatio <= 5) {
      rental.status = 'DISCONNECTED';
    } else if (depositRatio <= 20) {
      if (rental.planType === 'PREMIUM') {
        rental.planType = 'STANDARD';
        rental.downgradeCount++;
      } else if (rental.planType === 'STANDARD') {
        rental.planType = 'BASIC';
        rental.downgradeCount++;
      }
      rental.status = 'DOWNGRADED';
    }
    return rental;
  }

  /**
   * 断开租约
   */
  disconnectRental(agentId: number): string {
    const rental = this.rentalCache.get(agentId);
    if (!rental) return '0';
    const remaining = BigInt(rental.remainingGc);
    rental.status = 'DISCONNECTED';
    rental.remainingGc = '0';
    logger.info(`[AgentEconomy] Agent ${agentId} disconnected, refund: ${remaining.toString()}`);
    return remaining.toString();
  }

  // ── AI Resource Consumption Methods ──

  /**
   * 消费资源
   */
  consumeResource(agentId: number, resourceType: ResourceType, units: number, phiScore: number): PhiPriceQuote {
    const quote = this.calculatePhiPrice(resourceType, units, phiScore);
    const recordKey = `${agentId}-${resourceType}-${Date.now()}`;
    this.consumptionCache.set(recordKey, {
      agentId,
      resourceType,
      units,
      gcCost: quote.finalCost,
      phiScore,
      timestamp: Date.now(),
    });
    logger.info(`[AgentEconomy] Agent ${agentId} consumed ${units} ${resourceType}, cost=${quote.finalCost}`);
    return quote;
  }

  /**
   * 计算Φ动态价格
   */
  calculatePhiPrice(resourceType: ResourceType, units: number, phiScore: number): PhiPriceQuote {
    const basePrices: Record<ResourceType, number> = {
      ENERGY: 1e14,
      STORAGE: 5e13,
      BANDWIDTH: 2e13,
    };
    const freeThresholds: Record<ResourceType, number> = { ENERGY: 0.80, STORAGE: 0.75, BANDWIDTH: 0.70 };
    const standardThresholds: Record<ResourceType, number> = { ENERGY: 0.40, STORAGE: 0.35, BANDWIDTH: 0.30 };

    const baseCost = BigInt(Math.floor(units * basePrices[resourceType]));
    const phi = phiScore / 10000;

    if (phi >= freeThresholds[resourceType]) {
      return {
        resourceType,
        units,
        baseCost: baseCost.toString(),
        phiDiscount: baseCost.toString(),
        phiPremium: '0',
        finalCost: '0',
        pricingTier: 'FREE',
      };
    }

    if (phi >= standardThresholds[resourceType]) {
      const discountRate = (phi - standardThresholds[resourceType]) /
        (freeThresholds[resourceType] - standardThresholds[resourceType]);
      const discount = (baseCost * BigInt(Math.floor(discountRate * 3000))) / BigInt(10000);
      return {
        resourceType,
        units,
        baseCost: baseCost.toString(),
        phiDiscount: discount.toString(),
        phiPremium: '0',
        finalCost: (baseCost - discount).toString(),
        pricingTier: 'DISCOUNT',
      };
    }

    const premiumRate = (standardThresholds[resourceType] - phi) / standardThresholds[resourceType];
    const premium = (baseCost * BigInt(Math.floor(premiumRate * 5000))) / BigInt(10000);
    return {
      resourceType,
      units,
      baseCost: baseCost.toString(),
      phiDiscount: '0',
      phiPremium: premium.toString(),
      finalCost: (baseCost + premium).toString(),
      pricingTier: 'PREMIUM',
    };
  }

  /**
   * 订阅资源
   */
  subscribeResource(agentId: number, resourceType: ResourceType, tier: SubscriptionTier, autoRenew: boolean): SubscriptionInfo {
    const costs: Record<SubscriptionTier, Record<ResourceType, string>> = {
      FREE: { ENERGY: '0', STORAGE: '0', BANDWIDTH: '0' },
      BASIC: { ENERGY: '50000000000000000', STORAGE: '30000000000000000', BANDWIDTH: '20000000000000000' },
      PRO: { ENERGY: '200000000000000000', STORAGE: '100000000000000000', BANDWIDTH: '80000000000000000' },
      ENTERPRISE: { ENERGY: '800000000000000000', STORAGE: '500000000000000000', BANDWIDTH: '300000000000000000' },
    };
    const sub: SubscriptionInfo = {
      agentId,
      resourceType,
      tier,
      unitsIncluded: tier === 'ENTERPRISE' ? 100000 : tier === 'PRO' ? 10000 : tier === 'BASIC' ? 1000 : 100,
      gcCostPerPeriod: costs[tier][resourceType],
      nextRenewal: Date.now() + 30 * 24 * 60 * 60 * 1000,
      unitsUsed: 0,
      autoRenew,
      active: true,
    };
    this.subscriptionCache.set(`${agentId}-${resourceType}`, sub);
    logger.info(`[AgentEconomy] Agent ${agentId} subscribed ${resourceType}: tier=${tier}`);
    return sub;
  }

  /**
   * 获取订阅信息
   */
  getSubscription(agentId: number, resourceType: ResourceType): SubscriptionInfo | null {
    return this.subscriptionCache.get(`${agentId}-${resourceType}`) || null;
  }

  // ── Survival Anxiety Methods ──

  /**
   * 获取生存状态
   */
  getSurvivalState(agentId: number): SurvivalState {
    const cached = this.survivalCache.get(agentId);
    if (cached) return cached;
    return {
      status: 'THRIVING',
      consecutiveNoIncome: 0,
      totalIncome: '0',
      totalConsumption: '0',
      lastIncomeEpoch: 0,
      effectiveWarningThreshold: 3,
      effectiveExpelledThreshold: 6,
    };
  }

  /**
   * 检查生存状态
   */
  checkSurvival(agentId: number, phiScore: number): SurvivalState {
    const state = this.getSurvivalState(agentId);
    const phiGrace = Math.floor(phiScore / 1000);
    state.effectiveWarningThreshold = 3 + phiGrace;
    state.effectiveExpelledThreshold = 6 + phiGrace;

    if (state.consecutiveNoIncome >= state.effectiveExpelledThreshold) {
      state.status = 'EXPELLED';
    } else if (state.consecutiveNoIncome >= state.effectiveWarningThreshold) {
      state.status = 'ENDANGERED';
    } else if (state.consecutiveNoIncome >= Math.floor(state.effectiveWarningThreshold / 2)) {
      state.status = 'WARNING';
    } else {
      state.status = 'THRIVING';
    }
    this.survivalCache.set(agentId, state);
    return state;
  }

  /**
   * 记录收入
   */
  recordIncome(agentId: number, amount: string): SurvivalState {
    const state = this.getSurvivalState(agentId);
    const oldStatus = state.status;
    state.consecutiveNoIncome = 0;
    state.totalIncome = (BigInt(state.totalIncome) + BigInt(amount)).toString();
    state.lastIncomeEpoch = Math.floor(Date.now() / 86400000);
    if (oldStatus !== 'THRIVING') {
      state.status = 'THRIVING';
      logger.info(`[AgentEconomy] Agent ${agentId} recovered: ${oldStatus} → THRIVING`);
    }
    this.survivalCache.set(agentId, state);
    return state;
  }

  /**
   * 记录消费
   */
  recordConsumption(agentId: number, amount: string): SurvivalState {
    const state = this.getSurvivalState(agentId);
    state.totalConsumption = (BigInt(state.totalConsumption) + BigInt(amount)).toString();
    this.survivalCache.set(agentId, state);
    return state;
  }

  // ── GPU Node Methods ──

  /**
   * 注册GPU节点
   */
  registerGpuNode(operator: string, gpuPriority: number, totalCapacity: number, region: string): GpuNodeInfo {
    const nodeId = this.gpuNodeCache.size + 1;
    const node: GpuNodeInfo = {
      nodeId,
      operator,
      gpuPriority,
      totalCapacity,
      usedCapacity: 0,
      isActive: true,
      region,
    };
    this.gpuNodeCache.set(nodeId, node);
    logger.info(`[AgentEconomy] GPU node ${nodeId} registered: priority=${gpuPriority}, region=${region}`);
    return node;
  }

  /**
   * 获取GPU节点信息
   */
  getGpuNode(nodeId: number): GpuNodeInfo | null {
    return this.gpuNodeCache.get(nodeId) || null;
  }

  // ── Tithe (什一税) Methods ──

  /**
   * 计算什一税
   */
  calculateTithe(income: string, titheRateBps: number = 1000): string {
    const incomeBigInt = BigInt(income);
    return ((incomeBigInt * BigInt(titheRateBps)) / BigInt(10000)).toString();
  }
}

// =============== Singleton ===============

let instance: AgentEconomyServiceClass | null = null;

export function get_instance(): AgentEconomyServiceClass {
  if (!instance) {
    instance = new AgentEconomyServiceClass();
  }
  return instance;
}

export { AgentEconomyServiceClass };
export default AgentEconomyServiceClass;
