/**
 * PPCL (隐私保护共识层) 核心类型定义
 *
 * 基于微信文章《稳定币需要隐身》— PANews/Zen
 * 三层隐私模型: 默认保密 → 选择性披露 → 合规连接
 * 扩展 V15.0 OPLC 类型体系，增加加密记录、视图密钥、ZK证明等类型
 *
 * @version V16.0
 * @author TaiyiAGI Team
 * @license MIT
 */

// ============================================================================
// 导入 V15.0 OPLC 基础类型（扩展而非替换）
// ============================================================================

import {
  TransactionId,
  NodeId,
  TernaryVoteValue,
  TernaryVote,
  MerkleProof,
  PhiMetric,
} from '../oplc/types';

// Re-export Φ metric for transparency debt meter use
export { type PhiMetric } from '../oplc/types';

// ============================================================================
// 第一层：默认保密 — 加密记录模型 (Encrypted Record Model)
// ============================================================================

/** 加密算法枚举 */
export enum EncryptionAlgorithm {
  AES_256_GCM = 'aes-256-gcm',
  X25519_CHACHA20 = 'x25519-chacha20',
  SHA256_HMAC = 'sha256-hmac',       // 用于完整性校验
}

/** 记录访问权限等级 */
export enum AccessLevel {
  PUBLIC = 0,        // 公开可读（如交易哈希）
  VIEW_KEY = 1,      // 持有View Key可解密（审计/监管/对手方）
  OWNER = 2,         // 仅所有者完整访问
  SYSTEM = 3,        // 系统级（共识验证用，不暴露明文给外部）
}

/**
 * 加密记录 (Encrypted Record)
 *
 * 参考Aleo的record model设计：
 * 所有敏感数据以密文形式存储于Poset节点中，
 * 仅授权方通过对应密钥解密。
 *
 * 核心思想：状态不是"公开数字"而是"加密记录"
 */
export interface EncryptedRecord {
  /** 记录唯一标识 */
  recordId: string;

  /** 加密后的payload（base64编码的密文） */
  ciphertext: string;

  /** 初始化向量（IV/Nonce） */
  nonce: string;

  /** 使用的加密算法 */
  algorithm: EncryptionAlgorithm;

  /** 记录创建者（公钥哈希） */
  ownerPublicKeyHash: string;

  /** 记录类型标签（明文，用于路由和索引） */
  recordType: string;          // e.g., 'transfer', 'payment', 'salary'

  /** 各字段的访问级别映射（字段名 → AccessLevel） */
  fieldAccessLevels: Record<string, AccessLevel>;

  /** 字段级加密元数据（每个字段的独立加密参数） */
  fieldEncryptionMeta: Array<{
    fieldName: string;
    ciphertextOffset: number;   // 在总ciphertext中的偏移
    ciphertextLength: number;
    accessLevel: AccessLevel;
  }>;

  /** 创建时间戳 */
  createdAt: Date;

  /** 过期时间（可选，用于临时授权数据） */
  expiresAt?: Date;

  /** Merkle承诺值（用于ZK proof） */
  merkleCommitment: string;
}

/**
 * 加密记录的明文模板（用于序列化/反序列化）
 * 实际明文永不以持久化形式存储
 */
export interface PlaintextRecordTemplate {
  recordId: string;
  recordType: string;
  fields: Record<string, unknown>;           // 明文字段
  ownerPublicKeyHash: string;
  createdAt: Date;
  fieldAccessLevels?: Record<string, AccessLevel>;  // 字段访问级别（可选，默认VIEW_KEY）
}

// ============================================================================
// 第二层：选择性披露 — 视图密钥机制 (View Key Selective Disclosure)
// ============================================================================

/** 视图密钥权限范围 */
export interface ViewKeyScope {
  /** 可解密的字段列表（空数组=全部OWNER级别字段） */
  allowedFields: string[];

  /** 时间窗口 */
  validFrom: Date;
  validUntil?: Date;

  /** 最大使用次数（0=无限） */
  maxUses: number;

  /** 已使用次数 */
  usedCount: number;

  /** 授权原因码 */
  purpose: ViewKeyPurpose;

  /** 授权者签名 */
  grantorSignature: string;
}

/** 视图密钥用途分类 */
export enum ViewKeyPurpose {
  AUDIT = 'audit',               // 审计目的
  REGULATORY = 'regulatory',     // 监管要求（AML/KYC/旅行规则）
  COUNTERPARTY = 'counterparty', // 交易对手识别
  RISK_CONTROL = 'risk_control', // 内部风控
  DISPUTE = 'dispute',           // 争议解决/司法
  SYSTEM = 'system',             // 系统内部验证
}

/**
 * 视图密钥 (View Key)
 *
 * 选择性披露的核心原语：
 * - 默认状态：所有加密记录对外不可读
 * - 授权后：持有View Key的方可在scope范围内解密指定字段
 * - 类比Aleo的view key + snarkOS v4增强（收款方可识别发送方）
 */
export interface ViewKey {
  /** 密钥唯一标识 */
  keyId: string;

  /** 关联的记录ID或通配符('*'=该owner的所有记录） */
  targetRecordId: string;

  /** 授权接收者的公钥哈希 */
  grantedTo: string;

  /** 授权者（记录所有者） */
  grantedBy: string;

  /** 加密后的对称密钥（用grantedTo的公钥加密） */
  encryptedSymmetricKey: string;

  /** 权限范围 */
  scope: ViewKeyScope;

  /** 密钥状态 */
  status: ViewKeyStatus;

  /** 创建时间 */
  createdAt: Date;

  /** 撤销时间（如有） */
  revokedAt?: Date;

  /** 撤销原因 */
  revokeReason?: string;
}

export enum ViewKeyStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  DEPLETED = 'depleted',   // 使用次数耗尽
}

/**
 * 披露日志 (Disclosure Log)
 * 每次View Key使用都产生不可篡改的审计日志
 */
export interface DisclosureLogEntry {
  logId: string;
  viewKeyId: string;
  accessedBy: string;
  targetRecordId: string;
  accessedFields: string[];
  accessTime: Date;
  ipAddress?: string;      // 可选：IP哈希
  purpose: ViewKeyPurpose;
  /** 该次访问产生的ZK证明（证明访问合法但不泄露内容） */
  zkAccessProof?: ZKProof;
}

// ============================================================================
// 第三层：合规连接 — 零知识证明 + 合规工具链集成
// ============================================================================

/**
 * 零知识证明 (Zero-Knowledge Proof)
 *
 * 用于在不暴露原始数据的前提下完成合规验证：
 * - 资金来源合法性（Privacy Pools思路）
 * - 身份资质验证（KYC without doxxing）
 * - 制裁筛查（Sanction screening without exposure）
 * - 旅行规则合规（Travel Rule info passing）
 */
export interface ZKProof {
  proofId: string;
  /** 证明类型 */
  proofType: ZKProofType;
  /** 证明数据（序列化的ZK-SNARK/STWARK证明） */
  proofData: string;
  /** 公开输入（不包含敏感信息） */
  publicInputs: Record<string, string>;
  /** 验证密钥引用 */
  verificationKeyRef: string;
  /** 创建时间 */
  createdAt: Date;
  /** 有效期 */
  validUntil: Date;
  /** 是否已验证 */
  verified: boolean;
}

export enum ZKProofType {
  FUNDS_ORIGIN = 'funds_origin',         // 资金来源清洁证明（非污染）
  IDENTITY_VERIFICATION = 'identity_verify',  // 身份资质（不暴露PII）
  SANCTION_SCREENING = 'sanction_screen',     // 制裁名单不在列证明
  TRAVEL_RULE_COMPLIANCE = 'travel_rule',     // 旅行规则信息传递证明
  THRESHOLD_ACCESS = 'threshold_access',      // 阈值访问证明（View Key使用合法）
  BALANCE_PROOF = 'balance_proof',            // 余额范围证明（≥X但≠精确值）
  MEMBERSHIP = 'membership',                  // 成员资格证明（在允许集合中）
}

/**
 * 合规检查请求
 */
export interface ComplianceCheckRequest {
  requestId: string;
  entityType: 'transaction' | 'account' | 'node';
  entityId: string;
  checks: ComplianceCheckType[];
  priority: 'normal' | 'high' | 'critical';
  requestedBy: NodeId;
  requestedAt: Date;
}

export enum ComplianceCheckType {
  KYC = 'kyc',
  AML = 'aml',
  SANCTION = 'sanction',
  TRAVEL_RULE = 'travel_rule',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  THRESHOLD_REPORTING = 'threshold_reporting',
}

/**
 * 合规检查结果
 */
export interface ComplianceCheckResult {
  requestId: string;
  checks: Array<{
    type: ComplianceCheckType;
    passed: boolean;
    /** ZK证明（通过时提供） */
    proof?: ZKProof;
    /** 不通过原因（脱敏） */
    reasonIfFailed?: string;
    checkedAt: Date;
    latencyMs: number;
  }>;
  overallPassed: boolean;
  /** 整体ZK聚合证明 */
  aggregateProof?: ZKProof;
  completedAt: Date;
}

// ============================================================================
// 透明性债务量化 (Transparency Debt Quantification)
// 扩展V15.0的Φ度量体系
// ============================================================================

/**
 * 透明性债务指标 (Transparency Debt Metrics)
 *
 * 文章提出的四类成本的Φ-量化版本：
 * 每一类成本都可被映射为拓扑阻抗/熵/相位耦合的具体度量
 *
 * 核心洞察：
 * "稳定币进入真实商业场景后，链上默认透明带来的四类成本"
 */
export interface TransparencyDebtMetrics extends PhiMetric {
  // ===== 四类透明性债务 =====

  /** 商业博弈成本 — 信息泄露导致的竞争劣势 */
  commercialGameCost: {
    score: number;              // 0~1, 越高越危险
    exposedSupplierNetwork: boolean;     // 供应商网络是否可推断
    exposedCashFlowPattern: boolean;    // 现金流节奏是否可推断
    exposedPricingStrategy: boolean;    // 定价策略是否可推断
    estimatedIntelLeakage: number;      // 情报泄露估算值(0~1)
  };

  /** 合规与数据治理成本 — 双重合规负担 */
  complianceGovernanceCost: {
    score: number;
    onChainDataVolume: number;          // 链上暴露的数据量(bytes)
    requiredOffChainMaterials: number;  // 需补充的链下材料数量
    dataLeakRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    travelRuleGap: boolean;             // 旅行规则缺口
  };

  /** 安全与人身风险成本 — 资产路径公开化 */
  securityRiskCost: {
    score: number;
    assetExposureLevel: number;         // 资产暴露程度(0~1)
    attackSurfaceArea: number;          // 攻击面积估算
    personalSafetyRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    extortionVectorCount: number;       // 勒索攻击向量数
  };

  /** 产品与制度设计成本 — 边界模糊 */
  designCost: {
    score: number;
    boundaryClarity: number;            // 边界清晰度(0~1,越高越好)
    disclosureMechanismGap: boolean;    // 披露机制缺失
    governanceAmbiguity: number;        // 治理模糊度(0~1)
    revocationReadiness: number;        // 撤销就绪度(0~1)
  };

  // ===== 综合指标 =====

  /** 总透明性债务分数 (0=无债务, 1=最大债务) */
  totalTransparencyDebt: number;

  /** 隐私改善潜力 (应用PPCL后的预估降低幅度 0~1) */
  privacyImprovementPotential: number;

  /** 推荐缓解策略 */
  recommendedMitigations: MitigationStrategy[];
}

/** 缓解策略 */
export interface MitigationStrategy {
  strategy: string;
  targetDebtComponent: keyof Pick<TransparencyDebtMetrics,
    | 'commercialGameCost'
    | 'complianceGovernanceCost'
    | 'securityRiskCost'
    | 'designCost'
  >;
  estimatedReduction: number;    // 预估降低幅度 0~1
  implementationEffort: 'LOW' | 'MEDIUM' | 'HIGH';
  ppclFeatureUsed: string;      // 对应的PPCL功能
}

// ============================================================================
// PPCL 扩展的交易类型
// ============================================================================

/**
 * PPCL 加密交易 — 扩展 V15.0 PosetTransaction
 *
 * 在OPLC交易基础上增加加密封装层
 */
export interface PPCLTransaction {
  /** 继承 OPLC 交易基础结构（部分字段加密） */
  baseTx: {
    id: TransactionId;
    parents: TransactionId[];
    creator: NodeId;
    lamportTimestamp: number;
    aggregatedVote: TernaryVoteValue;
    finalized: boolean;
    createdAt: Date;
  };

  /** 加密记录（替代原来的明文data） */
  encryptedRecord: EncryptedRecord;

  /** 关联的View Key列表（已授权的） */
  authorizedViewKeys: ViewKey[];

  /** 关联的ZK合规证明 */
  complianceProofs: ZKProof[];

  /** 披露访问日志 */
  disclosureLogs: DisclosureLogEntry[];

  /** 透明性债务快照（创建时的债务评估） */
  transparencySnapshot: TransparencyDebtMetrics;
}

// ============================================================================
// PPCL 配置
// ============================================================================

export interface PPCLSystemConfig {
  /** 默认加密算法 */
  defaultAlgorithm: EncryptionAlgorithm;

  /** View Key 最大有效期（毫秒） */
  viewKeyMaxTTL: number;

  /** View Key 最大使用次数 */
  viewKeyMaxUses: number;

  /** ZK 证明默认有效期（毫秒） */
  zkProofDefaultValidity: number;

  /** 自动合规检查阈值（交易金额超过此值自动触发） */
  autoComplianceThreshold: number;

  /** 披露日志保留期（天） */
  disclosureLogRetentionDays: number;

  /** 透明性债务预警阈值 */
  debtWarningThreshold: number;

  /** 是否启用默认加密（true=所有新交易默认加密） */
  encryptByDefault: boolean;
}

export const DEFAULT_PPCL_CONFIG: PPCLSystemConfig = {
  defaultAlgorithm: EncryptionAlgorithm.AES_256_GCM,
  viewKeyMaxTTL: 30 * 24 * 60 * 60 * 1000,    // 30天
  viewKeyMaxUses: 100,
  zkProofDefaultValidity: 24 * 60 * 60 * 1000,  // 24小时
  autoComplianceThreshold: 10_000,                // $10,000+
  disclosureLogRetentionDays: 2555,               // 7年（金融监管标准）
  debtWarningThreshold: 0.6,
  encryptByDefault: true,
};

// ============================================================================
// PPCL 节点状态（扩展 OPLCNodeState）
// ============================================================================

export interface PPCLNodeState {
  /** 本地维护的加密记录总数 */
  totalEncryptedRecords: number;

  /** 已颁发的View Key总数 */
  totalViewKeysIssued: number;

  /** 活跃View Key数 */
  activeViewKeys: number;

  /** 已完成的合规检查数 */
  totalComplianceChecks: number;

  /** 当前透明性债务分数 */
  currentDebtScore: number;

  /** 披露日志条目数 */
  disclosureLogEntries: number;

  /** ZK 证明生成统计 */
  zkProofStats: {
    generated: number;
    verified: number;
    failed: number;
    avgGenerationMs: number;
    avgVerificationMs: number;
  };
}
