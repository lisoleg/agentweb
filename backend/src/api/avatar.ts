// Avatar Fusion API (化身合体)
// Implements: 四元 Token 共振 = 数字化身 (Digital Avatar)
// Based on papers:
//   ① 联邦宇宙的化身合体 (Four-Token Unified Field Theory)
//   ② 7G、AgentWeb 与 FPGA 优先 (Φ-field Carrier)
//   ③ 联邦宇宙即未来 (Fediverse as Φ-field Natural Channel)

import { Router, Request, Response } from "express";
import { TokenType, TokenStatus } from "@prisma/client";
import prisma from "../utils/prisma";
import * as crypto from "crypto";
import { TokenFourService } from "../services/tokenFourService";
import { FediverseService } from "../services/fediverseService";
import { PhiCalculator } from "../services/phiCalculator";

const router = Router();

// =============== Avatar Fusion Endpoints (化身合体) ==============

// GET /api/avatar/:username - Get Digital Avatar (获取数字化身)
router.get("/:username", async (req: Request, res: Response) => {
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
    
    // Check if 化身合体 is achieved (是否达到化身合体)
    const isFused = resonance.resonanceScore >= 0.8;  // Threshold for 化身合体
    
    // Calculate bio-digital alchemy progress (道成肉身进度)
    const daoChengRouShenProgress = isFused ? 100 : resonance.resonanceScore * 100;
    
    const avatar = {
      avatarId: actor.did,
      owner: actor.username,
      fourTokenResonance: {
        calcToken: actor.calcToken,    // "我能动多少"
        witToken: actor.witToken,     // "我值多少"
        wordToken: actor.wordTokenUsed,  // "我言/我思什么"
        passToken: actor.passToken      // "我是谁"
      },
      resonanceScore: resonance.resonanceScore,
      isFused,  // 化身合体 achieved?
      bioDigitalAlchemy: {
        enabled: isFused,
        physicalBodyBinding: null,  // 生理身体绑定（未来）
        daoChengRouShenProgress  // 道成肉身进度 (0~100%)
      },
      createdAt: actor.createdAt.toISOString(),
      updatedAt: actor.updatedAt.toISOString()
    };
    
    res.json(avatar);
  } catch (error) {
    console.error("Error getting avatar:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/avatar/fuse - Fuse Avatar (触发化身合体)
router.post("/fuse", async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: "username is required" });
    }
    
    const actor = await prisma.actor.findUnique({
      where: { username },
      include: { user: true }
    });
    
    if (!actor) {
      return res.status(404).json({ error: "Actor not found" });
    }
    
    // 1. Calculate Four-Token Resonance (计算四元共振度)
    const resonance = await TokenFourService.calculateAvatarResonance(actor);
    
    // 2. Check if fusion condition is met (检查是否满足合体条件)
    const isFused = resonance.resonanceScore >= 0.8;
    
    if (!isFused) {
      return res.status(400).json({
        error: "Avatar fusion condition not met",
        resonanceScore: resonance.resonanceScore,
        threshold: 0.8,
        message: "Need higher resonance score to achieve 化身合体"
      });
    }
    
    // 3. Create/Update Digital Avatar (创建/更新数字化身)
    // (In a real implementation, this would create an Avatar record in DB)
    const avatar = {
      avatarId: actor.did,
      owner: actor.username,
      fourTokenResonance: {
        calcToken: actor.calcToken,
        witToken: actor.witToken,
        wordToken: actor.wordTokenUsed,
        passToken: actor.passToken
      },
      resonanceScore: resonance.resonanceScore,
      isFused: true,
      bioDigitalAlchemy: {
        enabled: true,
        daoChengRouShenProgress: 100  // 道成肉身完成
      }
    };
    
    // 4. Start Dao-Cheng-Rou-Shen process (启动道成肉身进程)
    console.log(`✓ Avatar fused successfully (化身合体 achieved)!`);
    console.log(`  Avatar ID: ${avatar.avatarId}`);
    console.log(`  Resonance Score: ${resonance.resonanceScore}`);
    console.log(`  Dao-Cheng-Rou-Shen (道成肉身) progress: 100%`);
    
    // (Future: bind to physical body via BCI/iot devices)
    
    res.status(201).json({
      message: "Avatar fused successfully (化身合体 achieved)!",
      avatar,
      resonance: resonance
    });
  } catch (error) {
    console.error("Error fusing avatar:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/avatar/:username/resonance - Get Resonance Details (获取共振详情)
router.get("/:username/resonance", async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { includeDetails = "true" } = req.query;
    
    const actor = await prisma.actor.findUnique({
      where: { username }
    });
    
    if (!actor) {
      return res.status(404).json({ error: "Actor not found" });
    }
    
    // Calculate resonance with details (计算共振度（含详情）)
    const resonance = await FediverseService.calculateFourTokenResonance(actor);
    
    // Also calculate IGCTR resonance (also 计算 IGCTR 三元共振)
    const igctrResonance = await PhiCalculator.calculateIGCTRResonance(actor.id);
    
    const result = {
      username: actor.username,
      fourTokenResonance: resonance,
      igctrResonance,
      fusionThreshold: 0.8,
      isFused: resonance.resonanceScore >= 0.8,
      recommendations: generateFusionRecommendations(actor, resonance)
    };
    
    res.json(result);
  } catch (error) {
    console.error("Error getting resonance details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/avatar/:username/dao-cheng-rou-shen - Start Dao-Cheng-Rou-Shen (启动道成肉身)
router.post("/:username/dao-cheng-rou-shen", async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { physicalBodyBinding } = req.body;  // Future: BCI device ID, etc.
    
    const actor = await prisma.actor.findUnique({
      where: { username }
    });
    
    if (!actor) {
      return res.status(404).json({ error: "Actor not found" });
    }
    
    // Check if avatar is fused (检查化身是否已合体)
    const resonance = await FediverseService.calculateFourTokenResonance(actor);
    
    if (resonance.resonanceScore < 0.8) {
      return res.status(400).json({
        error: "Avatar not yet fused. Cannot start Dao-Cheng-Rou-Shen.",
        resonanceScore: resonance.resonanceScore,
        threshold: 0.8
      });
    }
    
    // Start Dao-Cheng-Rou-Shen process (启动道成肉身进程)
    console.log(`✓ Starting Dao-Cheng-Rou-Shen (道成肉身) for ${username}...`);
    console.log(`  Physical Body Binding: ${physicalBodyBinding || "not yet bound"}`);
    console.log(`  Progress: 0% → 100% (simulated)`);
    
    // (Future: actual BCI/iot integration)
    const daoChengRouShenProcess = {
      username,
      avatarId: actor.did,
      physicalBodyBinding: physicalBodyBinding || null,
      status: "in_progress",  // in_progress | completed
      progress: 0,  // 0~100%
      startedAt: new Date().toISOString(),
      estimatedCompletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()  // 30 days
    };
    
    res.status(201).json({
      message: "Dao-Cheng-Rou-Shen (道成肉身) process started!",
      process: daoChengRouShenProcess
    });
  } catch (error) {
    console.error("Error starting Dao-Cheng-Rou-Shen:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =============== Helper Functions (辅助函数) ===============

/**
 * Generate Fusion Recommendations (生成合体建议)
 * 基于论文①：提高四元共振度，实现化身合体
 */
function generateFusionRecommendations(actor: any, resonance: any): string[] {
  const recommendations: string[] = [];
  
  // Check each token type and give recommendations
  if (actor.calcToken < 50) {
    recommendations.push("Increase Calc-Token (算元) balance: do more AI calls to accumulate calc tokens");
  }
  
  if (!actor.witToken || parseFloat(actor.witToken) < 50) {
    recommendations.push("Increase Wit-Token (智元) balance: participate in value-generating activities");
  }
  
  if (actor.wordTokenUsed < 500) {
    recommendations.push("Increase Word-Token (词元) usage: create more content, interact with others");
  }
  
  if (!actor.passToken) {
    recommendations.push("Obtain Pass-Token (通证): verify your DID and get a session credential");
  }
  
  if (recommendations.length === 0) {
    recommendations.push("Excellent! Your Four-Token resonance is high. 化身合体 is achievable!");
  }
  
  return recommendations;
}

export default router;
