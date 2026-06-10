/**
 * ASG (Agent Security Gateway) 核心类型定义
 *
 * 基于MetaMask Agent Wallet文章 — Consensys四道安全防线
 * AI Agent自主操作的隐私安全框架：
 * L1 Agent身份(DID) → L2 策略沙箱(Guard/Beast) → L3 交易门控(三重审核)
 * → L4 人机回环(HITL) → L5 TEE密钥隔离 → L6 经济安全池(Stake/Slash)
 *
 * @version V17.0
 * @author TaiyiAGI Team
 * @license MIT
 */

// ============================================================================
// 导入 V15.0 OPLC + V16.0 PPCL 基础类型
// ============================================================================

import {
  TransactionId,
  NodeId,
  TernaryVoteValue,
  PhiMetric,
} from '../oplc/types';
import {
  EncryptedRecord,
  ViewKey,
  ZKProof,
  PPCLTransaction,
} from '../ppcl/types';

// ============================================================================
// L1: Agent 身份注册层 (Agent Identity Registry)
// ============================================================================

/** Agent 运行模式 */
export enum AgentMode {
  GUARD = 'guard',       // 守护模式（严格）：每笔需审批，高安全
  BEAST = 'beast',       // 野兽模式（宽松）：放权更多，自动化执行
}

/** Agent 能力声明（可执行的操作类型集合） */
export interface AgentSkillDeclaration {
  skillId: string;
  name: string;                    // e.g., 'swap', 'perpetuals', 'staking'
  description: string;
  /** 该能力需要的最小信任等级 */
  minTrustLevel: number;           // 0~1
  /** 是否涉及资金操作 */
  involvesFundMovement: boolean;
  /** 最大单次操作金额限制（相对于总资产的比例） */
  maxSingleOperationRatio: number; // 0~1
  /** 需要的协议白名单（空=全部允许） */
  allowedProtocols?: string[];
  /** 需要的资产白名单（空=全部允许） */
  allowedAssets?: string[];
}

/** Agent 行为策略（Policy Sandbox规则集） */
export interface AgentPolicy {
  policyId: string;
  agentId: string;

  /** 日消费上限（最小单位） */
  dailySpendingLimit: number;

  /** 单笔交易上限 */
  perTransactionLimit: number;

  /** 协议白名单（空=禁止所有，['*']=全部允许） */
  protocolWhitelist: string[];

  /** 资产白名单 */
  assetWhitelist: string[];

  /** 时间窗口限制 */
  timeWindow: {
    activeFrom: string;     // HH:mm
    activeUntil: string;    // HH:mm
    timezone: string;       // e.g., 'Asia/Shanghai'
    /** 允许的星期几 (0=Sun, 6=Sat)，空=全部允许 */
    allowedDays?: number[];
  };

  /** 当前运行模式 */
  mode: AgentMode;

  /** 需要HITL人工审批的交易条件 */
  hitlTriggers: HITLTriggerCondition[];

  /** 创建时间 */
  createdAt: Date;

  /** 更新时间 */
  updatedAt: Date;

  /** 策略版本号 */
  version: number;

  /** 所有者签名（防篡改） */
  ownerSignature: string;
}

/** HITL 触发条件 */
export interface HITLTriggerCondition {
  triggerId: string;
  conditionType:
    | 'amount_exceeds_threshold'      // 金额超阈值
    | 'protocol_not_in_whitelist'     // 协议不在白名单
    | 'asset_not_in_whitelist'        // 资产不在白名单
    | 'outside_time_window'           // 超出时间窗口
    | 'high_risk_score'               // 高风险评分
    | 'consecutive_failures'          // 连续失败次数
    | 'first_time_protocol'           // 首次使用某协议
    | 'manual_override';              // 手动触发
  thresholdValue?: number;            // 条件阈值
  requiredAction: 'approve' | 'reject' | 'escalate';  // 所需动作
}

/**
 * Agent 身份 (Agent Identity)
 *
 * 参考Ledger AI安全路线图四要素：
 * Agent Identity + Agent Skills + Agent Policies + Proof of Human
 *
 * 使用DID(Decentralized Identifier)作为唯一标识
 */
export interface AgentIdentity {
  /** Agent唯一标识符（DID格式） */
  did: string;

  /** Agent显示名称 */
  displayName: string;

  /** Agent类型 */
  agentType:
    | 'trading_bot'         // 交易机器人
    | 'yield_optimizer'     // 收益优化器
    | 'payment_processor'   // 支付处理器
    | 'governance_voter'    // 治理投票者
    | 'liquidity_provider'  // 流动性提供者
    | 'arbitrageur'         // 套利者
    | 'general_agent';      // 通用智能体

  /** Owner DID（创建者的DID） */
  ownerDid: string;

  /** Agent公钥（用于签名验证） */
  publicKey: string;

  /** 能力声明列表 */
  skills: AgentSkillDeclaration[];

  /** 当前生效策略 */
  currentPolicy: AgentPolicy;

  /** 信任分数 (0~1) */
  trustScore: number;

  /** 人类存在证明 (PoH - Proof of Human) */
  proofOfHuman: ProofOfHuman;

  /** 注册时间 */
  registeredAt: Date;

  /** 最后活跃时间 */
  lastActiveAt: Date;

  /** 总操作数 */
  totalOperations: number;

  /** 成功操作数 */
  successfulOperations: number;

  /** 状态 */
  status: AgentStatus;
}

export enum AgentStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  REVOKED = 'revoked',
  FROZEN = 'frozen',          // 紧急冻结
}

/**
 * 人类存在证明 (Proof of Human)
 *
 * 防AI女巫攻击的核心机制：
 * 证明该Agent背后有真实人类控制者
 */
export interface ProofOfHuman {
  pohId: string;
  /** 验证方法 */
  method:
    | 'webauthn_passkey'     // WebAuthn密钥（硬件级）
    | 'biometric'            // 生物识别（指纹/面部）
    | 'social_graph'         // 社交图谱验证
    | 'stake_bonded';        // 质押绑定
  verifiedAt: Date;
  expiresAt: Date;
  /** PoH提供方签名 */
  providerSignature: string;
  valid: boolean;
}

// ============================================================================
// L2/L3: 交易门控管线 (Transaction Gate Pipeline)
// ============================================================================

/** 门控阶段枚举 */
export enum GateStage {
  SIMULATION = 'simulation',           // 阶段1: 链上交易模拟
  THREAT_SCAN = 'threat_scan',         // 阶段2: 威胁扫描
  MEV_PROTECTION = 'mev_protection',   // 阶段3: MEV防护
}

/** 门控结果 */
export interface GateResult {
  stage: GateStage;
  passed: boolean;
  /** 不通过时的原因码 */
  reasonCode?:
    | 'SIMULATION_FAILED'              // 模拟执行失败
    | 'INSUFFICIENT_BALANCE'           // 余额不足
    | 'SLIPPAGE_TOO_HIGH'              // 滑点过高
    | 'CONTRACT_FLAGGED'               // 合约被标记为恶意
    | 'PHISHING_DETECTED'              // 钓鱼检测
    | 'SUSPICIOUS_PATTERN'             // 可疑模式
    | 'FRONT_RUN_RISK'                 // 被夹子风险
    | 'SANDWICH_ATTACK_RISK'           // 三明治攻击风险
    | 'UNKNOWN_PROTOCOL'               // 未知协议
    | 'POLICY_VIOLATION';              // 策略违规;
  /** 风险评分 (0=安全, 10=极高危) */
  riskScore: number;                   // 0~10
  /** 处理耗时(ms) */
  latencyMs: number;
  /** 额外的元数据 */
  metadata?: Record<string, unknown>;
}

/** 模拟阶段结果 */
export interface SimulationResult extends GateResult {
  estimatedGasUsed: string;
  estimatedOutput: string;              // 预估输出金额
  priceImpact: number;                  // 价格影响(%)
  slippage: number;                     // 预期滑点(%)
  /** 模拟执行的交易trace */
  executionTrace?: string;
}

/** 威胁扫描结果 */
export interface ThreatScanResult extends GateResult {
  /** Blockaid风格的安全引擎检测结果 */
  threatTypes: ThreatType[];
  /** 恶意合约地址检测 */
  maliciousContractDetected: boolean;
  /** 钓鱼网站检测 */
  phishingDetected: boolean;
  /** 可疑模式匹配 */
  suspiciousPatternMatches: PatternMatch[];
}

export type ThreatType =
  | 'drain'                             // 资金耗尽攻击
  | 'approval_phishing'                 // 授权钓鱼
  | 'private_key_compromise'            // 私钥泄露
  | 'malicious_contract'                // 恶意合约
  | 'social_engineering'                // 社会工程学
  | 'flash_loan_attack'                 // 闪电贷攻击
  | 'sandwich_attack';                  // 三明治攻击

export interface PatternMatch {
  patternName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;                    // 0~1 匹配置信度
  description: string;
}

/** MEV防护结果 */
export interface MEVProtectionResult extends GateResult {
  /** 是否检测到MEV风险 */
  mevRiskDetected: boolean;
  /** 建议的MEV防护策略 */
  recommendedStrategy:
    | 'private_mempool'                 // 私有交易池
    | 'flashbots_bundle'                // Flashbots打包
    | 'commit-reveal-scheme'            // 承诺-揭示方案
    | 'none_required';                  // 无需防护
  /** 预估MEV损失 */
  estimatedMevLoss?: number;
}

/** 完整的三重门控管线结果 */
export interface FullGatePipelineResult {
  transactionId: TransactionId;
  agentDid: string;
  overallPassed: boolean;
  simulation: SimulationResult;
  threatScan: ThreatScanResult;
  mevProtection: MEVProtectionResult;
  /** 综合风险评分（取各阶段最高值） */
  aggregateRiskScore: number;
  /** 是否需要升级到HITL */
  requiresHitlEscalation: boolean;
  /** 门控耗时总计(ms) */
  totalLatencyMs: number;
  processedAt: Date;
}

// ============================================================================
// L4: 人机回环服务 (Human-In-The-Loop Service)
// ============================================================================

/** HITL 请求状态 */
export enum HITLStatus {
  PENDING = 'pending',                 // 等待用户确认
  APPROVED = 'approved',               // 用户批准
  REJECTED = 'rejected',               // 用户拒绝
  EXPIRED = 'expired',                 // 超时未处理（默认拒绝）
  ESCALATED = 'escalated',             // 已升级到更高权限
}

/** HITL 请求 */
export interface HITLRequest {
  requestId: string;
  agentDid: string;
  transactionId: TransactionId;

  /** 关联的门控管线结果 */
  gateResult: FullGatePipelineResult;

  /** 触发的策略条件 */
  triggeredCondition: HITLTriggerCondition;

  /** 请求详情（展示给用户的摘要） */
  userFacingSummary: {
    title: string;                      // e.g., "大额swap待确认"
    description: string;                // 人类可读的操作描述
    amount: string;                     // 涉及金额
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    /** 操作预览图或数据快照 */
    previewData?: Record<string, unknown>;
  };

  /** 通知渠道 */
  notificationChannels: NotificationChannel[];

  /** 过期时间（超时自动拒绝） */
  expiresAt: Date;

  status: HITLStatus;

  /** 用户响应时间 */
  respondedAt?: Date;

  /** 用户响应（签名确认） */
  userResponseSignature?: string;

  createdAt: Date;
}

export type NotificationChannel =
  | 'push_notification'                // 手机推送
  | 'email'                            // 邮件
  | 'sms'                              // 短信
  | 'in_app'                           // 应用内弹窗
  | 'telegram';                        // Telegram Bot

// ============================================================================
// L5: TEE 密钥管理器 (TEE Key Manager)
// ============================================================================

/** TEE 密钥状态 */
export enum TeeKeyStatus {
  ACTIVE = 'active',
  EXPORTED = 'exported',               // 已导出助记词
  REVOKED = 'revoked',
  ROTATED = 'rotated',                 // 已轮换
}

/**
 * TEE 隔离的密钥条目
 *
 * 核心设计原则：
 * - 私钥存放于TEE硬件隔离区
 * - 系统运营方自身也无法获取私钥
 * - 用户可随时导出助记词保留完全主权
 */
export interface TeeKeyEntry {
  keyId: string;
  agentDid: string;

  /** 公钥（可公开） */
  publicKey: string;

  /** 密钥类型 */
  keyType:
    | 'signing'                         // 签名密钥
    | 'encryption';                     // 加密密钥

  /** 密钥算法 */
  algorithm:
    | 'secp256k1'                       // ECDSA (以太坊标准)
    | 'ed25519'                        // EdDSA
    | 'x25519';                        // X25519 ECDH

  /** TEE证明（证明密钥确实在可信环境中生成） */
  teeAttestation: string;

  /** 密钥路径派生信息（BIP32/BIP44风格） */
  derivationPath: string;

  status: TeeKeyStatus;

  createdAt: Date;

  lastUsedAt?: Date;

  /** 导出记录（如已导出助记词） */
  exportRecord?: {
    exportedAt: Date;
    exportMethod: 'mnemonic' | 'raw_key';
    exportDestinationHash: string;      // 导出目标哈希（不存储实际地址）
  };
}

/** 助记词导出请求 */
export interface MnemonicExportRequest {
  requestId: string;
  agentDid: string;
  requestedAt: Date;
  /** 二次验证方式 */
  secondaryAuthMethod: 'password' | 'biometric' | 'hardware_key';
  /** 请求状态 */
  status: 'pending' | 'completed' | 'failed';
  completedAt?: Date;
}

// ============================================================================
// L6: 经济安全池 (Economic Safety Pool)
// ============================================================================

/** 质押条目 */
export interface StakeEntry {
  stakeId: string;
  agentDid: string;
  stakerDid: string;                   // 质押者（通常是Agent Owner）
  amount: number;                      // 质押金额
  currency: string;                    // 质押币种
  lockedUntil: Date;                   // 锁定到期时间
  status: 'active' | 'unlocked' | 'slashed';
  stakedAt: Date;
}

/** Slashing事件 */
export interface SlashingEvent {
  eventId: string;
  stakeId: string;
  agentDid: string;
  slashReason:
    | 'privacy_breach'                 // 隐私泄露
    | 'policy_violation'               // 严重策略违反
    | 'fraudulent_activity'            // 欺诈行为
    | 'collusion'                      // 共谋攻击
    | 'availability_failure';          // 可用性故障
  slashedAmount: number;
  /** 剩余质押 */
  remainingStake: number;
  /** 报告者奖励（举报人获得被罚没金额的一定比例） */
  reporterReward: number;
  reporterDid?: string;
  eventTime: Date;
}

/** 赔付申请 */
export interface ClaimRequest {
  claimId: string;
  transactionId: TransactionId;
  claimantDid: string;
  /** 声称的交易通过了门控但仍然造成损失 */
  claimedLossAmount: number;
  evidence: string;                    // 损失证据哈希
  /** 门控管线结果（证明系统当时判定为"安全"） */
  gatePipelineResultId: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'paid_out';
  submittedAt: Date;
  reviewedAt?: Date;
  payoutAmount?: number;
}

/** 经济安全池统计 */
export interface EconomicSafetyPoolStats {
  /** 池中总质押额 */
  totalStaked: number;
  /** 已罚没总额 */
  totalSlashed: number;
  /** 已赔付总额 */
  totalPaidOut: number;
  /** 当前赔付率（赔付总额/总质押） */
  payoutRatio: number;
  /** 活跃Agent数 */
  activeAgents: number;
  /** 本月剩余赔付预算 */
  monthlyBudgetRemaining: number;
  /** 平均赔付处理时间(ms) */
  avgClaimProcessingMs: number;
}

// ============================================================================
// ASG 统一交易请求
// ============================================================================

/**
 * ASG 交易请求 (Agent Operation Request)
 *
 * AI Agent提交的每一个链上操作都必须经过此结构封装
 */
export interface AgentOperationRequest {
  requestId: string;
  agentDid: string;

  /** 操作类型（对应Agent Skill） */
  operationType: string;

  /** 操作参数 */
  params: Record<string, unknown>;

  /** 目标协议地址 */
  targetProtocol: string;

  /** 涉及资产和金额 */
  assetMovements: Array<{
    asset: string;                     // 代币符号或地址
    amount: string;                    // 精度化金额
    direction: 'in' | 'out';           // 方向
  }>;

  /** 期望的最长等待时间(ms） */
  maxLatencyMs: number;

  /** 是否要求强制HITL（无论策略如何） */
  forceHitl: boolean;

  /** 提交时间 */
  submittedAt: Date;
}

/**
 * ASG 操作响应 (完整生命周期结果)
 */
export interface AgentOperationResponse {
  requestId: string;
  operationType: string;
  finalStatus:
    | 'executed'                       // 成功执行
    | 'gate_rejected'                  // 门控拒绝
    | 'hitl_rejected'                  // HITL用户拒绝
    | 'hitl_expired'                   // HITL超时
    | 'error';                         // 系统错误

  /** 门控管线结果 */
  gateResult?: FullGatePipelineResult;

  /** HITL流程（如有） */
  hitlFlow?: HITLRequest;

  /** 上链结果（如成功执行） */
  onChainResult?: {
    txHash: string;
    blockNumber: number;
    gasUsed: string;
    actualOutput: string;
  };

  /** 加密记录引用（PPCL集成） */
  encryptedRecordRef?: string;

  /** ZK合规证明（PPCL集成） */
  complianceProofs?: ZKProof[];

  /** 整体耗时(ms) */
  totalLatencyMs: number;

  completedAt: Date;
}

// ============================================================================
// ASG 系统状态
// ============================================================================

export interface ASGSystemState {
  /** 注册的Agent总数 */
  totalAgents: number;
  /** 活跃Agent数 */
  activeAgents: number;
  /** 今日总操作请求数 */
  todayTotalRequests: number;
  /** 今日通过门控数 */
  todayGatePassed: number;
  /** 今日HITL请求数 */
  todayHitlRequests: number;
  /** HITL平均响应时间(ms) */
  avgHitlResponseMs: number;
  /** 门控拦截率 */
  gateRejectionRate: number;
  /** 综合风险趋势（最近24h） */
  riskTrend24h: Array<{ hour: number; avgRiskScore: number }>;
  /** 经济池统计 */
  economicPool: EconomicSafetyPoolStats;
  /** TEE密钥管理统计 */
  teeKeyStats: {
    totalKeys: number;
    activeKeys: number;
    exportedKeys: number;
  };
}
