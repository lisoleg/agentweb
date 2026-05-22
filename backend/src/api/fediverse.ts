// Fediverse (ActivityPub) API Routes
// Implements W3C ActivityPub protocol with Four-Token System integration
// Based on papers:
//   ① 联邦宇宙的化身合体 (Four-Token Unified Field Theory)
//   ② 7G、AgentWeb 与 FPGA 优先 (Φ-field Carrier)
//   ③ 联邦宇宙即未来 (Fediverse as Φ-field Natural Channel)

import { Router, Request, Response } from "express";
import { ActorType, ActivityType, TokenType, TokenStatus } from "@prisma/client";
import prisma from "../utils/prisma";
import * as crypto from "crypto";
import { FediverseService } from "../services/fediverseService";
import { TokenFourService } from "../services/tokenFourService";
import { PhiCalculator } from "../services/phiCalculator";

const router = Router();

// =============== Actor Endpoints (Fediverse Actor = 化身) ===============

// GET /api/fediverse/actor/:username - Get Actor (Fediverse Profile)
router.get("/actor/:username", async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    const actor = await prisma.actor.findUnique({
      where: { username },
      include: {
        user: true,
        activities: { take: 20, orderBy: { publishedAt: "desc" } },
        followersRel: { take: 50 },
        followingRel: { take: 50 }
      }
    });
    
    if (!actor) {
      return res.status(404).json({ error: "Actor not found" });
    }
    
    // Return ActivityPub Actor object
    const actorObject = {
      "@context": "https://www.w3.org/ns/activitystreams",
      "id": `${req.protocol}://${req.get("host")}/api/fediverse/actor/${actor.username}`,
      "type": actor.type,
      "preferredUsername": actor.username,
      "inbox": actor.inbox,
      "outbox": actor.outbox,
      "followers": actor.followers,
      "following": actor.following,
      "publicKey": {
        "id": `${req.protocol}://${req.get("host")}/api/fediverse/actor/${actor.username}#main-key`,
        "owner": `${req.protocol}://${req.get("host")}/api/fediverse/actor/${actor.username}`,
        "publicKeyPem": actor.publicKey
      },
      // Four-Token Wallet (四元 Token 钱包)
      "fourTokenWallet": {
        "calcToken": actor.calcToken,  // 算元 (Calc-Token)
        "witToken": actor.witToken,   // 智元 (Wit-Token)
        "wordTokenUsed": actor.wordTokenUsed,  // 词元 (Word-Token)
        "passToken": actor.passToken   // 通证 (Pass-Token)
      }
    };
    
    res.json(actorObject);
  } catch (error: any) {
    console.error("Error getting actor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/fediverse/actor - Create/Update Actor (化身合体)
router.post("/actor", async (req: Request, res: Response) => {
  try {
    const {
      userId,
      username,
      type = "Person",
      calcToken = 0,
      witToken = null,
      wordTokenUsed = 0,
      passToken = null
    } = req.body;
    
    if (!userId || !username) {
      return res.status(400).json({ error: "userId and username are required" });
    }
    
    // Generate DID (W3C DID)
    const did = `did:agentweb:${crypto.randomBytes(16).toString("hex")}`;
    
    // Generate RSA key pair for Actor
    const { publicKey, privateKey } = await FediverseService.generateRSAKeyPair();
    
    // Create Actor
    const baseUrl = `${req.protocol}://${req.get("host")}/api/fediverse`;
    const actor = await prisma.actor.upsert({
      where: { username },
      update: {
        type: type as ActorType,
        calcToken,
        witToken,
        wordTokenUsed,
        passToken
      },
      create: {
        did,
        username,
        type: type as ActorType,
        inbox: `${baseUrl}/inbox/${username}`,
        outbox: `${baseUrl}/outbox/${username}`,
        followers: `${baseUrl}/followers/${username}`,
        following: `${baseUrl}/following/${username}`,
        publicKey,
        privateKey,
        userId,
        calcToken,
        witToken,
        wordTokenUsed,
        passToken
      }
    });
    
    res.status(201).json({
      message: "Actor created/updated successfully",
      actor: {
        id: actor.id,
        username: actor.username,
        did: actor.did,
        inbox: actor.inbox,
        outbox: actor.outbox
      }
    });
  } catch (error: any) {
    console.error("Error creating/updating actor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =============== Inbox Endpoints (接收 Activity) ===============

// POST /api/fediverse/inbox/:username - Post to Inbox (接收 Activity)
router.post("/inbox/:username", async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const activity = req.body;  // ActivityPub Activity object
    
    if (!activity || !activity.type || !activity.actor) {
      return res.status(400).json({ error: "Invalid Activity object" });
    }
    
    // Find target Actor
    const targetActor = await prisma.actor.findUnique({
      where: { username }
    });
    
    if (!targetActor) {
      return res.status(404).json({ error: "Target actor not found" });
    }
    
    // Find sender Actor
    const senderActor = await prisma.actor.findFirst({
      where: { inbox: activity.actor }
    });
    
    if (!senderActor) {
      return res.status(404).json({ error: "Sender actor not found" });
    }
    
    // Create or find Activity
    let activityRecord = await prisma.activity.findUnique({
      where: { activityId: activity.id }
    });
    
    if (!activityRecord) {
      activityRecord = await prisma.activity.create({
        data: {
          activityId: activity.id,
          type: activity.type as ActivityType,
          actorId: senderActor.id,
          objectId: activity.object?.id || null,
          objectType: activity.object?.type || null,
          objectData: activity.object ? JSON.stringify(activity.object) : null,
          targetId: targetActor.id,
          publishedAt: new Date(activity.published || Date.now())
        }
      });
    }
    
    // Create Inbox record
    await prisma.inbox.create({
      data: {
        actorId: targetActor.id,
        activityId: activityRecord.id
      }
    });
    
    // Process Activity based on type (ActivityPub Verb)
    // 基于论文①："交易即发行，流转即回收"
    if (activity.type === "Offer") {
      // Offer → 可能触发 Token 发行 (交易即发行)
      await TokenFourService.processOfferActivity(senderActor, targetActor, activity);
    } else if (activity.type === "Accept") {
      // Accept → 相位满周 → 拓扑相变 → Create Token (交易即发行)
      await TokenFourService.processAcceptActivity(senderActor, targetActor, activity);
    } else if (activity.type === "Create") {
      // Create → 创建 Object (Note, Article, Token)
      await FediverseService.processCreateActivity(senderActor, targetActor, activity);
    } else if (activity.type === "Follow") {
      // Follow → 建立 Φ 流贯算子
      await FediverseService.processFollowActivity(senderActor, targetActor);
    } else if (activity.type === "Like") {
      // Like → 语义相干态（词元）增强
      await FediverseService.processLikeActivity(senderActor, targetActor, activity);
    } else if (activity.type === "Announce") {
      // Announce → 广播词元（语义流）
      await FediverseService.processAnnounceActivity(senderActor, targetActor, activity);
    } else if (activity.type === "Consume") {
      // Consume → 算元/词元回收（波核耗散）
      await TokenFourService.consumeToken(senderActor?.username || '', activity.objectId || '');
    } else if (activity.type === "Reward") {
      // Reward → 智元转移/核销（粒核转移）
      await TokenFourService.rewardToken(
        senderActor?.username || '',
        targetActor?.username || '',
        (activity as any).tokenType || 'CALC' as any,
        (activity as any).amount || 0
      );
    }
    
    res.status(200).json({ message: "Activity processed successfully" });
  } catch (error: any) {
    console.error("Error processing inbox activity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/fediverse/outbox/:username - Get Outbox (发出的 Activity)
router.get("/outbox/:username", async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { page = "1", limit = "20" } = req.query;
    
    const actor = await prisma.actor.findUnique({
      where: { username }
    });
    
    if (!actor) {
      return res.status(404).json({ error: "Actor not found" });
    }
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    
    const activities = await prisma.outbox.findMany({
      where: { actorId: actor.id },
      include: { activity: true },
      orderBy: { publishedAt: "desc" },
      skip: (pageNum - 1) * limitNum,
      take: limitNum
    });
    
    const total = await prisma.outbox.count({
      where: { actorId: actor.id }
    });
    
    res.json({
      actor: username,
      outbox: activities.map(o => o.activity),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error("Error getting outbox:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =============== ActivityPub Verb Endpoints (ActivityPub 动词) ===============

// POST /api/fediverse/follow - Follow Actor (Φ 流贯算子)
router.post("/follow", async (req: Request, res: Response) => {
  try {
    const { followerUsername, followingUsername } = req.body;
    
    if (!followerUsername || !followingUsername) {
      return res.status(400).json({ error: "followerUsername and followingUsername are required" });
    }
    
    const follower = await prisma.actor.findUnique({ where: { username: followerUsername } });
    const following = await prisma.actor.findUnique({ where: { username: followingUsername } });
    
    if (!follower || !following) {
      return res.status(404).json({ error: "Actor not found" });
    }
    
    // Create Follow relationship (Φ 流贯算子)
    await prisma.follow.create({
      data: {
        followerId: follower.id,
        followingId: following.id
      }
    });
    
    // Create Follow Activity
    const followActivity = await prisma.activity.create({
      data: {
        activityId: `https://agentweb.example/activities/${crypto.randomBytes(8).toString("hex")}`,
        type: "Follow",
        actorId: follower.id,
        objectId: following.id,
        publishedAt: new Date()
      }
    });
    
    // Add to follower's outbox
    await prisma.outbox.create({
      data: {
        actorId: follower.id,
        activityId: followActivity.id
      }
    });
    
    // Add to following's inbox
    await prisma.inbox.create({
      data: {
        actorId: following.id,
        activityId: followActivity.id
      }
    });
    
    res.status(201).json({
      message: "Followed successfully",
      followActivity: {
        id: followActivity.id,
        type: "Follow",
        actor: follower.username,
        object: following.username
      }
    });
  } catch (error: any) {
    console.error("Error following actor:", error);
    
    // Handle duplicate follow
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Already following this actor" });
    }
    
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/fediverse/offer - Offer (触发 交易即发行)
router.post("/offer", async (req: Request, res: Response) => {
  try {
    const { actorUsername, targetUsername, offerData } = req.body;
    
    if (!actorUsername || !targetUsername || !offerData) {
      return res.status(400).json({ error: "actorUsername, targetUsername, and offerData are required" });
    }
    
    const actor = (await prisma.actor.findUnique({ where: { username: actorUsername } }))!;
    const target = (await prisma.actor.findUnique({ where: { username: targetUsername } }))!;
    
    if (!actor || !target) {
      return res.status(404).json({ error: "Actor not found" });
    }
    
    // Create Offer Activity
    const offerActivity = await prisma.activity.create({
      data: {
        activityId: `https://agentweb.example/activities/${crypto.randomBytes(8).toString("hex")}`,
        type: "Offer",
        actorId: actor.id,
        targetId: target.id,
        objectData: JSON.stringify(offerData),
        publishedAt: new Date()
      }
    });
    
    // Add to actor's outbox
    await prisma.outbox.create({
      data: {
        actorId: actor.id,
        activityId: offerActivity.id
      }
    });
    
    // Add to target's inbox
    await prisma.inbox.create({
      data: {
        actorId: target.id,
        activityId: offerActivity.id
      }
    });
    
    // 基于论文①：检测相位梯度，判断是否触发 Token 发行
    const phaseGradient = await PhiCalculator.calculatePhaseGradient(actor.id, target.id, offerActivity.id);
    
    res.status(201).json({
      message: "Offer created successfully",
      offerActivity: {
        id: offerActivity.id,
        type: "Offer",
        actor: actorUsername,
        target: targetUsername,
        phaseGradient
      }
    });
  } catch (error: any) {
    console.error("Error creating offer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/fediverse/accept - Accept Offer (相位满周 → 拓扑相变 → 发行 Token)
router.post("/accept", async (req: Request, res: Response) => {
  try {
    const { actorUsername, offerActivityId } = req.body;
    
    if (!actorUsername || !offerActivityId) {
      return res.status(400).json({ error: "actorUsername and offerActivityId are required" });
    }
    
    const actor = (await prisma.actor.findUnique({ where: { username: actorUsername } }))!;
    const offerActivity = await prisma.activity.findUnique({ where: { activityId: offerActivityId } });
    
    if (!actor || !offerActivity) {
      return res.status(404).json({ error: "Actor or Offer Activity not found" });
    }
    
    // Create Accept Activity
    const acceptActivity = await prisma.activity.create({
      data: {
        activityId: `https://agentweb.example/activities/${crypto.randomBytes(8).toString("hex")}`,
        type: "Accept",
        actorId: actor.id,
        objectId: offerActivity.activityId,
        targetId: offerActivity.actorId,
        publishedAt: new Date()
      }
    });
    
    // Add to actor's outbox
    await prisma.outbox.create({
      data: {
        actorId: actor.id,
        activityId: acceptActivity.id
      }
    });
    
    // Add to offer actor's inbox
    await prisma.inbox.create({
      data: {
        actorId: offerActivity.actorId,
        activityId: acceptActivity.id
      }
    });
    
    // 基于论文①："交易即发行" - 相位满周 → 拓扑相变 → 发行 Token
    const tokenIssuance = await TokenFourService.issueTokenByTransaction(offerActivity, acceptActivity);
    
    res.status(201).json({
      message: "Accept created successfully, Token issued",
      acceptActivity: {
        id: acceptActivity.id,
        type: "Accept",
        actor: actorUsername,
        object: offerActivityId
      },
      tokenIssuance
    });
  } catch (error: any) {
    console.error("Error accepting offer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =============== Four-Token Lifecycle Endpoints (四元 Token 生命周期) ===============

// POST /api/fediverse/consume - Consume Token (算元/词元回收 - 波核耗散)
router.post("/consume", async (req: Request, res: Response) => {
  try {
    const { actorUsername, tokenId } = req.body;
    
    if (!actorUsername || !tokenId) {
      return res.status(400).json({ error: "actorUsername and tokenId are required" });
    }
    
    // Process consumption (波核耗散)
    const result = await TokenFourService.consumeToken(actorUsername, tokenId);
    
    // Create Consume Activity
    const consumeActivity = await prisma.activity.create({
      data: {
        activityId: `https://agentweb.example/activities/${crypto.randomBytes(8).toString("hex")}`,
        type: "Consume",
        actorId: (await prisma.actor.findUnique({ where: { username: actorUsername } }))!.id,
        objectId: tokenId,
        publishedAt: new Date()
      }
    });
    
    res.status(200).json({
      message: "Token consumed successfully (波核耗散)",
      consumeActivity: {
        id: consumeActivity.id,
        type: "Consume"
      },
      result
    });
  } catch (error: any) {
    console.error("Error consuming token:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// POST /api/fediverse/reward - Reward Token (智元转移/核销 - 粒核转移)
router.post("/reward", async (req: Request, res: Response) => {
  try {
    const { actorUsername, targetUsername, tokenType, amount } = req.body;
    
    if (!actorUsername || !targetUsername || !tokenType || !amount) {
      return res.status(400).json({ error: "actorUsername, targetUsername, tokenType, and amount are required" });
    }
    
    // Process reward (粒核转移)
    const result = await TokenFourService.rewardToken(actorUsername, targetUsername, tokenType, amount);
    
    // Create Reward Activity
    const actor = (await prisma.actor.findUnique({ where: { username: actorUsername } }))!;
    const target = (await prisma.actor.findUnique({ where: { username: targetUsername } }))!;
    
    const rewardActivity = await prisma.activity.create({
      data: {
        activityId: `https://agentweb.example/activities/${crypto.randomBytes(8).toString("hex")}`,
        type: "Reward",
        actorId: actor.id,
        targetId: target.id,
        objectData: JSON.stringify({ tokenType, amount }),
        publishedAt: new Date()
      }
    });
    
    res.status(200).json({
      message: "Reward distributed successfully (粒核转移)",
      rewardActivity: {
        id: rewardActivity.id,
        type: "Reward"
      },
      result
    });
  } catch (error: any) {
    console.error("Error rewarding token:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// =============== Avatar Fusion Endpoints (化身合体) ===============

// GET /api/fediverse/avatar/:username - Get Digital Avatar (数字化身)
router.get("/avatar/:username", async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    const actor = await prisma.actor.findUnique({
      where: { username },
      include: { user: true }
    });
    
    if (!actor) {
      return res.status(404).json({ error: "Actor not found" });
    }
    
    // Calculate Four-Token Resonance (四元共振度)
    const resonance = await TokenFourService.calculateAvatarResonance(actor);
    
    // Check if 化身合体 is achieved
    const isFused = resonance.resonanceScore >= 0.8;  // Threshold for 化身合体
    
    const avatar = {
      avatarId: actor.did,
      owner: actor.username,
      fourTokenResonance: {
        calcToken: actor.calcToken,
        witToken: actor.witToken,
        wordTokenUsed: actor.wordTokenUsed,
        passToken: actor.passToken
      },
      resonanceScore: resonance.resonanceScore,
      isFused,  // 化身合体 achieved?
      bioDigitalAlchemy: {
        enabled: isFused,
        daoChengRouShenProgress: isFused ? 100 : resonance.resonanceScore * 100
      }
    };
    
    res.json(avatar);
  } catch (error: any) {
    console.error("Error getting avatar:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
