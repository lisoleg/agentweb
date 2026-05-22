// Four-Token Service (四元 Token 系统)
// Implements: 算元 (Calc-Token), 智元 (Wit-Token), 词元 (Word-Token), 通证 (Pass-Token)
// Based on papers:
//   ① 联邦宇宙的化身合体 (Four-Token Unified Field Theory)
//   ② 7G、AgentWeb 与 FPGA 优先 (Φ-field Carrier)
//   ③ 联邦宇宙即未来 (Fediverse as Φ-field Natural Channel)

import { TokenType, TokenStatus, ActivityType } from "@prisma/client";
import prisma from "../utils/prisma";
import * as crypto from "crypto";
import { PhiCalculator } from "./phiCalculator";


/**
 * Issue Token by Transaction (交易即发行)
 * Token 通过交易（相位缠绕）被创造，而非预先铸造
 * 基于论文①：当相位梯度累积至满周（缠绕数 >= 1），发生拓扑相变，Token 作为事件被"激发"出来
 */
export async function issueTokenByTransaction(
  offerActivity: any,
  acceptActivity: any,
  tokenType?: TokenType,
  amount?: number
): Promise<{ token: any; tokenIssuance: any }> {
  try {
    // 1. 计算相位梯度 (Phase Gradient)
    const phaseGradient = await calculatePhaseGradient(offerActivity, acceptActivity);
    
    // 2. 计算缠绕数 (Winding Number)
    const windingNumber = calculateWindingNumber(phaseGradient);
    
    console.log(`Phase Gradient: ${phaseGradient}, Winding Number: ${windingNumber}`);
    
    // 3. 判断是否满周（缠绕数 >= 1）→ 拓扑相变 → Token 发行
    if (windingNumber >= 1) {
      // 4. 确定 Token 类型（如果未指定，则从 Activity 中检测）
      const detectedTokenType = tokenType || detectTokenType(offerActivity);
      const tokenAmount = amount || calculateTokenAmount(phaseGradient);
      
      // 5. 创建 Token 发行记录 (交易即发行)
      const tokenIssuance = await prisma.tokenIssuance.create({
        data: {
          activityId: acceptActivity.id,
          tokenType: detectedTokenType,
          amount: tokenAmount,
          genesisActivity: offerActivity.id,
          phaseWinding: phaseGradient,
          windingNumber: windingNumber,
          issuedAt: new Date()
        }
      });
      
      // 6. 创建 Token（拓扑相变 - Token 被激发）
      const token = await prisma.token.create({
        data: {
          tokenId: `https://agentweb.example/tokens/${crypto.randomBytes(8).toString("hex")}`,
          type: detectedTokenType,
          subType: getTokenSubType(detectedTokenType),
          amount: tokenAmount,
          genesisActivityId: offerActivity.id,
          status: "Issued",  // 已发行（交易即发行）
          ownerId: acceptActivity.actorId,  // Token 所有者是 Accept 的 Actor
          issuedAt: new Date()
        }
      });
      
      // 7. 更新 TokenIssuance 的 issuedTokenId
      await prisma.tokenIssuance.update({
        where: { id: tokenIssuance.id },
        data: { issuedToken: { connect: { id: token.id } } }
      });
      
      // 8. 更新 Actor 的钱包余额
      await updateActorWallet(acceptActivity.actorId, detectedTokenType, tokenAmount, "issue");
      
      console.log(`✓ Token issued by transaction (交易即发行): ${token.tokenId}`);
      console.log(`  Type: ${detectedTokenType}, Amount: ${tokenAmount}`);
      console.log(`  Phase Winding: ${phaseGradient}, Winding Number: ${windingNumber}`);
      
      return { token, tokenIssuance };
    } else {
      console.log(`Phase not yet full-wound (winding number: ${windingNumber} < 1), Token not issued`);
      return { token: null, tokenIssuance: null };
    }
    
  } catch (error) {
    console.error("Error issuing token by transaction:", error);
    throw error;
  }
}

/**
 * Process Offer Activity (处理 Offer 活动)
 * 基于论文①：Offer 是交易的开始，触发相位梯度累积
 */
export async function processOfferActivity(
  senderActor: any,
  targetActor: any,
  activity: any
): Promise<void> {
  try {
    console.log(`Processing Offer from ${senderActor.username} to ${targetActor.username}`);
    console.log(`  Activity ID: ${activity.id}`);
    
    // 1. 检测 Offer 中的 Token 类型（如果有）
    const tokenType = detectTokenType(activity);
    
    if (tokenType) {
      console.log(`  Detected Token type: ${tokenType}`);
      console.log(`  Token issuance may be triggered when Accept is received`);
    }
    
    // 2. 累积相位梯度（为后续的 Accept 做准备）
    // （在真实实现中，这里会更新 Activity 的 phaseGradient 字段）
    
    console.log(`Offer recorded. Waiting for Accept to trigger token issuance (交易即发行)...`);
    
  } catch (error) {
    console.error("Error processing Offer activity:", error);
    throw error;
  }
}

/**
 * Process Accept Activity (处理 Accept 活动)
 * 基于论文①：Accept 触发相位满周 → 拓扑相变 → Token 发行（交易即发行）
 */
export async function processAcceptActivity(
  senderActor: any,
  targetActor: any,
  activity: any
): Promise<{ token: any; tokenIssuance: any }> {
  try {
    console.log(`Processing Accept from ${senderActor.username} to ${targetActor.username}`);
    console.log(`  Activity ID: ${activity.id}`);
    
    // 1. 获取对应的 Offer Activity
    const offerActivity = await prisma.activity.findUnique({
      where: { activityId: activity.objectId }
    });
    
    if (!offerActivity) {
      throw new Error(`Offer activity not found for Accept: ${activity.objectId}`);
    }
    
    // 2. 触发"交易即发行"(Issue by Transaction)
    const { token, tokenIssuance } = await issueTokenByTransaction(
      offerActivity,
      activity
    );
    
    if (token) {
      console.log(`✓ Token issued successfully via transaction (交易即发行)`);
      return { token, tokenIssuance };
    } else {
      console.log(`Token issuance condition not met (phase not full-wound yet)`);
      return { token: null, tokenIssuance: null };
    }
    
  } catch (error) {
    console.error("Error processing Accept activity:", error);
    throw error;
  }
}

/**
 * Consume Token (消耗 Token - 波核耗散)
 * 基于论文①：算元/词元 是波核（Wave Kernel），消耗后即回归背景（低耗散）
 */
export async function consumeToken(
  actorUsername: string,
  tokenId: string
): Promise<{ message: string; token: any }> {
  try {
    // 1. 查找 Token
    const token = await prisma.token.findUnique({
      where: { tokenId },
      include: { owner: true }
    });
    
    if (!token) {
      throw new Error(`Token not found: ${tokenId}`);
    }
    
    if (token.owner.username !== actorUsername) {
      throw new Error(`Unauthorized: Token belongs to ${token.owner.username}, not ${actorUsername}`);
    }
    
    if (token.status === "Consumed" || token.status === "Recycled") {
      throw new Error(`Token already consumed/recycled: ${token.status}`);
    }
    
    // 2. 检查 Token 类型是否可消耗（波核：算元、词元）
    if (token.type === "WIT" || token.type === "PASS") {
      throw new Error(`Cannot consume ${token.type} token directly (粒核 - use transfer/settle instead)`);
    }
    
    // 3. 消耗 Token（波核耗散）
    const updatedToken = await prisma.token.update({
      where: { id: token.id },
      data: {
        status: "Consumed",  // 已消耗（算元/词元回收 - 波核耗散）
        consumedAt: new Date()
      }
    });
    
    // 4. 更新 Actor 的钱包余额（波核耗散，能量回归背景场）
    await updateActorWallet(token.ownerId, token.type, token.amount ?? 0, "consume");
    
    // 5. 触发 JIAJIA 式写通知回收（异步）
    await recycleTokenJIAJIA(token.id, `resource_${token.ownerId}_${Date.now()}`);
    
    console.log(`✓ Token consumed (波核耗散): ${tokenId}`);
    console.log(`  Type: ${token.type}, Amount: ${token.amount}`);
    console.log(`  Energy returned to background field (低耗散)`);
    
    return {
      message: "Token consumed successfully (波核耗散)",
      token: updatedToken
    };
    
  } catch (error) {
    console.error("Error consuming token:", error);
    throw error;
  }
}

/**
 * Reward Token (奖励 Token - 粒核转移/核销)
 * 基于论文①：智元/通证 是粒核（Particle Kernel），结算完成后转移/核销
 */
export async function rewardToken(
  senderUsername: string,
  targetUsername: string,
  tokenType: TokenType,
  amount: number
): Promise<{ message: string; rewardActivity: any }> {
  try {
    // 1. 查找 sender 和 target Actor
    const sender = await prisma.actor.findUnique({ where: { username: senderUsername } });
    const target = await prisma.actor.findUnique({ where: { username: targetUsername } });
    
    if (!sender || !target) {
      throw new Error(`Actor not found: sender=${senderUsername}, target=${targetUsername}`);
    }
    
    // 2. 检查 sender 是否有足够的 Token（粒核 - 智元/通证）
    if (tokenType === "WIT") {
      const senderWitBalance = parseFloat(sender.witToken || "0");
      if (senderWitBalance < amount) {
        throw new Error(`Insufficient Wit-Token balance: ${senderWitBalance} < ${amount}`);
      }
    }
    
    // 3. 创建 Reward Activity
    const rewardActivity = await prisma.activity.create({
      data: {
        activityId: `https://agentweb.example/activities/${crypto.randomBytes(8).toString("hex")}`,
        type: "Reward",
        actorId: sender.id,
        targetId: target.id,
        objectData: JSON.stringify({ tokenType, amount }),
        publishedAt: new Date()
      }
    });
    
    // 4. 转移 Token（粒核转移）
    if (tokenType === "WIT") {
      // 智元（Wit-Token）转移
      await prisma.actor.update({
        where: { id: sender.id },
        data: { witToken: (parseFloat(sender.witToken || "0") - amount).toString() }
      });
      
      await prisma.actor.update({
        where: { id: target.id },
        data: { witToken: (parseFloat(target.witToken || "0") + amount).toString() }
      });
      
      // 5. 创建/更新 Token 记录（结算）
      await prisma.token.create({
        data: {
          tokenId: `https://agentweb.example/tokens/${crypto.randomBytes(8).toString("hex")}`,
          type: "WIT",
          amount,
          status: "Settled",  // 已结算（智元回收 - 粒核转移/核销）
          ownerId: target.id,
          settledAt: new Date()
        }
      });
      
    } else if (tokenType === "PASS") {
      // 通证（Pass-Token）转移/核销
      // （Pass-Token 逻辑较复杂，可能涉及 DID/VC 的转移）
      console.log(`Pass-Token transfer logic to be implemented`);
    }
    
    console.log(`✓ Reward distributed (粒核转移): ${senderUsername} → ${targetUsername}`);
    console.log(`  Type: ${tokenType}, Amount: ${amount}`);
    
    return {
      message: "Reward distributed successfully (粒核转移)",
      rewardActivity
    };
    
  } catch (error) {
    console.error("Error rewarding token:", error);
    throw error;
  }
}

/**
 * Recycle Token via JIAJIA Write-Notice (JIAJIA 式写通知回收)
 * 基于论文①：不需全局账本记录每一销毁；只需在锁（resourceLock/sessionLock）贴写通知（"已回收/已结算"），相关节点获取写通知时见写通知即判无效，降低熵增
 */
export async function recycleTokenJIAJIA(
  tokenId: string,
  lockId: string,
  lockType: string = "resource"
): Promise<{ writeNotice: any }> {
  try {
    // 1. 生成写通知 (Write-Notice)
    const writeNotice = await prisma.writeNotice.create({
      data: {
        tokenId,
        lockId,
        lockType,  // "resource" | "session" | "other"
        status: "Recycled",  // 已回收（JIAJIA 式写通知）
        noticeData: JSON.stringify({
          message: "Token recycled via JIAJIA write-notice",
          recycledAt: new Date().toISOString()
        })
      }
    });
    
    // 2. 更新 Token 状态为 Recycled（写通知贴在锁上）
    await prisma.token.update({
      where: { tokenId },
      data: {
        status: "Recycled",  // 已回收（JIAJIA 式写通知）
        recycledAt: new Date()
      }
    });
    
    // 3. 相关节点获取写通知时即判无效（无需全网广播）
    console.log(`✓ Token recycled via JIAJIA write-notice: ${tokenId}`);
    console.log(`  Lock ID: ${lockId}, Lock Type: ${lockType}`);
    console.log(`  Related nodes will see write-notice and judge invalid immediately (no global broadcast needed)`);
    
    return { writeNotice };
    
  } catch (error) {
    console.error("Error recycling token via JIAJIA:", error);
    throw error;
  }
}

/**
 * Calculate Avatar Resonance (计算化身共振度)
 * 基于论文①：化身合体 = 四元 Token 共振 = 数字化身 (Digital Avatar)
 */
export async function calculateAvatarResonance(actor: any): Promise<{
  calcToken: number;
  witToken: number;
  wordTokenUsed: number;
  passToken: string | null;
  resonanceScore: number;
}> {
  try {
    // 1. 获取四元 Token 数据
    const calcToken = actor.calcToken || 0;  // 算元（"我能动多少"）
    const witToken = parseFloat(actor.witToken || "0");  // 智元（"我值多少"）
    const wordTokenUsed = actor.wordTokenUsed || 0;  // 词元（"我言/我思什么"）
    const passToken = actor.passToken;  // 通证（"我是谁"）
    
    // 2. 计算共振度（简化公式，基于论文①：四元共振统一定理）
    // Resonance = α*Calc + β*Wit + γ*Word + δ*Pass
    const alpha = 0.25;
    const beta = 0.25;
    const gamma = 0.25;
    const delta = 0.25;
    
    const normalizedCalc = Math.min(calcToken / 100, 1);  // 归一化到 [0,1]
    const normalizedWit = Math.min(witToken / 100, 1);
    const normalizedWord = Math.min(wordTokenUsed / 1000, 1);
    const normalizedPass = passToken ? 1 : 0;
    
    const resonanceScore = 
      alpha * normalizedCalc +
      beta * normalizedWit +
      gamma * normalizedWord +
      delta * normalizedPass;
    
    console.log(`Avatar resonance calculated for ${actor.username}:`);
    console.log(`  Calc-Token: ${calcToken}, Wit-Token: ${witToken}, Word-Token: ${wordTokenUsed}, Pass-Token: ${passToken}`);
    console.log(`  Resonance Score: ${resonanceScore}`);
    
    return {
      calcToken,
      witToken,
      wordTokenUsed,
      passToken,
      resonanceScore
    };
    
  } catch (error) {
    console.error("Error calculating avatar resonance:", error);
    throw error;
  }
}

// =============== Helper Functions (辅助函数) ===============

/**
 * Calculate Phase Gradient (计算相位梯度)
 * 基于论文①：Φ = ∫∫ I(x;t) dx dt（积分信息量）
 */
async function calculatePhaseGradient(
  offerActivity: any,
  acceptActivity: any
): Promise<number> {
  // 简化实现：相位梯度 = f(Offer 和 Accept 之间的时间差、Actor 信誉等）
  const offerTime = new Date(offerActivity.publishedAt).getTime();
  const acceptTime = new Date(acceptActivity.publishedAt).getTime();
  const timeDiff = (acceptTime - offerTime) / 1000;  // 秒
  
  // 相位梯度与时间差成反比（响应越快，相位梯度越大）
  const phaseGradient = 1.0 / (1.0 + timeDiff);
  
  return phaseGradient;
}

/**
 * Calculate Winding Number (计算缠绕数)
 * 基于论文①：缠绕数 Winding Number 决定拓扑相变是否发生
 */
function calculateWindingNumber(phaseGradient: number): number {
  // 简化实现：缠绕数 = floor(相位梯度 * 缩放因子）
  const scalingFactor = 10.0;
  const windingNumber = Math.floor(phaseGradient * scalingFactor);
  
  return windingNumber;
}

/**
 * Detect Token Type from Activity (从 Activity 中检测 Token 类型)
 */
function detectTokenType(activity: any): TokenType {
  // 简化实现：从 Activity 的 objectData 中检测 Token 类型
  if (activity.objectData) {
    try {
      const objectData = JSON.parse(activity.objectData);
      
      if (objectData.tokenType) {
        return objectData.tokenType as TokenType;
      }
      
      // 根据关键词检测
      if (objectData.type === "Calc-Token" || objectData.content?.includes("算力")) {
        return "CALC";
      } else if (objectData.type === "Wit-Token" || objectData.content?.includes("资产")) {
        return "WIT";
      } else if (objectData.type === "Word-Token" || objectData.content?.includes("语义")) {
        return "WORD";
      } else if (objectData.type === "Pass-Token" || objectData.content?.includes("身份")) {
        return "PASS";
      }
    } catch (e) {
      // JSON parse error, ignore
    }
  }
  
  // 默认返回 Calc-Token（最常见）
  return "CALC";
}

/**
 * Calculate Token Amount (计算 Token 数量)
 */
function calculateTokenAmount(phaseGradient: number): number {
  // 简化实现：Token 数量 = 相位梯度 * 缩放因子
  const scalingFactor = 10.0;
  const amount = phaseGradient * scalingFactor;
  
  return Math.max(1, Math.round(amount));  // 至少 1 个 Token
}

/**
 * Get Token Sub-Type (获取 Token 子类型)
 */
function getTokenSubType(tokenType: TokenType): string | undefined {
  switch (tokenType) {
    case "CALC":
      return "Calc-AI-Call";  // 算元：AI 调用额度
    case "WIT":
      return "Wit-RWA";  // 智元：RWA 资产
    case "WORD":
      return "Word-LLM-Context";  // 词元：LLM 上下文
    case "PASS":
      return "Pass-DID-Session";  // 通证：DID 会话凭证
    default:
      return undefined;
  }
}

/**
 * Update Actor Wallet (更新 Actor 钱包余额)
 */
async function updateActorWallet(
  actorId: string,
  tokenType: TokenType,
  amount: number,
  operation: "issue" | "consume" | "transfer"
): Promise<void> {
  try {
    const actor = await prisma.actor.findUnique({ where: { id: actorId } });
    
    if (!actor) {
      throw new Error(`Actor not found: ${actorId}`);
    }
    
    if (tokenType === "CALC") {
      // 算元（Calc-Token）余额更新
      const newBalance = operation === "issue"
        ? actor.calcToken + amount
        : actor.calcToken - amount;
      
      await prisma.actor.update({
        where: { id: actorId },
        data: { calcToken: Math.max(0, newBalance) }
      });
      
    } else if (tokenType === "WIT") {
      // 智元（Wit-Token）余额更新
      const currentBalance = parseFloat(actor.witToken || "0");
      const newBalance = operation === "issue"
        ? currentBalance + amount
        : currentBalance - amount;
      
      await prisma.actor.update({
        where: { id: actorId },
        data: { witToken: newBalance.toString() }
      });
      
    } else if (tokenType === "WORD") {
      // 词元（Word-Token）使用量更新（波核 - 耗散性）
      const newUsed = operation === "issue"
        ? actor.wordTokenUsed + amount
        : actor.wordTokenUsed;  // 词元消耗后不减少余额（耗散回归背景场）
      
      await prisma.actor.update({
        where: { id: actorId },
        data: { wordTokenUsed: newUsed }
      });
      
    } else if (tokenType === "PASS") {
      // 通证（Pass-Token）ID 更新
      // （Pass-Token 是粒核，稳定，不轻易变化）
      console.log(`Pass-Token wallet update logic to be implemented`);
    }
    
  } catch (error) {
    console.error("Error updating actor wallet:", error);
    throw error;
  }
}

export const TokenFourService = {
  issueTokenByTransaction,
  processOfferActivity,
  processAcceptActivity,
  consumeToken,
  rewardToken,
  recycleTokenJIAJIA,
  calculateAvatarResonance
};
