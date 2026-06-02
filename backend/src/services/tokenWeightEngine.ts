/**
 * tokenWeightEngine — V14.0 Token-Weight 激励引擎
 * 对应文章1 §2.2 + 文章2：Token是智能体的状态机
 *
 * 核心公式:
 * - Token = ⟨sym, χ, ρ, κ⟩ 四重属性
 * - Weight = (利[突触权重], 名[偏置项], 权[门控机制]) 三类
 * - 十二面灵球: Token₄ × Weight₃ = 12维文明交互空间
 * - Gi-Gi 握手: w_{ab} += η · ρ_{sal}(τ) · α_b
 *
 * 神经映射:
 *   [利] → Synaptic Weights  (突触权重，物质连接强度)
 *   [名] → Bias              (偏置项，神经元自身兴奋基线)
 *   [权] → Gate              (门控机制，控制信息流开关)
 */

import logger from '../utils/logger';

// =============== Types ===============

/**
 * Token 四重属性
 * 定义4.1: Token = ⟨sym, χ, ρ, κ⟩
 */
export interface Token {
  id: string;
  sym: string;           // 语义内容 (semantic content)
  chi: PortHandedness;   // 端口手性 (Port handedness: -2..+2)
  rho: number;           // 紧急性/价值势 (urgency/value potential, 0-10000)
  kappa: string;         // 事务锚点 (transaction anchor / context hash)
  sender: string;        // 发送方 Agent ID
  senderWeight: Weight;   // 发送方 Weight 背书
  timestamp: number;
  ttl: number;           // TTL 存活时间 (秒)
}

/**
 * Weight 三类（对应神经网络三重权重）
 */
export interface Weight {
  li: number;   // [利] 突触权重 Synaptic Weights (0-10000)
  ming: number; // [名] 偏置项 Bias (0-10000)
  quan: number; // [权] 门控机制 Gate (0-10000, 0=完全关闭)
}

/**
 * 端口手性 χ (Port Handedness)
 * 取值范围: -2..+2
 */
export enum PortHandedness {
  STRONG_NEGATIVE = -2,  // 强反对
  WEAK_NEGATIVE = -1,   // 弱反对
  NEUTRAL = 0,           // 中性
  WEAK_POSITIVE = 1,     // 弱支持
  STRONG_POSITIVE = 2,    // 强支持
}

/**
 * 十二面灵球顶点（正十二面体12个顶点）
 * Token₄ × Weight₃ = 12 维文明交互空间
 */
export enum DodecahedralVertex {
  // 高[利] 组 (利=10000)
  V1_HIGH_LI_HIGH_MING = 1,   // 高[利]+高[名]：市场交易（买方强势）
  V2_HIGH_LI_HIGH_QUAN = 2,   // 高[利]+高[权]：商业制裁（巨头封杀）
  V3_HIGH_LI_NEUTRAL = 3,     // 高[利]+中性：普通交易
  V4_HIGH_LI_LOW_MING = 4,     // 高[利]+低[名]：匿名大额交易

  // 高[名] 组 (名=10000)
  V5_HIGH_MING_HIGH_QUAN = 5,  // 高[名]+高[权]：学术权威（导师指导）
  V6_HIGH_MING_HIGH_LI = 6,    // 高[名]+高[利]：诺奖得主投资推荐
  V7_HIGH_MING_NEUTRAL = 7,    // 高[名]+中性：普通学术建议
  V8_HIGH_MING_LOW_QUAN = 8,    // 高[名]+低[权]：民间智者

  // 高[权] 组 (权=10000)
  V9_HIGH_QUAN_HIGH_LI = 9,    // 高[权]+高[利]：法官判决+赔偿
  V10_HIGH_QUAN_HIGH_MING = 10,  // 高[权]+高[名]：组织部门任免
  V11_HIGH_QUAN_NEUTRAL = 11,   // 高[权]+中性：纪委巡视
  V12_HIGHEST_QUAN = 12,       // 最高[权]：紧急避险（熔断机制）

  // 低维组合 (利/名/权均低)
  V0_LOW_DIMENSION = 0,         // 低维：普通日常交互
}

/**
 * Gi-Gi 握手记录（金灵球握手）
 */
export interface GiGiHandshake {
  id: string;
  senderId: string;
  receiverId: string;
  token: Token;
  weightDelta: number;    // w_{ab} 变化量
  gateOpen: boolean;      // Gate 是否打开
  biasActivated: boolean;  // Bias 是否激活（高[名]无需二次验证）
  timestamp: number;
  success: boolean;
}

/**
 * 十二面灵球交互记录
 */
export interface DodecahedralInteraction {
  id: string;
  vertex: DodecahedralVertex;
  token: Token;
  senderState: number[];   // 发送方 GRU 隐状态 h_a^t
  receiverState: number[];  // 接收方 GRU 隐状态 h_b^t
  weight: Weight;
  result: 'ACCEPTED' | 'REJECTED' | 'GATE_CLOSED' | 'BIAS_ACTIVATED';
  timestamp: number;
}

// =============== Engine ===============

class TokenWeightEngine {
  private handshakes: Map<string, GiGiHandshake> = new Map();
  private interactions: DodecahedralInteraction[] = [];
  private readonly LEARNING_RATE = 0.01; // η (eta) 学习率

  // ------ Token 创建 ------

  /**
   * 创建 Token（四重属性）
   */
  createToken(
    sym: string,
    chi: PortHandedness,
    rho: number,
    kappa: string,
    sender: string,
    senderWeight: Weight
  ): Token {
    const token: Token = {
      id: `tk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      sym,
      chi,
      rho: Math.max(0, Math.min(10000, rho)),
      kappa,
      sender,
      senderWeight,
      timestamp: Date.now(),
      ttl: 300, // 默认5分钟TTL
    };

    logger.info(`[TokenWeightEngine] Token created: ${token.id}, sym=${sym}, chi=${chi}, rho=${rho}`);
    return token;
  }

  // ------ Gi-Gi 握手机制 ------

  /**
   * Gi-Gi 握手（定义4.1）
   * 公式: w_{ab} += η · ρ_{sal}(τ) · α_b
   */
  performHandshake(
    senderId: string,
    receiverId: string,
    token: Token,
    receiverWeight: Weight
  ): GiGiHandshake {
    // 1. 端口手性兼容检查
    const compatible = this.checkPortCompatibility(token.chi, receiverWeight);
    
    if (!compatible) {
      const handshake: GiGiHandshake = {
        id: `hs_${Date.now()}`,
        senderId,
        receiverId,
        token,
        weightDelta: 0,
        gateOpen: false,
        biasActivated: false,
        timestamp: Date.now(),
        success: false,
      };
      this.handshakes.set(handshake.id, handshake);
      logger.warn(`[TokenWeightEngine] Handshake REJECTED: port incompatible, chi=${token.chi}`);
      return handshake;
    }

    // 2. 神经权重更新: w_{ab} += η · ρ_{sal}(τ) · α_b
    const weightDelta = this.LEARNING_RATE * this.saliency(token.rho) * this.alpha(receiverWeight);
    
    // 3. 门控检查 (C核 = Gate)
    const gateOpen = this.checkGate(token.senderWeight.quan, token.chi);
    
    // 4. 偏置检查 (高[名]无需二次验证)
    const biasActivated = token.senderWeight.ming > 7000;

    let success = true;
    if (!gateOpen) {
      success = false;
      logger.warn(`[TokenWeightEngine] Handshake REJECTED: Gate CLOSED, quan=${token.senderWeight.quan}`);
    }

    const handshake: GiGiHandshake = {
      id: `hs_${Date.now()}`,
      senderId,
      receiverId,
      token,
      weightDelta,
      gateOpen,
      biasActivated,
      timestamp: Date.now(),
      success,
    };

    this.handshakes.set(handshake.id, handshake);

    if (success) {
      logger.info(`[TokenWeightEngine] Handshake SUCCESS: ${handshake.id}, Δw=${weightDelta.toFixed(6)}`);
    }

    return handshake;
  }

  /**
   * 端口手性兼容检查
   */
  private checkPortCompatibility(chi: PortHandedness, receiverWeight: Weight): boolean {
    // 简化逻辑：手性为中性时总是兼容；强反对时需要有高[权]覆盖
    if (chi === PortHandedness.NEUTRAL) return true;
    if (chi === PortHandedness.STRONG_NEGATIVE && receiverWeight.quan < 5000) return false;
    return true;
  }

  /**
   * 门控检查 (Gate = [权])
   * 高[权]发送方可以强制打开接收方 Gate
   */
  private checkGate(quan: number, chi: PortHandedness): boolean {
    if (quan > 8000) return true;  // 高[权]强制开门
    if (chi === PortHandedness.STRONG_POSITIVE && quan > 5000) return true;
    if (chi === PortHandedness.NEUTRAL) return true;
    return quan > 3000;
  }

  /**
   * 显著性函数 ρ_{sal}(τ) = ρ / 10000
   */
  private saliency(rho: number): number {
    return rho / 10000;
  }

  /**
   * 接收方声望 α_b = [名] / 10000
   */
  private alpha(receiverWeight: Weight): number {
    return receiverWeight.ming / 10000;
  }

  // ------ 十二面灵球计算 ------

  /**
   * 将 Token + Weight 映射到十二面灵球顶点
   * Token₄ × Weight₃ = 12 维
   */
  mapToDodecahedralVertex(token: Token, weight: Weight): DodecahedralVertex {
    const li = weight.li;
    const ming = weight.ming;
    const quan = weight.quan;

    // 高[利] 组
    if (li > 7000) {
      if (ming > 7000) return DodecahedralVertex.V1_HIGH_LI_HIGH_MING;
      if (quan > 7000) return DodecahedralVertex.V2_HIGH_LI_HIGH_QUAN;
      if (ming < 3000) return DodecahedralVertex.V4_HIGH_LI_LOW_MING;
      return DodecahedralVertex.V3_HIGH_LI_NEUTRAL;
    }

    // 高[名] 组
    if (ming > 7000) {
      if (quan > 7000) return DodecahedralVertex.V5_HIGH_MING_HIGH_QUAN;
      if (li > 7000) return DodecahedralVertex.V6_HIGH_MING_HIGH_LI;
      if (quan < 3000) return DodecahedralVertex.V8_HIGH_MING_LOW_QUAN;
      return DodecahedralVertex.V7_HIGH_MING_NEUTRAL;
    }

    // 高[权] 组
    if (quan > 7000) {
      if (li > 7000) return DodecahedralVertex.V9_HIGH_QUAN_HIGH_LI;
      if (ming > 7000) return DodecahedralVertex.V10_HIGH_QUAN_HIGH_MING;
      return DodecahedralVertex.V11_HIGH_QUAN_NEUTRAL;
    }

    // 最高[权]（熔断机制）
    if (quan > 9500) return DodecahedralVertex.V12_HIGHEST_QUAN;

    return DodecahedralVertex.V0_LOW_DIMENSION;
  }

  /**
   * 记录十二面灵球交互
   */
  recordDodecahedralInteraction(
    token: Token,
    senderId: string,
    receiverId: string,
    senderState: number[],
    receiverState: number[],
    receiverWeight: Weight
  ): DodecahedralInteraction {
    const vertex = this.mapToDodecahedralVertex(token, token.senderWeight);
    
    const handshake = this.performHandshake(senderId, receiverId, token, receiverWeight);
    
    const interaction: DodecahedralInteraction = {
      id: `dod_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      vertex,
      token,
      senderState,
      receiverState,
      weight: token.senderWeight,
      result: handshake.success ? 'ACCEPTED' : (handshake.gateOpen ? 'BIAS_ACTIVATED' : 'GATE_CLOSED'),
      timestamp: Date.now(),
    };

    this.interactions.push(interaction);
    logger.info(`[TokenWeightEngine] Dodecahedral interaction: vertex=${vertex}, result=${interaction.result}`);
    
    return interaction;
  }

  /**
   * 获取十二面灵球统计
   */
  getDodecahedralStats(): Record<string, unknown> {
    const vertexCounts: Record<string, number> = {};
    const resultCounts: Record<string, number> = {};

    for (const interaction of this.interactions) {
      const vKey = `V${interaction.vertex}`;
      vertexCounts[vKey] = (vertexCounts[vKey] || 0) + 1;
      resultCounts[interaction.result] = (resultCounts[interaction.result] || 0) + 1;
    }

    return {
      totalInteractions: this.interactions.length,
      vertexDistribution: vertexCounts,
      resultDistribution: resultCounts,
      totalHandshakes: this.handshakes.size,
    };
  }

  // ------ Weight 操作 ------

  /**
   * 更新 Weight（神经网络权重更新）
   */
  updateWeight(current: Weight, deltaLi: number, deltaMing: number, deltaQuan: number): Weight {
    return {
      li: Math.max(0, Math.min(10000, current.li + deltaLi)),
      ming: Math.max(0, Math.min(10000, current.ming + deltaMing)),
      quan: Math.max(0, Math.min(10000, current.quan + deltaQuan)),
    };
  }

  /**
   * 计算 Token 价值势（综合评分）
   */
  calculateTokenValue(token: Token): number {
    const liComponent = token.senderWeight.li * 0.4;
    const mingComponent = token.senderWeight.ming * 0.3;
    const quanComponent = token.senderWeight.quan * 0.3;
    const rhoComponent = token.rho * 0.1;
    return liComponent + mingComponent + quanComponent + rhoComponent;
  }
}

const tokenWeightEngine = new TokenWeightEngine();
export { tokenWeightEngine };
