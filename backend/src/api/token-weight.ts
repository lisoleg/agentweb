/**
 * Token-Weight API Routes — V14.0 Token-Weight 激励引擎 API
 * 挂载于 /api/v14/token-weight
 *
 * 端点:
 * - GET /                    — 服务信息
 * - POST /token/create        — 创建 Token（四重属性）
 * - POST /handshake           — Gi-Gi 握手（定义4.1）
 * - GET /vertex/:sender/:receiver — 映射到十二面灵球顶点
 * - POST /interaction/record  — 记录十二面灵球交互
 * - GET /stats               — 获取十二面灵球统计
 * - POST /weight/update      — 更新 Weight（神经网络权重更新）
 * - GET /value/:tokenId     — 计算 Token 价值势（综合评分）
 * - GET /neural-map/:agent  — 获取 Agent 神经映射（利/名/权）
 */

import { Router, Request, Response } from 'express';
import { tokenWeightEngine, Token, Weight, PortHandedness, DodecahedralVertex } from '../services/tokenWeightEngine';

const router = Router();

/**
 * GET / — Token-Weight 服务信息
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      version: '14.0.0',
      description: 'V14.0 Token-Weight 激励引擎 — Token四重属性 × Weight三类 × 十二面灵球',
      inspiration: '《Token是智能体的状态机》— 复合体理学',
      theorems: {
        '2.1': 'Weight-Gate-Bias 完备性: 缺失[利]则无力, 缺失[名]则无人信从, 缺失[权]则无力约束他人',
        '4.1': 'Gi-Gi Handshake: w_{ab} += η · ρ_{sal}(τ) · α_b',
      },
      prophecies: {
        'P_NN1': 'Weight 神经映射: 高Weight组响应强度显著高于低Weight组',
        'P_NN2': '十二面灵球完备性: 100%人类交互可映射到12维空间',
      },
      endpoints: {
        createToken: 'POST /api/v14/token-weight/token/create',
        handshake: 'POST /api/v14/token-weight/handshake',
        vertex: 'GET /api/v14/token-weight/vertex/:sender/:receiver',
        recordInteraction: 'POST /api/v14/token-weight/interaction/record',
        stats: 'GET /api/v14/token-weight/stats',
        updateWeight: 'POST /api/v14/token-weight/weight/update',
        tokenValue: 'GET /api/v14/token-weight/value/:tokenId',
        neuralMap: 'GET /api/v14/token-weight/neural-map/:agent',
      },
      weightTypes: {
        li: '突触权重 Synaptic Weights — 物质资源支配强度',
        ming: '偏置项 Bias — 声望/可信度/文化领导权',
        quan: '门控机制 Gate — 审批/冻结/否决强制力',
      },
      dodecahedralVertices: Object.keys(DodecahedralVertex).filter(k => isNaN(Number(k))).length,
      giGiHandshake: 'Gi-Gi Handshake: Token = ⟨sym, χ, ρ, κ⟩ 沿超边流动',
    },
  });
});

/**
 * POST /token/create — 创建 Token（四重属性）
 */
router.post('/token/create', (req: Request, res: Response) => {
  try {
    const { sym, chi, rho, kappa, sender, senderWeight } = req.body;
    if (!sym || chi === undefined || rho === undefined || !sender) {
      res.status(400).json({ code: 1, message: 'sym, chi, rho, sender are required' });
      return;
    }
    const token = tokenWeightEngine.createToken(
      sym,
      chi as PortHandedness,
      rho,
      kappa || '',
      sender,
      senderWeight || { li: 5000, ming: 5000, quan: 5000 },
    );
    res.json({ code: 0, data: token, message: 'Token created' });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /handshake — Gi-Gi 握手（定义4.1）
 */
router.post('/handshake', (req: Request, res: Response) => {
  try {
    const { senderId, receiverId, token, receiverWeight } = req.body;
    if (!senderId || !receiverId || !token) {
      res.status(400).json({ code: 1, message: 'senderId, receiverId, token are required' });
      return;
    }
    const handshake = tokenWeightEngine.performHandshake(senderId, receiverId, token, receiverWeight || { li: 5000, ming: 5000, quan: 5000 });
    res.json({ code: 0, data: handshake, message: handshake.success ? 'Handshake SUCCESS' : 'Handshake REJECTED' });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /vertex/:sender/:receiver — 映射到十二面灵球顶点
 */
router.get('/vertex/:sender/:receiver', (req: Request, res: Response) => {
  try {
    const { sender, receiver } = req.params;
    const { sym, chi, rho, kappa } = req.query;
    if (!sym || chi === undefined || rho === undefined) {
      res.status(400).json({ code: 1, message: 'sym, chi, rho query params are required' });
      return;
    }
    const token = tokenWeightEngine.createToken(
      sym as string,
      Number(chi) as PortHandedness,
      Number(rho),
      (kappa as string) || '',
      sender,
      { li: 5000, ming: 5000, quan: 5000 },
    );
    // 模拟接收方 Weight
    const receiverWeight = { li: 5000, ming: 5000, quan: 5000 };
    const vertex = tokenWeightEngine['mapToDodecahedralVertex'](token, receiverWeight);
    res.json({
      code: 0,
      data: {
        vertex,
        vertexName: DodecahedralVertex[vertex],
        token: { sym, chi: Number(chi), rho: Number(rho) },
        note: 'Token₄ × Weight₃ = 12维文明交互空间',
      },
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /interaction/record — 记录十二面灵球交互
 */
router.post('/interaction/record', (req: Request, res: Response) => {
  try {
    const { token, senderId, receiverId, senderState, receiverState, receiverWeight } = req.body;
    if (!token || !senderId || !receiverId) {
      res.status(400).json({ code: 1, message: 'token, senderId, receiverId are required' });
      return;
    }
    const interaction = tokenWeightEngine.recordDodecahedralInteraction(
      token,
      senderId,
      receiverId,
      senderState || [],
      receiverState || [],
      receiverWeight || { li: 5000, ming: 5000, quan: 5000 },
    );
    res.json({ code: 0, data: interaction, message: 'Dodecahedral interaction recorded' });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /stats — 获取十二面灵球统计
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = tokenWeightEngine.getDodecahedralStats();
    res.json({ code: 0, data: stats });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /weight/update — 更新 Weight（神经网络权重更新）
 */
router.post('/weight/update', (req: Request, res: Response) => {
  try {
    const { current, deltaLi, deltaMing, deltaQuan } = req.body;
    if (!current) {
      res.status(400).json({ code: 1, message: 'current Weight is required' });
      return;
    }
    const updated = tokenWeightEngine.updateWeight(current, deltaLi || 0, deltaMing || 0, deltaQuan || 0);
    res.json({ code: 0, data: updated, message: 'Weight updated' });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /value/:tokenId — 计算 Token 价值势（综合评分）
 */
router.get('/value/:tokenId', (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    // 从 handshake 记录中获取 token（简化：模拟）
    const mockToken = {
      id: tokenId,
      sym: 'mock',
      chi: PortHandedness.NEUTRAL,
      rho: 5000,
      kappa: 'mock',
      sender: 'mock',
      senderWeight: { li: 5000, ming: 5000, quan: 5000 },
      timestamp: Date.now(),
      ttl: 300,
    } as Token;
    const value = tokenWeightEngine.calculateTokenValue(mockToken);
    res.json({ code: 0, data: { tokenId, value, breakdown: 'li×0.4 + ming×0.3 + quan×0.3 + rho×0.1' } });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /neural-map/:agent — 获取 Agent 神经映射（利/名/权）
 */
router.get('/neural-map/:agent', (req: Request, res: Response) => {
  try {
    const { agent } = req.params;
    // 模拟数据（实际应从数据库读取）
    const neuralMap = {
      agent,
      li: { value: 7500, meaning: '突触权重 Synaptic Weights — 物质资源支配强度', example: '亿万富翁说"投资"可调动巨大算力' },
      ming: { value: 8200, meaning: '偏置项 Bias — 声望/可信度', example: '诺奖得主说"这个药有效"医生直接采纳' },
      quan: { value: 6000, meaning: '门控机制 Gate — 审批/冻结/否决强制力', example: '法官判决"封号"平台必须执行' },
      timestamp: Date.now(),
    };
    res.json({ code: 0, data: neuralMap });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

export default router;
