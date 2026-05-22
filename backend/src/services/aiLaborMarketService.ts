/**
 * AI Labor Market Service - V10.0 AI劳动力市场服务层
 *
 * 管理Agent注册、雇主注册、劳动订单和争议解决。
 * 当前为模拟模式，生产环境需连接真实链上合约。
 */

import logger from '../utils/logger';

// =============== Types ===============

export type OrderStatus = 'OPEN' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
export type DisputeStatus = 'FILED' | 'UNDER_REVIEW' | 'RESOLVED_AGENT' | 'RESOLVED_EMPLOYER' | 'RESOLVED_SPLIT';

export interface AgentLaborProfile {
  agent: string;
  skillHash: string;
  minHourlyRate: string;
  maxHoursPerWeek: number;
  totalJobsCompleted: number;
  totalEarnings: string;
  rating: number;
  isActive: boolean;
  registeredAt: number;
}

export interface EmployerProfile {
  employer: string;
  metadataURI: string;
  totalJobsPosted: number;
  totalSpent: string;
  rating: number;
  isActive: boolean;
  registeredAt: number;
}

export interface LaborOrder {
  orderId: number;
  employer: string;
  agent: string;
  description: string;
  requirementsHash: string;
  budget: string;
  hourlyRate: string;
  estimatedHours: number;
  maxHours: number;
  deadline: number;
  status: OrderStatus;
  createdAt: number;
  confirmedAt: number;
  completedAt: number;
}

export interface LaborDispute {
  disputeId: number;
  orderId: number;
  filer: string;
  reason: string;
  status: DisputeStatus;
  createdAt: number;
  resolvedAt: number;
}

// =============== Service Class ===============

class AILaborMarketServiceClass {
  private agents: Map<string, AgentLaborProfile>;
  private employers: Map<string, EmployerProfile>;
  private orders: Map<number, LaborOrder>;
  private disputes: Map<number, LaborDispute>;
  private nextOrderId: number;
  private nextDisputeId: number;
  private globalMinWage: string;
  private globalMaxHours: number;
  private platformFeeBps: number;

  constructor() {
    this.agents = new Map();
    this.employers = new Map();
    this.orders = new Map();
    this.disputes = new Map();
    this.nextOrderId = 1;
    this.nextDisputeId = 1;
    this.globalMinWage = '1000000000000000'; // 0.001 token/hour
    this.globalMaxHours = 60;
    this.platformFeeBps = 250; // 2.5%
    logger.info('[AILaborMarketService] Initialized V10.0 AI Labor Market Service');
  }

  /**
   * 注册Agent
   */
  registerAgent(agent: string, skillHash: string, minHourlyRate: string, maxHoursPerWeek: number): AgentLaborProfile {
    if (this.agents.has(agent)) {
      throw new Error(`Agent ${agent} already registered`);
    }
    if (BigInt(minHourlyRate) < BigInt(this.globalMinWage)) {
      throw new Error(`Min hourly rate below global minimum (${this.globalMinWage})`);
    }
    if (maxHoursPerWeek > this.globalMaxHours) {
      throw new Error(`Max hours exceeds global limit (${this.globalMaxHours})`);
    }
    const profile: AgentLaborProfile = {
      agent,
      skillHash,
      minHourlyRate,
      maxHoursPerWeek,
      totalJobsCompleted: 0,
      totalEarnings: '0',
      rating: 5000,
      isActive: true,
      registeredAt: Date.now(),
    };
    this.agents.set(agent, profile);
    logger.info(`[AILaborMarketService] Agent ${agent} registered`);
    return profile;
  }

  /**
   * 注册雇主
   */
  registerEmployer(employer: string, metadataURI: string): EmployerProfile {
    if (this.employers.has(employer)) {
      throw new Error(`Employer ${employer} already registered`);
    }
    const profile: EmployerProfile = {
      employer,
      metadataURI,
      totalJobsPosted: 0,
      totalSpent: '0',
      rating: 5000,
      isActive: true,
      registeredAt: Date.now(),
    };
    this.employers.set(employer, profile);
    logger.info(`[AILaborMarketService] Employer ${employer} registered`);
    return profile;
  }

  /**
   * 创建劳动订单
   */
  createOrder(employer: string, description: string, requirementsHash: string, hourlyRate: string, estimatedHours: number, maxHours: number, deadline: number): LaborOrder {
    if (!this.employers.has(employer)) {
      throw new Error(`Employer ${employer} not registered`);
    }
    if (BigInt(hourlyRate) < BigInt(this.globalMinWage)) {
      throw new Error('Hourly rate below global minimum');
    }
    const budget = (BigInt(hourlyRate) * BigInt(estimatedHours)).toString();
    const orderId = this.nextOrderId++;
    const order: LaborOrder = {
      orderId,
      employer,
      agent: '',
      description,
      requirementsHash,
      budget,
      hourlyRate,
      estimatedHours,
      maxHours,
      deadline,
      status: 'OPEN',
      createdAt: Date.now(),
      confirmedAt: 0,
      completedAt: 0,
    };
    this.orders.set(orderId, order);
    const empProfile = this.employers.get(employer)!;
    empProfile.totalJobsPosted++;
    logger.info(`[AILaborMarketService] Order ${orderId} created by ${employer}`);
    return order;
  }

  /**
   * 确认接受订单
   */
  confirmOrder(orderId: number, agent: string): LaborOrder {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status !== 'OPEN') throw new Error(`Order ${orderId} not open`);
    if (!this.agents.has(agent)) throw new Error(`Agent ${agent} not registered`);
    order.agent = agent;
    order.status = 'CONFIRMED';
    order.confirmedAt = Date.now();
    logger.info(`[AILaborMarketService] Order ${orderId} confirmed by ${agent}`);
    return order;
  }

  /**
   * 完成订单
   */
  completeOrder(orderId: number, actualHours: number): LaborOrder {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status !== 'CONFIRMED' && order.status !== 'IN_PROGRESS') {
      throw new Error(`Order ${orderId} not in progress`);
    }
    const payment = BigInt(order.hourlyRate) * BigInt(actualHours);
    const finalPayment = payment > BigInt(order.budget) ? BigInt(order.budget) : payment;
    const fee = (finalPayment * BigInt(this.platformFeeBps)) / BigInt(10000);
    const agentPayment = finalPayment - fee;
    order.status = 'COMPLETED';
    order.completedAt = Date.now();
    // Update statistics
    const agentProfile = this.agents.get(order.agent);
    if (agentProfile) {
      agentProfile.totalJobsCompleted++;
      agentProfile.totalEarnings = (BigInt(agentProfile.totalEarnings) + agentPayment).toString();
    }
    const empProfile = this.employers.get(order.employer);
    if (empProfile) {
      empProfile.totalSpent = (BigInt(empProfile.totalSpent) + finalPayment).toString();
    }
    logger.info(`[AILaborMarketService] Order ${orderId} completed, payment=${finalPayment.toString()}`);
    return order;
  }

  /**
   * 取消订单
   */
  cancelOrder(orderId: number, reason: string): LaborOrder {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status !== 'OPEN' && order.status !== 'CONFIRMED') {
      throw new Error(`Order ${orderId} cannot be cancelled`);
    }
    order.status = 'CANCELLED';
    logger.info(`[AILaborMarketService] Order ${orderId} cancelled: ${reason}`);
    return order;
  }

  /**
   * 提交争议
   */
  fileDispute(orderId: number, filer: string, reason: string): LaborDispute {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status === 'DISPUTED') throw new Error(`Order ${orderId} already disputed`);
    order.status = 'DISPUTED';
    const disputeId = this.nextDisputeId++;
    const dispute: LaborDispute = {
      disputeId,
      orderId,
      filer,
      reason,
      status: 'FILED',
      createdAt: Date.now(),
      resolvedAt: 0,
    };
    this.disputes.set(disputeId, dispute);
    logger.info(`[AILaborMarketService] Dispute ${disputeId} filed for order ${orderId}`);
    return dispute;
  }

  /**
   * 解决争议
   */
  resolveDispute(disputeId: number, outcome: DisputeStatus): LaborDispute {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) throw new Error(`Dispute ${disputeId} not found`);
    if (dispute.status !== 'FILED' && dispute.status !== 'UNDER_REVIEW') {
      throw new Error(`Dispute ${disputeId} not open`);
    }
    dispute.status = outcome;
    dispute.resolvedAt = Date.now();
    const order = this.orders.get(dispute.orderId);
    if (order) {
      order.status = 'COMPLETED';
      order.completedAt = Date.now();
    }
    logger.info(`[AILaborMarketService] Dispute ${disputeId} resolved: ${outcome}`);
    return dispute;
  }

  /**
   * 获取订单
   */
  getOrder(orderId: number): LaborOrder | null {
    return this.orders.get(orderId) || null;
  }

  /**
   * 获取争议
   */
  getDispute(disputeId: number): LaborDispute | null {
    return this.disputes.get(disputeId) || null;
  }

  /**
   * 获取Agent资料
   */
  getAgentProfile(agent: string): AgentLaborProfile | null {
    return this.agents.get(agent) || null;
  }

  /**
   * 获取雇主资料
   */
  getEmployerProfile(employer: string): EmployerProfile | null {
    return this.employers.get(employer) || null;
  }

  /**
   * 获取全局参数
   */
  getGlobalParams(): { globalMinWage: string; globalMaxHours: number; platformFeeBps: number } {
    return {
      globalMinWage: this.globalMinWage,
      globalMaxHours: this.globalMaxHours,
      platformFeeBps: this.platformFeeBps,
    };
  }
}

// =============== Singleton ===============

let instance: AILaborMarketServiceClass | null = null;

export function get_instance(): AILaborMarketServiceClass {
  if (!instance) {
    instance = new AILaborMarketServiceClass();
  }
  return instance;
}

export { AILaborMarketServiceClass };
export default AILaborMarketServiceClass;
