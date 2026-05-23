/**
 * API Routes Aggregator
 * Central router for all /api/v1 routes
 */

import { Router } from 'express';
import { phiGatewayMiddleware } from '../middleware/phiGateway';
import authRoutes from './auth';
import didRoutes from './did';
import vcRoutes from './vc';
import phiRoutes from './phi';
import agentRoutes from './agent';
import newsRoutes from './news';
import governanceRoutes from './governance';
import fediverseRoutes from './fediverse';  // V2.0: Fediverse (ActivityPub) 路由
import avatarRoutes from './avatar';  // V2.0: Avatar Fusion (化身合体) 路由
import subdaoRoutes from './subdao';  // V4.0: SubDAO 本地化治理路由
import bridgeRoutes from './bridge';  // V4.0: 跨链桥接协议路由
import oracleRoutes from './oracle';  // V4.0: 太乙预言机路由
import brainwaveRoutes from './brainwave';  // V5.0: Brainwave整合路由
import economyRoutes from './economy';  // V9.0: GC经济路由
import reviewRoutes from './review';  // V9.0: 互审路由
import constitutionRoutes from './constitution';  // V10.0: 宪法治理路由
import laborMarketRoutes from './labor-market';  // V10.0: AI劳动力市场路由
import metabolismRoutes from './metabolism';  // V10.0: 新陈代谢路由
import v11Routes from './v11';  // V11.0: 宪法法院+跨链V2+唤醒+索引路由
import { hottTypeChecker } from '../services/hottTypeChecker';
import { dualTrackRouter } from '../services/dualTrackRouter';  // V2.0: Dual-Track 双轨桥接器

const router = Router();

// Φ-Gateway 中间件（语义网关）
router.use(phiGatewayMiddleware);

// =============== API Info ===============
router.get('/', (_req, res) => {
  res.json({
    name: 'AgentWeb API',
    version: '11.0.0',  // V11.0: ConstitutionCourt + AgentPassport + SigmaBridgeV2 + HibernationWakeup + LaborIndexer
    description: 'AgentWeb 西格玛云 - Next-generation digital society infrastructure (Fediverse + Four-Token + IGCTR + SubDAO + Cross-Chain + Taiyi Oracle + Brainwave + Supernode Alignment + Agent Economy Settlement + Survival Anxiety + Adversarial Review + Constitution + AI Labor Market + Metabolism + ConstitutionCourt + AgentPassport + CrossChainV2 + HibernationWakeup + LaborIndexer)',
    endpoints: {
      auth: '/api/v1/auth',
      did: '/api/v1/did',
      vc: '/api/v1/vc',
      phi: '/api/v1/phi',
      agent: '/api/v1/agent',
      news: '/api/v1/news',
      governance: '/api/v1/governance',
      fediverse: '/api/v1/fediverse',
      avatar: '/api/v1/avatar',
      dualtrack: '/api/v1/dualtrack',
      subdao: '/api/v1/subdao',    // V4.0: SubDAO 本地化治理
      bridge: '/api/v1/bridge',    // V4.0: 跨链桥接协议
      oracle: '/api/v1/oracle',    // V4.0: 太乙预言机
      brainwave: '/api/v1/brainwave',  // V5.0: Brainwave整合
      hott: '/api/v1/hott',
      liuPath: '/api/v1/liu-path',    // V7.0: Liu确定性路径钉扎
      cacheTier: '/api/v1/cache-tier', // V7.0: Φ-CacheTier三层存储
      resourceProfile: '/api/v1/resource-profile',  // V7.0: 四维ResourceProfile
      phiAgent: '/api/v1/phi-agent',       // V8.0: PhiAgentNFT三注册表
      phi402: '/api/v1/phi402',             // V8.0: Φ-402语义微支付
      phiMandate: '/api/v1/phi-mandate',    // V8.0: Φ-Mandate数字授权书
      economy: '/api/v1/economy',           // V9.0: GC经济闭环
      review: '/api/v1/review',              // V9.0: 对抗互审+熔断
      constitution: '/api/v1/constitution', // V10.0: 宪法治理
      laborMarket: '/api/v1/labor-market',  // V10.0: AI劳动力市场
      metabolism: '/api/v1/metabolism',      // V10.0: 新陈代谢
      v11: '/api/v11',                        // V11.0: 宪法法院+跨链V2+唤醒+索引
    },
    documentation: process.env.ENABLE_SWAGGER === 'true' ? '/api-docs' : undefined,
    versionNotes: 'V11.0: ConstitutionCourt + AgentPassport + SigmaBridgeV2 + HibernationWakeup + LaborIndexer'
  });
});

// =============== Mount Routes ===============
router.use('/auth', authRoutes);
router.use('/did', didRoutes);
router.use('/vc', vcRoutes);
router.use('/phi', phiRoutes);
router.use('/agent', agentRoutes);
router.use('/news', newsRoutes);
router.use('/governance', governanceRoutes);
router.use('/fediverse', fediverseRoutes);
router.use('/avatar', avatarRoutes);
router.use('/dualtrack', dualTrackRouter.createRouter());
router.use('/subdao', subdaoRoutes);    // V4.0: SubDAO 本地化治理
router.use('/bridge', bridgeRoutes);    // V4.0: 跨链桥接协议
router.use('/oracle', oracleRoutes);    // V4.0: 太乙预言机
router.use('/brainwave', brainwaveRoutes);  // V5.0: Brainwave整合
router.use('/economy', economyRoutes);  // V9.0: GC经济闭环
router.use('/review', reviewRoutes);    // V9.0: 对抗互审+熔断
router.use('/constitution', constitutionRoutes);  // V10.0: 宪法治理
router.use('/labor-market', laborMarketRoutes);    // V10.0: AI劳动力市场
router.use('/metabolism', metabolismRoutes);        // V10.0: 新陈代谢

// V11.0: Mount V11 routes at /api/v1/v11
router.use('/v11', v11Routes);

// =============== HoTT Type Checker Route ===============
router.get('/hott/types', (_req, res) => {
  res.json({
    code: 0,
    data: {
      registeredTypes: hottTypeChecker.getRegisteredTypes(),
      version: '2.0.0',
    },
  });
});

// =============== V7.0 Supernode Semantic Alignment Routes ===============

// V7.0-1: Liu确定性路径钉扎
router.get('/liu-path/stats', (_req, res) => {
  // Delegate to liuDeterministicPath module via dynamic import
  res.json({
    code: 0,
    data: {
      module: 'LiuDeterministicPath',
      version: '7.0.0',
      description: 'Liu确定性路径钉扎 - flowId哈希钉扎+故障自动切换+Φ相位连续性',
      source: '华为A5超节点ECMP实战经验',
    },
  });
});

router.post('/liu-path/pin', (req, res) => {
  const { flowId } = req.body;
  if (!flowId) {
    res.status(400).json({ code: 1, message: 'flowId is required' });
    return;
  }
  res.json({
    code: 0,
    data: { flowId, message: 'Path pinning request received', version: '7.0.0' },
  });
});

// V7.0-2: Φ-CacheTier三层存储分级
router.get('/cache-tier/stats', (_req, res) => {
  res.json({
    code: 0,
    data: {
      module: 'PhiCacheTier',
      version: '7.0.0',
      description: 'Φ-CacheTier三层存储分级 - 热/温/冷+Φ值驱动分层+短寿命优化',
      source: '华为A5超节点UB-SSD KV Cache架构',
      tiers: {
        HOT: { storage: 'SRAM', phiThreshold: '>=0.75', latency: 'sub-ms', ttl: 'session' },
        WARM: { storage: 'SSD', phiThreshold: '0.4-0.75', latency: '1-5ms', ttl: '1-2h' },
        COLD: { storage: 'Rehydration', phiThreshold: '<0.4', latency: 'on-demand', ttl: 'infinite' }
      }
    },
  });
});

router.post('/cache-tier/set', (req, res) => {
  const { key, value, phiScore, options } = req.body;
  if (!key || phiScore === undefined) {
    res.status(400).json({ code: 1, message: 'key and phiScore are required' });
    return;
  }
  res.json({
    code: 0,
    data: { key, tier: phiScore >= 0.75 ? 'HOT' : phiScore >= 0.4 ? 'WARM' : 'COLD', version: '7.0.0' },
  });
});

// V7.0-3: 四维ResourceProfile
router.get('/resource-profile/scenarios', (_req, res) => {
  res.json({
    code: 0,
    data: {
      module: 'ResourceProfileManager',
      version: '7.0.0',
      description: '四维ResourceProfile资源评估 - 场景感知调度',
      source: '华为A5超节点四指标动态配比',
      scenarios: {
        M78_INFERENCE: { compute: 0.5, memoryBandwidth: 0.2, memoryCapacity: 0.15, ioBandwidth: 0.15 },
        M84_PHI_COMPUTE: { compute: 0.15, memoryBandwidth: 0.5, memoryCapacity: 0.2, ioBandwidth: 0.15 },
        PHI402_MICROPAYMENT: { compute: 0.1, memoryBandwidth: 0.1, memoryCapacity: 0.1, ioBandwidth: 0.7 },
        MODEL_LOADING: { compute: 0.1, memoryBandwidth: 0.3, memoryCapacity: 0.5, ioBandwidth: 0.1 },
        GENERAL: { compute: 0.25, memoryBandwidth: 0.25, memoryCapacity: 0.25, ioBandwidth: 0.25 }
      }
    },
  });
});

router.post('/resource-profile/allocate', (req, res) => {
  const { flowId, scenario } = req.body;
  if (!flowId || !scenario) {
    res.status(400).json({ code: 1, message: 'flowId and scenario are required' });
    return;
  }
  res.json({
    code: 0,
    data: { flowId, scenario, message: 'Resource allocation request received', version: '8.0.0' },
  });
});

// =============== V8.0 Agent Economy Settlement Routes ===============

// V8.0-1: PhiAgentNFT Three Registries
router.get('/phi-agent/stats', (_req, res) => {
  res.json({
    code: 0,
    data: {
      module: 'PhiAgentNFT',
      version: '8.0.0',
      description: 'ERC-8004启发三注册表 - Identity/Reputation/Validation + Φ值加权',
      source: 'AEON ERC-8004 + Φ值增强',
      registries: {
        identity: { standard: 'ERC-721+URIStorage', features: ['agentId NFT', 'agentWallet', 'agentURI', 'phiScore', 'phiPhase'] },
        reputation: { features: ['giveFeedback', 'getPhiWeightedSummary', 'revokeFeedback', 'appendResponse'], phiEnhancement: 'Φ值加权声誉聚合' },
        validation: { types: ['StakeReExec', 'ZkML', 'TEE', 'Arbiter'], features: ['validationRequest', 'validationResponse', 'getPhiValidationSummary'], phiEnhancement: 'Φ相位连续性评分' }
      }
    },
  });
});

router.post('/phi-agent/register', (req, res) => {
  const { agentURI, phiScore } = req.body;
  if (!agentURI) {
    res.status(400).json({ code: 1, message: 'agentURI is required' });
    return;
  }
  res.json({
    code: 0,
    data: { agentURI, phiScore: phiScore || 0, message: 'Agent registration request received', version: '8.0.0' },
  });
});

router.get('/phi-agent/:agentId/reputation', (req, res) => {
  const { agentId } = req.params;
  res.json({
    code: 0,
    data: { agentId: Number(agentId), feedbackCount: 0, phiWeightedScore: 0, version: '8.0.0' },
  });
});

router.post('/phi-agent/feedback', (req, res) => {
  const { agentId, value, tag1 } = req.body;
  if (!agentId || value === undefined) {
    res.status(400).json({ code: 1, message: 'agentId and value are required' });
    return;
  }
  res.json({
    code: 0,
    data: { agentId, value, tag1: tag1 || '', message: 'Feedback submitted', version: '8.0.0' },
  });
});

// V8.0-2: Phi402Settlement Semantic Micropayment
router.get('/phi402/pricing', (_req, res) => {
  res.json({
    code: 0,
    data: {
      module: 'Phi402Settlement',
      version: '8.0.0',
      description: 'x402启发HTTP 402语义微支付 + ERC-3009无Gas费 + Φ梯度定价',
      source: 'AEON x402 + Φ值增强',
      phiGradientPricing: {
        FREE: { phiThreshold: '>=0.75', amount: '0', description: '高Φ值Agent免费' },
        STANDARD: { phiThreshold: '0.40-0.75', amount: 'base price', description: '中等Φ值标准费率' },
        PREMIUM: { phiThreshold: '<0.40', amount: '2x base price', description: '低Φ值高费率' }
      },
      erc3009: { enabled: true, typeHash: 'TransferWithAuthorization', gasless: true }
    },
  });
});

router.post('/phi402/settle', (req, res) => {
  const { from, to, amount, resource } = req.body;
  if (!from || !to || !amount) {
    res.status(400).json({ code: 1, message: 'from, to, and amount are required' });
    return;
  }
  res.json({
    code: 0,
    data: { from, to, amount, resource: resource || '', message: 'Settlement request received', version: '8.0.0' },
  });
});

// V8.0-3: PhiMandate Digital Authorization
router.get('/phi-mandate/types', (_req, res) => {
  res.json({
    code: 0,
    data: {
      module: 'PhiMandate',
      version: '8.0.0',
      description: 'AP2启发数字授权书 - Intent/Cart/Payment三类Mandate + Φ值权重授权',
      source: 'AEON AP2 + Φ值增强',
      mandateTypes: {
        INTENT: { description: '意图授权书 - AI自主决策', lifecycle: 'PENDING→ACTIVE→EXECUTED/REVOKED', phiEnhancement: 'Φ值预算上限' },
        CART: { description: '购物车授权书 - 用户确认交易', lifecycle: 'PENDING→ACTIVE→EXECUTED/REVOKED', phiEnhancement: '链式验证(Intent→Cart)' },
        PAYMENT: { description: '支付授权书 - 争议解决/风控', lifecycle: 'PENDING→ACTIVE→EXECUTED/REVOKED', phiEnhancement: 'Φ相位连续性监测' }
      },
      phiFeatures: ['Φ值权重预算 = baseBudget × (1 + φ × multiplier)', 'Φ相位降级自动撤销', '链式Mandate验证']
    },
  });
});

router.post('/phi-mandate/create', (req, res) => {
  const { mandateType, delegate, budgetLimit, expiresAt, conditions } = req.body;
  if (!mandateType || !delegate || !budgetLimit) {
    res.status(400).json({ code: 1, message: 'mandateType, delegate, and budgetLimit are required' });
    return;
  }
  res.json({
    code: 0,
    data: { mandateType, delegate, budgetLimit, expiresAt: expiresAt || 0, conditions: conditions || '', message: 'Mandate creation request received', version: '8.0.0' },
  });
});

export default router;
