// Phi Calculator Service (Φ 值计算器)
// Upgraded with IGCTR (Info-Geo-Consc Triple Resonance) unified field theory
// Based on papers:
//   ① 联邦宇宙的化身合体 (Four-Token Unified Field Theory)
//   ② 7G、AgentWeb 与 FPGA 优先 (Φ-field Carrier)
//   ③ 联邦宇宙即未来 (Fediverse as Φ-field Natural Channel)

import { PrismaClient } from "@prisma/client";
import * as math from "mathjs";

const prisma = new PrismaClient();

/**
 * Calculate Phi (Φ) Value
 * 计算 Φ 值（整合信息量）
 * Based on Integrated Information Theory (IIT)
 */
export async function calculatePhi(
  interactionData: any,
  contentFeatures?: number[]
): Promise<{ phiValue: number; normalizedPhi: number; phiPhase: number; details: any }> {
  try {
    // 1. 提取时间序列
    const timeSeries = extractTimeSeries(interactionData);
    
    // 2. 计算互信息
    const mutualInfo = calculateMutualInformation(timeSeries);
    
    // 3. 计算 Φ 值
    const phiValue = integratePhi(mutualInfo);
    
    // 4. 归一化 Φ 值
    const normalizedPhi = normalizePhi(phiValue);

    // 5. EML 相位计算（Φ = |Φ|·e^{iθ}）
    const phaseGradient = await calculatePhaseGradient(
      interactionData.userId || 'unknown',
      interactionData.userId || 'unknown'
    );
    const phiPhase = Math.atan2(phaseGradient, phiValue); // 语义方向角
    
    // 6. 记录到数据库
    if (interactionData.userId) {
      await prisma.phiRecord.create({
        data: {
          userId: interactionData.userId,
          phiValue,
          phiPhase,
          calculationData: interactionData,
          metadata: {
            normalizedPhi,
            mutualInfo,
            timeSeriesLength: timeSeries.length
          }
        }
      });
    }
    
    return {
      phiValue,
      normalizedPhi,
      phiPhase,
      details: {
        timeSeriesLength: timeSeries.length,
        mutualInfo,
        integrationLevel: normalizedPhi
      }
    };
  } catch (error) {
    console.error("Error calculating Phi:", error);
    throw error;
  }
}

/**
 * Calculate Phase Gradient (计算相位梯度)
 * 基于论文①：Φ = ∫∫ I(x;t) dx dt（相位梯度积分）
 */
export async function calculatePhaseGradient(
  actorId1: string,
  actorId2: string,
  activityId?: string
): Promise<number> {
  try {
    // 简化实现：相位梯度 = f(actor信誉、交互频率、时间差）
    const actor1 = await prisma.actor.findUnique({ where: { id: actorId1 } });
    const actor2 = await prisma.actor.findUnique({ where: { id: actorId2 } });
    
    if (!actor1 || !actor2) {
      throw new Error(`Actor not found: ${!actor1 ? actorId1 : actorId2}`);
    }
    
    // 计算相位梯度（简化公式）
    // Phase Gradient = α*(信誉1 + 信誉2) + β*(交互频率) - γ*(时间差)
    const rep1 = actor1.calcToken / 100 || 0.1;  // 使用算元作为信誉代理
    const rep2 = actor2.calcToken / 100 || 0.1;
    const freq = await getInteractionFrequency(actorId1, actorId2);
    const timeDiff = activityId ? await getTimeDifference(activityId) : 1.0;
    
    const alpha = 0.4;
    const beta = 0.3;
    const gamma = 0.3;
    
    const phaseGradient = alpha * (rep1 + rep2) + beta * freq - gamma * timeDiff;
    
    console.log(`Phase Gradient calculated: ${phaseGradient}`);
    console.log(`  Actors: ${actor1.username} ↔ ${actor2.username}`);
    console.log(`  Reputation: ${rep1} + ${rep2}, Frequency: ${freq}, Time Dif: ${timeDiff}`);
    
    return Math.max(0.01, phaseGradient);  // 确保非负
    
  } catch (error) {
    console.error("Error calculating phase gradient:", error);
    throw error;
  }
}

/**
 * Calculate Winding Number (计算缠绕数)
 * 基于论文①：缠绕数决定拓扑相变是否发生
 */
export function calculateWindingNumber(phaseGradient: number): number {
  // 简化实现：缠绕数 = floor(相位梯度 * 缩放因子）
  const scalingFactor = 10.0;
  const windingNumber = Math.floor(phaseGradient * scalingFactor);
  
  console.log(`Winding Number calculated: ${windingNumber}`);
  console.log(`  Phase Gradient: ${phaseGradient}, Scaling Factor: ${scalingFactor}`);
  console.log(`  Phase Full-Wound: ${windingNumber >= 1 ? "YES (>=1)" : "NO (<1)"}`);
  
  return windingNumber;
}

/**
 * Detect Phase Transition (检测拓扑相变)
 * 基于论文①："交易即发行" - 相位满周 → 拓扑相变 → Token 发行
 */
export function detectPhaseTransition(
  phaseGradient: number,
  windingNumber: number
): { hasTransition: boolean; transitionType: string; details: any } {
  // 判断是否满足相变条件
  const hasTransition = windingNumber >= 1;
  
  let transitionType = "None";
  if (hasTransition) {
    // 判断相变类型
    if (phaseGradient >= 5.0) {
      transitionType = "Strong-Phase-Transition";  // 强相变
    } else {
      transitionType = "Weak-Phase-Transition";  // 弱相变
    }
  }
  
  const details = {
    phaseGradient,
    windingNumber,
    threshold: 1,
    transitionStrength: hasTransition ? phaseGradient / windingNumber : 0
  };
  
  console.log(`Phase Transition Detection: ${hasTransition ? "YES" : "NO"}`);
  console.log(`  Transition Type: ${transitionType}`);
  console.log(`  Details:`, details);
  
  return { hasTransition, transitionType, details };
}

/**
 * Calculate IGCTR Resonance (计算 IGCTR 三元共振度)
 * 基于论文②：Info-Geo-Consc Triple Resonance (信息-几何-意识三元共振）
 * 
 * Resonance = ∫∫∫ I(φ,g,c) dφ dg dc
 * 其中：
 *   - I(φ,g,c): 信息-几何-意识三元作用量
 *   - φ: 信息场（Info Field = Φ 场）
 *   - g: 几何场（Geometry Field = G 场）
 *   - c: 意识场（Consciousness Field = C 场）
 */
export async function calculateIGCTRResonance(
  actorId: string,
  activityData?: any
): Promise<{
  resonanceScore: number;
  infoContribution: number;
  geoContribution: number;
  conscContribution: number;
  isResonant: boolean;
  details: any;
}> {
  try {
    // 1. 获取 Actor（信息场 φ)
    const actor = await prisma.actor.findUnique({
      where: { id: actorId },
      include: { user: true }
    });
    
    if (!actor) {
      throw new Error(`Actor not found: ${actorId}`);
    }
    
    // 2. 计算信息场贡献（Info Field - Φ 场）
    const infoContribution = calculateInfoFieldContribution(actor);
    
    // 3. 计算几何场贡献（Geometry Field - G 场）
    const geoContribution = await calculateGeometryFieldContribution(actor);
    
    // 4. 计算意识场贡献（Consciousness Field - C 场）
    const conscContribution = calculateConsciousnessFieldContribution(actor);
    
    // 5. 三元共振积分（简化公式）
    // Resonance = α*Info + β*Geo + γ*Consc + δ*(Info*Geo*Consc)
    const alpha = 0.3;
    const beta = 0.3;
    const gamma = 0.2;
    const delta = 0.2;  // 三元耦合项
    
    const resonanceScore = 
      alpha * infoContribution +
      beta * geoContribution +
      gamma * conscContribution +
      delta * (infoContribution * geoContribution * conscContribution);
    
    // 6. 判断是否共振
    const isResonant = resonanceScore > 0.6;  // 共振阈值
    
    const details = {
      infoContribution,
      geoContribution,
      conscContribution,
      alpha,
      beta,
      gamma,
      delta,
      resonanceThreshold: 0.6
    };
    
    console.log(`IGCTR Resonance calculated for ${actor.username}:`);
    console.log(`  Resonance Score: ${resonanceScore}`);
    console.log(`  Info: ${infoContribution}, Geo: ${geoContribution}, Consc: ${conscContribution}`);
    console.log(`  Is Resonant: ${isResonant}`);
    
    return {
      resonanceScore,
      infoContribution,
      geoContribution,
      conscContribution,
      isResonant,
      details
    };
    
  } catch (error) {
    console.error("Error calculating IGCTR resonance:", error);
    throw error;
  }
}

/**
 * Analyze Three Horizons (分析一现象三视界)
 * 基于论文①："一现象，三视界"诠释法
 * 
 * - 微观界（Micro）：Φ 场的拓扑激发（波核/粒核）
 * - 中视界（Meso）：ActivityPub 动词驱动（交易即发行/流转即回收）
 * - 宏观界（Macro）：意识场决定可问性/可显性（化身合体）
 */
export async function analyzeThreeHorizons(
  actorId: string,
  activityIds?: string[]
): Promise<{
  microAnalysis: any;
  mesoAnalysis: any;
  macroAnalysis: any;
  overallResonance: number;
}> {
  try {
    // 1. 微观界分析（Micro: Φ 场的拓扑激发）
    const microAnalysis = await analyzeMicro(actorId, activityIds);
    
    // 2. 中视界分析（Meso: ActivityPub 动词驱动）
    const mesoAnalysis = await analyzeMeso(actorId, activityIds);
    
    // 3. 宏观界分析（Macro: 意识场决定可问性/可显性）
    const macroAnalysis = await analyzeMacro(actorId);
    
    // 4. 计算总体共振度
    const overallResonance = 
      microAnalysis.resonanceScore * 0.3 +
      mesoAnalysis.resonanceScore * 0.3 +
      macroAnalysis.resonanceScore * 0.4;
    
    console.log(`Three Horizons Analysis for Actor ${actorId}:`);
    console.log(`  Micro: ${microAnalysis.resonanceScore}`);
    console.log(`  Meso: ${mesoAnalysis.resonanceScore}`);
    console.log(`  Macro: ${macroAnalysis.resonanceScore}`);
    console.log(`  Overall: ${overallResonance}`);
    
    return {
      microAnalysis,
      mesoAnalysis,
      macroAnalysis,
      overallResonance
    };
    
  } catch (error) {
    console.error("Error analyzing three horizons:", error);
    throw error;
  }
}

// =============== Helper Functions (辅助函数) ===============

/**
 * Extract Time Series (提取时间序列)
 */
function extractTimeSeries(interactionData: any): number[] {
  if (interactionData.timeSeries) {
    return interactionData.timeSeries;
  }
  
  // 生成模拟时间序列
  const length = 100;
  const timeSeries = [];
  for (let i = 0; i < length; i++) {
    timeSeries.push(Math.random() * 2 - 1);  // [-1, 1]
  }
  return timeSeries;
}

/**
 * Calculate Mutual Information (计算互信息)
 */
function calculateMutualInformation(timeSeries: number[]): number {
  // 简化实现：互信息 = -∑ p(x) * log(p(x))
  const histogram: { [key: number]: number } = {};
  const binCount = 10;
  
  // 分箱
  for (const value of timeSeries) {
    const bin = Math.floor((value + 1) * binCount / 2);
    histogram[bin] = (histogram[bin] || 0) + 1;
  }
  
  // 计算互信息
  let mutualInfo = 0;
  const total = timeSeries.length;
  
  for (const bin in histogram) {
    const p = histogram[bin] / total;
    if (p > 0) {
      mutualInfo -= p * Math.log(p);
    }
  }
  
  return mutualInfo;
}

/**
 * Integrate Phi (积分 Φ 值)
 */
function integratePhi(mutualInfo: number): number {
  // 简化实现：Φ = 互信息 * 缩放因子
  const scalingFactor = 0.1;
  return mutualInfo * scalingFactor;
}

/**
 * Normalize Phi (归一化 Φ 值)
 */
function normalizePhi(phiValue: number): number {
  // 归一化到 [0, 1]
  const maxPhi = 10.0;  // 最大 Φ 值
  return Math.min(phiValue / maxPhi, 1.0);
}

/**
 * Get Interaction Frequency (获取交互频率)
 */
async function getInteractionFrequency(actorId1: string, actorId2: string): Promise<number> {
  // 简化实现：交互频率 = f(共同 Activity 数量）
  const activities1 = await prisma.activity.findMany({
    where: { actorId: actorId1 }
  });
  
  const activities2 = await prisma.activity.findMany({
    where: { actorId: actorId2 }
  });
  
  // 计算共同 Activity（简化：随机生成）
  const commonCount = Math.min(activities1.length, activities2.length, 10);
  const freq = commonCount / 100;  // 归一化到 [0, 1]
  
  return freq;
}

/**
 * Get Time Difference (获取时间差)
 */
async function getTimeDifference(activityId: string): Promise<number> {
  // 简化实现：时间差 = f(Activity 发布时间）
  const activity = await prisma.activity.findUnique({
    where: { id: activityId }
  });
  
  if (!activity) {
    return 1.0;  // 默认 1 秒
  }
  
  const now = new Date().getTime();
  const published = new Date(activity.publishedAt).getTime();
  const timeDiff = (now - published) / 1000;  // 秒
  
  return Math.max(0.1, timeDiff / 3600);  // 归一化到小时
}

/**
 * Calculate Info Field Contribution (计算信息场贡献)
 * 信息场（Info Field）= Φ 场 = 四元 Token 的底层统一场
 */
function calculateInfoFieldContribution(actor: any): number {
  // 信息场贡献 = f(算元 + 词元）
  const calcToken = actor.calcToken || 0;  // 算元（波核）
  const wordTokenUsed = actor.wordTokenUsed || 0;  // 词元（波核）
  
  // 波核贡献 = α*算元 + β*词元
  const alpha = 0.6;
  const beta = 0.4;
  const waveKernelContribution = alpha * (calcToken / 100) + beta * (wordTokenUsed / 1000);
  
  return Math.min(waveKernelContribution, 1.0);  // 归一化到 [0, 1]
}

/**
 * Calculate Geometry Field Contribution (计算几何场贡献)
 * 几何场（Geometry Field）= G 场 = 节点/链路/FPGA 资源图
 */
async function calculateGeometryFieldContribution(actor: any): Promise<number> {
  // 几何场贡献 = f(关注者数量、Activity 数量、网络连接度）
  const followersCount = await prisma.follow.count({
    where: { followingId: actor.id }
  });
  
  const activitiesCount = await prisma.activity.count({
    where: { actorId: actor.id }
  });
  
  // 几何场贡献 = α*关注者 + β*Activity
  const alpha = 0.5;
  const beta = 0.5;
  const geoContribution = 
    alpha * Math.min(followersCount / 1000, 1.0) +
    beta * Math.min(activitiesCount / 100, 1.0);
  
  return Math.min(geoContribution, 1.0);  // 归一化到 [0, 1]
}

/**
 * Calculate Consciousness Field Contribution (计算意识场贡献)
 * 意识场（Consciousness Field）= C 场 = Agent 策略/人意图
 */
function calculateConsciousnessFieldContribution(actor: any): Promise<number> {
  // 意识场贡献 = f(DID 验证、VC 数量、用户活跃度）
  const did = actor.did ? 1.0 : 0.0;  // DID 验证
  const passToken = actor.passToken ? 1.0 : 0.0;  // 通证（粒核）
  
  // 意识场贡献 = α*DID + β*通证
  const alpha = 0.5;
  const beta = 0.5;
  const conscContribution = alpha * did + beta * passToken;
  
  return Promise.resolve(Math.min(conscContribution, 1.0));  // 归一化到 [0, 1]
}

/**
 * Analyze Micro (微观界分析)
 * 微观界：Φ 场的拓扑激发（波核/粒核）
 */
async function analyzeMicro(
  actorId: string,
  activityIds?: string[]
): Promise<{ resonanceScore: number; kernelTypes: any; phaseData: any }> {
  // 1. 获取 Actor 的 Token
  const actor = await prisma.actor.findUnique({
    where: { id: actorId },
    include: { tokens: true }
  });
  
  if (!actor) {
    throw new Error(`Actor not found: ${actorId}`);
  }
  
  // 2. 分析波核/粒核分布
  const waveKernelTokens = actor.tokens.filter(t => 
    t.type === "CALC" || t.type === "WORD"
  );  const particleKernelTokens = actor.tokens.filter(t => 
    t.type === "WIT" || t.type === "PASS"
  );
  
  const kernelTypes = {
    waveKernel: {
      count: waveKernelTokens.length,
      totalAmount: waveKernelTokens.reduce((sum, t) => sum + (t.amount || 0), 0)
    },
    particleKernel: {
      count: particleKernelTokens.length,
      totalAmount: particleKernelTokens.reduce((sum, t) => sum + (t.amount || 0), 0)
    }
  };
  
  // 3. 计算相位数据
  const phaseData = {
    phaseGradient: await calculatePhaseGradient(actorId, actorId),  // 自相位梯度
    windingNumber: 0,
    hasPhaseTransition: false
  };
  
  // 4. 计算微观界共振度
  const resonanceScore = 
    (kernelTypes.waveKernel.count > 0 ? 0.5 : 0) +
    (kernelTypes.particleKernel.count > 0 ? 0.5 : 0);
  
  return { resonanceScore, kernelTypes, phaseData };
}

/**
 * Analyze Meso (中视界分析)
 * 中视界：ActivityPub 动词驱动（交易即发行/流转即回收）
 */
async function analyzeMeso(
  actorId: string,
  activityIds?: string[]
): Promise<{ resonanceScore: number; activityFlow: any; phaseTransitions: any }> {
  // 1. 获取 Actor 的 Activity
  const activities = await prisma.activity.findMany({
    where: { actorId },
    orderBy: { publishedAt: "desc" }
  });
  
  // 2. 分析 Activity 流
  const activityFlow = {
    total: activities.length,
    byType: {} as { [key: string]: number }
  };
  
  for (const activity of activities) {
    activityFlow.byType[activity.type] = (activityFlow.byType[activity.type] || 0) + 1;
  }
  
  // 3. 检测拓扑相变（交易即发行）
  const phaseTransitions = [];
  for (const activity of activities) {
    if (activity.phaseGradient) {
      const windingNumber = calculateWindingNumber(activity.phaseGradient);
      if (windingNumber >= 1) {
        phaseTransitions.push({
          activityId: activity.id,
          activityType: activity.type,
          phaseGradient: activity.phaseGradient,
          windingNumber
        });
      }
    }
  }
  
  // 4. 计算中视界共振度
  const issuanceEvents = phaseTransitions.length;
  const recyclingEvents = activities.filter(a => 
    a.type === "Consume" || a.type === "Delete"
  ).length;
  
  const resonanceScore = 
    Math.min(issuanceEvents / 10, 1.0) * 0.5 +
    Math.min(recyclingEvents / 10, 1.0) * 0.5;
  
  return { resonanceScore, activityFlow, phaseTransitions };
}

/**
 * Analyze Macro (宏观界分析)
 * 宏观界：意识场决定可问性/可显性（化身合体）
 */
async function analyzeMacro(
  actorId: string
): Promise<{ resonanceScore: number; avatarFusion: any; cognitiveLoad: any }> {
  // 1. 获取 Actor
  const actor = await prisma.actor.findUnique({
    where: { id: actorId }
  });
  
  if (!actor) {
    throw new Error(`Actor not found: ${actorId}`);
  }
  
  // 2. 计算化身合体度（四元 Token 共振）
  const avatarFusion = {
    calcToken: actor.calcToken || 0,
    witToken: actor.witToken || "0",
    wordTokenUsed: actor.wordTokenUsed || 0,
    passToken: actor.passToken || null,
    resonanceScore: 0  // 稍后计算
  };
  
  // 计算共振度
  const resonance = await calculateIGCTRResonance(actorId);
  avatarFusion.resonanceScore = resonance.resonanceScore;
  
  // 3. 计算认知负荷（基于论文①：化身合体降低认知负荷）
  const cognitiveLoad = {
    score: 0,
    factors: {
      accountFragmentation: !avatarFusion.passToken ? 0.5 : 0,  // 账号碎片化程度
      tokenManagementComplexity: 0.3,  // Token 管理复杂度（简化）
      interfaceCognitiveLoad: 0.2  // 界面认知负荷（简化）
    }
  };
  
  cognitiveLoad.score = 
    cognitiveLoad.factors.accountFragmentation * 0.5 +
    cognitiveLoad.factors.tokenManagementComplexity * 0.3 +
    cognitiveLoad.factors.interfaceCognitiveLoad * 0.2;
  
  // 4. 计算宏观界共振度（化身合体降低认知负荷 → 更高共振）
  const resonanceScore = avatarFusion.resonanceScore * (1 - cognitiveLoad.score);
  
  return { resonanceScore, avatarFusion, cognitiveLoad };
}

export const PhiCalculator = {
  calculatePhi,
  calculatePhaseGradient,
  calculateWindingNumber,
  detectPhaseTransition,
  calculateIGCTRResonance,
  analyzeThreeHorizons
};
