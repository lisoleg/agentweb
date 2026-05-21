// Fediverse Service (ActivityPub Protocol)
// Implements W3C ActivityPub protocol with Four-Token System integration
// Based on papers:
//   ① 联邦宇宙的化身合体 (Four-Token Unified Field Theory)
//   ② 7G、AgentWeb 与 FPGA 优先 (Φ-field Carrier)
//   ③ 联邦宇宙即未来 (Fediverse as Φ-field Natural Channel)

import { PrismaClient, ActorType, ActivityType } from "@prisma/client";
import * as crypto from "crypto";
import { generateKeyPairSync } from "crypto";
import { TokenFourService } from "./tokenFourService";
import { PhiCalculator } from "./phiCalculator";

const prisma = new PrismaClient();

export interface ActorObject {
  "@context": string;
  "id": string;
  "type": string;
  "preferredUsername": string;
  "inbox": string;
  "outbox": string;
  "followers": string;
  "following": string;
  "publicKey": {
    "id": string;
    "owner": string;
    "publicKeyPem": string;
  };
  "fourTokenWallet": {
    "calcToken": number;
    "witToken": string;
    "wordTokenUsed": number;
    "passToken": string;
  };
}

export interface ActivityObject {
  "@context": string;
  "id": string;
  "type": string;
  "actor": string;
  "object"?: string | object;
  "target"?: string;
  "tokenIssuance"?: {
    "type": string;
    "amount": number;
    "genesisActivity": string;
  };
}

/**
 * Generate RSA key pair for Actor (DID authentication)
 * 生成 Actor 的 RSA 密钥对（用于 DID 认证）
 */
export function generateRSAKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki-pem",
      format: "pem"
    },
    privateKeyEncoding: {
      type: "pkcs8-pem",
      format: "pem"
    }
  });
  
  return {
    publicKey: publicKey.export({ type: "spki-pem", format: "pem" }) as string,
    privateKey: privateKey.export({ type: "pkcs8-pem", format: "pem" }) as string
  };
}

/**
 * Process Create Activity (创建 Object - Note, Article, Token)
 * 处理 Create 活动（创建对象 - 笔记、文章、Token）
 * 基于论文①：Create 活动可触发 Token 发行（交易即发行）
 */
export async function processCreateActivity(
  senderActor: any,
  targetActor: any,
  activity: ActivityObject
): Promise<void> {
  try {
    // 1. 提取 Object
    const object = typeof activity.object === "string"
      ? JSON.parse(activity.object)
      : activity.object;
    
    if (!object) {
      throw new Error("Object is required for Create activity");
    }
    
    // 2. 判断 Object 类型
    if (object.type === "Note" || object.type === "Article") {
      // 创建内容对象（词元 Word-Token 激发）
      console.log(`Create Note/Article by ${senderActor.username}: ${object.content?.substring(0, 50)}...`);
      
      // 基于论文①：词元（Word-Token）是波核（Wave Kernel）- 语义相干态
      // 更新 sender 的词元使用量
      await prisma.actor.update({
        where: { id: senderActor.id },
        data: { wordTokenUsed: { increment: object.content?.length || 0 } }
      });
      
    } else if (object.type === "Token") {
      // 创建 Token 对象（可能触发交易即发行）
      console.log(`Create Token by ${senderActor.username}: ${object.tokenType}`);
      
      // 基于论文①："交易即发行" - Token 通过交易被创造
      if (activity.tokenIssuance) {
        await TokenFourService.issueTokenByTransaction(
          senderActor,
          targetActor,
          activity.tokenIssuance.type,
          activity.tokenIssuance.amount,
          activity.id
        );
      }
    }
    
    // 3. 广播给 followers（ActivityPub Announce）
    const followers = await prisma.follow.findMany({
      where: { followingId: senderActor.id }
    });
    
    for (const follow of followers) {
      const follower = await prisma.actor.findUnique({
        where: { id: follow.followerId }
      });
      
      if (follower) {
        // 添加 to follower's inbox（异步传播，低耗散）
        const annonceActivity = await prisma.activity.create({
          data: {
            activityId: `https://agentweb.example/activities/${crypto.randomBytes(8).toString("hex")}`,
            type: "Announce",
            actorId: senderActor.id,
            objectId: activity.id,
            publishedAt: new Date()
          }
        });
        
        await prisma.inbox.create({
          data: {
            actorId: follower.id,
            activityId: annonceActivity.id
          }
        });
      }
    }
    
  } catch (error) {
    console.error("Error processing Create activity:", error);
    throw error;
  }
}

/**
 * Process Follow Activity (建立 Φ 流贯算子)
 * 处理 Follow 活动（建立 Φ 流贯算子）
 * 基于论文②：Agent 作为 Φ 具身节点，Follow 是流贯算子的建立
 */
export async function processFollowActivity(
  followerActor: any,
  followingActor: any
): Promise<void> {
  try {
    // 1. 检查是否已经 follow
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: followerActor.id,
          following: followingActor.id
        }
      }
    });
    
    if (existingFollow) {
      console.log(`${followerActor.username} already follows ${followingActor.username}`);
      return;
    }
    
    // 2. 创建 Follow 关系（Φ 流贯算子）
    await prisma.follow.create({
      data: {
        followerId: followerActor.id,
        followingId: followingActor.id
      }
    });
    
    // 3. 更新 follower 的 following 集合 URL（如果需要）
    // 更新 following 的 followers 集合 URL（如果需要）
    
    console.log(`${followerActor.username} now follows ${followingActor.username}`);
    console.log(`Φ 流贯算子 established between ${followerActor.username} and ${followingActor.username}`);
    
  } catch (error) {
    console.error("Error processing Follow activity:", error);
    throw error;
  }
}

/**
 * Process Like Activity (语义相干态增强 - 词元波核)
 * 处理 Like 活动（语义相干态增强 - 词元波核）
 * 基于论文①：词元（Word-Token）是 Φ 的语义相干态（波核）
 */
export async function processLikeActivity(
  senderActor: any,
  targetActor: any,
  activity: ActivityObject
): Promise<void> {
  try {
    // 1. 提取被 Like 的 Object
    const objectId = typeof activity.object === "string"
      ? activity.object
      : (activity.object as any)?.id;
    
    if (!objectId) {
      throw new Error("Object ID is required for Like activity");
    }
    
    // 2. 增加 sender 的词元使用量（波核耗散）
    await prisma.actor.update({
      where: { id: senderActor.id },
      data: { wordTokenUsed: { increment: 1 } }
    });
    
    // 3. 增加 target object 的 Like 计数（语义相干增强）
    // 这里可以扩展为记录 Like 关系到数据库
    
    console.log(`${senderActor.username} liked object: ${objectId}`);
    console.log(`Word-Token (词元) 波核耗散 +1, 语义相干增强`);
    
  } catch (error) {
    console.error("Error processing Like activity:", error);
    throw error;
  }
}

/**
 * Process Announce Activity (广播词元 - 语义流)
 * 处理 Announce 活动（广播词元 - 语义流）
 * 基于论文①：词元（Word-Token）的语义流通过 Announce 广播
 */
export async function processAnnounceActivity(
  senderActor: any,
  targetActor: any,
  activity: ActivityObject
): Promise<void> {
  try {
    // 1. 提取被 Announce 的 Object
    const objectId = typeof activity.object === "string"
      ? activity.object
      : (activity.object as any)?.id;
    
    if (!objectId) {
      throw new Error("Object ID is required for Announce activity");
    }
    
    // 2. 广播给 sender 的 followers（Pub/Sub 模式）
    const followers = await prisma.follow.findMany({
      where: { followingId: senderActor.id }
    });
    
    console.log(`${senderActor.username} announced object: ${objectId} to ${followers.length} followers`);
    console.log(`Word-Token (词元) 语义流 broadcasting via Pub/Sub`);
    
    // 3. 可以在这里记录 Announce 到 follower's inboxes
    // （已经在上层 processCreateActivity 中处理）
    
  } catch (error) {
    console.error("Error processing Announce activity:", error);
    throw error;
  }
}

/**
 * Calculate Four-Token Resonance (四元 Token 共振)
 * 计算四元 Token 共振度（用于化身合体）
 * 基于论文①：化身合体 = 四元 Token 共振
 */
export async function calculateFourTokenResonance(actor: any): Promise<{
  calcToken: number;
  witToken: number;
  wordTokenUsed: number;
  passToken: string | null;
  resonanceScore: number;
}> {
  try {
    // 1. 获取四元 Token 数据
    const calcToken = actor.calcToken || 0;
    const witToken = parseFloat(actor.witToken) || 0;
    const wordTokenUsed = actor.wordTokenUsed || 0;
    const passToken = actor.passToken;
    
    // 2. 计算共振度（简化公式）
    // Resonance = α*Calc + β*Wit + γ*Word + δ*Pass
    // 基于论文①：四元共振统一定理
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
    
    // 3. 返回共振数据
    return {
      calcToken,
      witToken,
      wordTokenUsed,
      passToken,
      resonanceScore
    };
    
  } catch (error) {
    console.error("Error calculating Four-Token resonance:", error);
    throw error;
  }
}

/**
 * Get Inbox Activities (获取收件箱活动)
 * 获取 Actor 的 Inbox（接收的活动）
 */
export async function getInboxActivities(
  username: string,
  page: number = 1,
  limit: number = 20
): Promise<{ activities: any[]; total: number; totalPages: number }> {
  try {
    const actor = await prisma.actor.findUnique({
      where: { username }
    });
    
    if (!actor) {
      throw new Error(`Actor not found: ${username}`);
    }
    
    const total = await prisma.inbox.count({
      where: { actorId: actor.id }
    });
    
    const inboxRecords = await prisma.inbox.findMany({
      where: { actorId: actor.id },
      include: { activity: true },
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    });
    
    const totalPages = Math.ceil(total / limit);
    
    return {
      activities: inboxRecords.map(record => record.activity),
      total,
      totalPages
    };
    
  } catch (error) {
    console.error("Error getting inbox activities:", error);
    throw error;
  }
}

/**
 * Get Outbox Activities (获取发件箱活动)
 * 获取 Actor 的 Outbox（发出的活动）
 */
export async function getOutboxActivities(
  username: string,
  page: number = 1,
  limit: number = 20
): Promise<{ activities: any[]; total: number; totalPages: number }> {
  try {
    const actor = await prisma.actor.findUnique({
      where: { username }
    });
    
    if (!actor) {
      throw new Error(`Actor not found: ${username}`);
    }
    
    const total = await prisma.outbox.count({
      where: { actorId: actor.id }
    });
    
    const outboxRecords = await prisma.outbox.findMany({
      where: { actorId: actor.id },
      include: { activity: true },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    });
    
    const totalPages = Math.ceil(total / limit);
    
    return {
      activities: outboxRecords.map(record => record.activity),
      total,
      totalPages
    };
    
  } catch (error) {
    console.error("Error getting outbox activities:", error);
    throw error;
  }
}

export const FediverseService = {
  generateRSAKeyPair,
  processCreateActivity,
  processFollowActivity,
  processLikeActivity,
  processAnnounceActivity,
  calculateFourTokenResonance,
  getInboxActivities,
  getOutboxActivities
};
