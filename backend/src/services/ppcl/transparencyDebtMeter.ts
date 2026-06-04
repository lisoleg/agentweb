/**
 * 透明性债务计量器 (Transparency Debt Meter)
 *
 * 基于Φ度量体系的四类透明性债务量化引擎
 *
 * 文章《稳定币需要隐身》核心洞察的工程化实现：
 * 当链上稳定币承载真实商业场景后，
 * "链上默认透明"从特性变为负债（Transparency Debt）。
 *
 * 四类成本 → Φ-量化映射：
 * 1. 商业博弈成本 → 信息熵 × 拓扑阻抗（信息泄露可被利用的程度）
 * 2. 合规与数据治理成本 → 相位耦合倒数（双轨合规的低效）
 * 3. 安全与人身风险成本 → 关系作用量 S 的异常波动
 * 4. 产品与制度设计成本 → 边界清晰度反比于系统熵
 *
 * @version V16.0
 */

import {
  PhiMetric,
  TransparencyDebtMetrics,
  MitigationStrategy,
} from './types';

// ============================================================================
// 四类成本的量化规则
// ============================================================================

interface DebtQuantificationRules {
  commercialGame: {
    /** 可推断供应商网络的权重 */
    supplierNetworkWeight: number;
    /** 可推断现金流模式的权重 */
    cashFlowWeight: number;
    /** 可推断定价策略的权重 */
    pricingWeight: number;
  };
  complianceGovernance: {
    /** 每KB暴露数据的成本系数 */
    perKBExposureCost: number;
    /** 旅行规则缺口的惩罚系数 */
    travelRuleGapPenalty: number;
  };
  securityRisk: {
    /** 资产暴露的风险系数 */
    exposureRiskFactor: number;
    /** 攻击面积的放大系数 */
    attackSurfaceMultiplier: number;
  };
  design: {
    /** 边界模糊度的权重 */
    boundaryAmbiguityWeight: number;
    /** 撤销就绪度的反向权重 */
    revocationReadinessWeight: number;
  };
}

const DEFAULT_RULES: DebtQuantificationRules = {
  commercialGame: {
    supplierNetworkWeight: 0.35,
    cashFlowWeight: 0.35,
    pricingWeight: 0.30,
  },
  complianceGovernance: {
    perKBExposureCost: 0.01,
    travelRuleGapPenalty: 0.25,
  },
  securityRisk: {
    exposureRiskFactor: 1.5,
    attackSurfaceMultiplier: 2.0,
  },
  design: {
    boundaryAmbiguityWeight: 0.4,
    revocationReadinessWeight: 0.6,
  },
};

// ============================================================================
// 分析输入数据结构
// ============================================================================

export interface TransparencyAnalysisInput {
  /** 基础Φ度量（来自OPLC PosetEngine） */
  phiMetric: PhiMetric;

  /** 链上数据分析 */
  chainData: {
    /** 平均每次交易的公开字段数 */
    avgPublicFieldsPerTx: number;
    /** 总链上暴露数据量（KB） */
    totalExposedDataKB: number;
    /** 可观察的交易图连通性（0~1） */
    transactionGraphConnectivity: number;
    /** 地址复用率（越高越容易关联身份） */
    addressReuseRate: number;
    /** 余额变化可观察性（0=完全隐藏, 1=完全公开） */
    balanceObservability: number;
    /** 交易对手可识别性（0=匿名, 1=完全识别） */
    counterpartyIdentifiability: number;
    /** 时间模式可分析性（0=随机化, 1=规律性明显） */
    temporalPatternAnalyzability: number;
  };

  /** 合规状态 */
  complianceStatus: {
    kycImplemented: boolean;
    amlMonitoringActive: boolean;
    travelRuleSupported: boolean;
    suspiciousActivityReporting: boolean;
    sanctionScreeningEnabled: boolean;
  };

  /** 安全态势 */
  securityPosture: {
    estimatedAssetValue: number;       // 估算资产规模（任意单位）
    exposedAttackVectors: number;       // 已知攻击向量数
    personalDataExposure: 'NONE' | 'PARTIAL' | 'FULL';
    physicalThreatLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };

  /** 治理成熟度 */
  governanceMaturity: {
    disclosurePolicyExists: boolean;
    revocationMechanismReady: boolean;
    auditTrailComplete: boolean;
    roleBasedAccessControl: boolean;
    disputeResolutionDefined: boolean;
  };
}

// ============================================================================
// 计算引擎
// ============================================================================

export class TransparencyDebtMeter {
  private rules: DebtQuantificationRules;

  constructor(rules?: Partial<DebtQuantificationRules>) {
    this.rules = { ...DEFAULT_RULES, ...rules };
  }

  /**
   * 执行完整的透明性债务分析
   *
   * @param input 分析输入数据
   * @returns 完整的透明性债务度量报告
   */
  analyze(input: TransparencyAnalysisInput): TransparencyDebtMetrics {
    // ===== 继承基础Φ度量 =====
    const basePhi: PhiMetric = input.phiMetric;

    // ===== 1. 商业博弈成本量化 =====
    const commercialGame = this.computeCommercialGameCost(input);

    // ===== 2. 合规与数据治理成本量化 =====
    const complianceGovernance = this.computeComplianceGovernanceCost(input);

    // ===== 3. 安全与人身风险成本量化 =====
    const securityRisk = this.computeSecurityRiskCost(input);

    // ===== 4. 产品与制度设计成本量化 =====
    const design = this.computeDesignCost(input);

    // ===== 综合指标 =====
    const totalTransparencyDebt = this.aggregateTotalDebt(
      commercialGame,
      complianceGovernance,
      securityRisk,
      design
    );

    const privacyImprovementPotential = this.estimateImprovementPotential(
      commercialGame,
      complianceGovernance,
      securityRisk,
      design
    );

    const recommendedMitigations = this.generateMitigations(
      commercialGame,
      complianceGovernance,
      securityRisk,
      design
    );

    return {
      ...basePhi,
      commercialGameCost: commercialGame,
      complianceGovernanceCost: complianceGovernance,
      securityRiskCost: securityRisk,
      designCost: design,
      totalTransparencyDebt,
      privacyImprovementPotential,
      recommendedMitigations,
    };
  }

  // --------------------------------------------------------------------------
  // 四类成本的独立计算方法
  // --------------------------------------------------------------------------

  /**
   * 商业博弈成本 = 加权信息泄露可利用度
   *
   * 核心逻辑：链上行为能多大程度上还原企业运营情报？
   * - 供应商网络 → 通过交易对手关系推断
   * - 现金流模式 → 通过金额+时间戳序列推断
   * - 定价策略 → 通过重复交易的价格变化推断
   */
  private computeCommercialGameCost(input: TransparencyAnalysisInput): TransparencyDebtMetrics['commercialGameCost'] {
    const cd = input.chainData;
    const rules = this.rules.commercialGame;

    // 信息泄露度综合评分
    const intelLeakage =
      cd.counterpartyIdentifiability * rules.supplierNetworkWeight +
      (cd.balanceObservability * cd.temporalPatternAnalyzability) * rules.cashFlowWeight +
      (cd.transactionGraphConnectivity * (1 - cd.addressReuseRate)) * rules.pricingWeight;

    return {
      score: Math.min(1, Math.max(0, intelLeakage)),
      exposedSupplierNetwork: cd.counterpartyIdentifiability > 0.6,
      exposedCashFlowPattern: cd.balanceObservability > 0.5 && cd.temporalPatternAnalyzability > 0.5,
      exposedPricingStrategy: cd.transactionGraphConnectivity > 0.7 && cd.avgPublicFieldsPerTx >= 5,
      estimatedIntelLeakage: intelLeakage,
    };
  }

  /**
   * 合规与数据治理成本 = 链上暴露带来的双重负担
   *
   * 核心矛盾：
   * - 链上默认暴露 ≠ 合规所需的信息格式
   * - 企业既需管理链上过度透明，又需补充链下材料
   */
  private computeComplianceGovernanceCost(input: TransparencyAnalysisInput): TransparencyDebtMetrics['complianceGovernanceCost'] {
    const cd = input.chainData;
    const cs = input.complianceStatus;
    const rules = this.rules.complianceGovernance;

    // 数据暴露量得分
    const dataVolumeScore = Math.min(1, cd.totalExposedDataKB / 1000);  // 归一化到GB级

    // 合规缺口计数
    let gapCount = 0;
    if (!cs.kycImplemented) gapCount++;
    if (!cs.amlMonitoringActive) gapCount++;
    if (!cs.travelRuleSupported) gapCount++;
    if (!cs.suspiciousActivityReporting) gapCount++;
    if (!cs.sanctionScreeningEnabled) gapCount++;

    const complianceGapScore = gapCount / 5;

    // 旅行规则特殊处理
    const travelRuleGap = !cs.travelRuleSupported;

    // 综合得分
    const score = dataVolumeScore * 0.4 + complianceGapScore * 0.4 + (travelRuleGap ? rules.travelRuleGapPenalty : 0);

    // 数据泄露风险等级
    let dataLeakRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (score < 0.25) dataLeakRiskLevel = 'LOW';
    else if (score < 0.5) dataLeakRiskLevel = 'MEDIUM';
    else if (score < 0.75) dataLeakRiskLevel = 'HIGH';
    else dataLeakRiskLevel = 'CRITICAL';

    return {
      score: Math.min(1, score),
      onChainDataVolume: cd.totalExposedDataKB,
      requiredOffChainMaterials: gapCount * 2,  // 每个缺口约2种材料
      dataLeakRiskLevel,
      travelRuleGap,
    };
  }

  /**
   * 安全与人身风险成本 = 资产路径公开化的攻击面
   *
   * 核心问题：资产规模+路径公开 = 勒索/攻击目标锁定
   */
  private computeSecurityRiskCost(input: TransparencyAnalysisInput): TransparencyDebtMetrics['securityRiskCost'] {
    const sp = input.securityPosture;
    const cd = input.chainData;
    const rules = this.rules.securityRisk;

    // 资产暴露水平（归一化）
    const normalizedAssetValue = Math.min(1, sp.estimatedAssetValue / 1_000_000);

    // 攻击面积 = 暴露向量 × 连通性放大
    const attackSurfaceArea =
      sp.exposedAttackVectors *
      (1 + cd.transactionGraphConnectivity * rules.attackSurfaceMultiplier);

    // 综合安全分数
    const score =
      normalizedAssetValue * rules.exposureRiskFactor * 0.4 +
      Math.min(1, attackSurfaceArea / 20) * 0.3 +
      (sp.personalDataExposure === 'FULL' ? 0.2 : sp.personalDataExposure === 'PARTIAL' ? 0.1 : 0) +
      (sp.physicalThreatLevel === 'HIGH' ? 0.1 : sp.physicalThreatLevel === 'MEDIUM' ? 0.05 : 0);

    let personalSafetyRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    if (sp.personalDataExposure === 'FULL' || sp.physicalThreatLevel === 'HIGH') {
      personalSafetyRisk = 'HIGH';
    } else if (sp.personalDataExposure === 'PARTIAL' || sp.physicalThreatLevel === 'MEDIUM') {
      personalSafetyRisk = 'MEDIUM';
    } else {
      personalSafetyRisk = 'LOW';
    }

    return {
      score: Math.min(1, score),
      assetExposureLevel: normalizedAssetValue,
      attackSurfaceArea,
      personalSafetyRisk,
      extortionVectorCount: sp.exposedAttackVectors +
        (cd.counterpartyIdentifiability > 0.7 ? 2 : 0) +
        (cd.balanceObservability > 0.7 ? 1 : 0),
    };
  }

  /**
   * 产品与制度设计成本 = 边界模糊度
   *
   * 核心问题：谁能在什么条件下看到什么？边界不清 = 设计债
   */
  private computeDesignCost(input: TransparencyAnalysisInput): TransparencyDebtMetrics['designCost'] {
    const gm = input.governanceMaturity;
    const rules = this.rules.design;

    // 边界清晰度（各项治理机制的存在性评分）
    let clarityScore = 0;
    if (gm.disclosurePolicyExists) clarityScore += 0.25;
    if (gm.roleBasedAccessControl) clarityScore += 0.25;
    if (gm.auditTrailComplete) clarityScore += 0.25;
    if (gm.disputeResolutionDefined) clarityScore += 0.25;
    const boundaryClarity = clarityScore;  // 已经是0~1

    // 撤销就绪度
    const revocationReadiness = gm.revocationMechanismReady ? 1.0 : 0.0;

    // 治理模糊度（边界清晰度的反比）
    const governanceAmbiguity = 1 - boundaryClarity;

    const score =
      governanceAmbiguity * rules.boundaryAmbiguityWeight +
      (1 - revocationReadiness) * rules.revocationReadinessWeight;

    return {
      score: Math.min(1, score),
      boundaryClarity,
      disclosureMechanismGap: !gm.disclosurePolicyExists,
      governanceAmbiguity,
      revocationReadiness: revocationReadiness,
    };
  }

  // --------------------------------------------------------------------------
  // 综合分析与建议
  // --------------------------------------------------------------------------

  /**
   * 加权聚合总债务分数
   */
  private aggregateTotalDebt(
    commercial: { score: number },
    compliance: { score: number },
    security: { score: number },
    design: { score: number },
  ): number {
    // 加权平均：安全最高权（人身安全），其次商业机密
    return (
      commercial.score * 0.2 +
      compliance.score * 0.25 +
      security.score * 0.35 +
      design.score * 0.2
    );
  }

  /**
   * 估算应用PPCL后的改善潜力
   */
  private estimateImprovementPotential(
    commercial: { score: number; estimatedIntelLeakage: number },
    compliance: { score: number },
    security: { score: number },
    design: { score: number },
  ): number {
    // 各维度在PPCL应用后的理论降低幅度
    const commercialReduction = commercial.estimatedIntelLeakage * 0.85;  // 加密可降85%
    const complianceReduction = compliance.score * 0.6;               // ZK合规可降60%
    const securityReduction = security.score * 0.7;                  // View Key可降70%
    const designReduction = design.score * 0.5;                     // 分级披露可降50%

    return (
      (commercialReduction + complianceReduction + securityReduction + designReduction) / 4
    );
  }

  /**
   * 生成缓解策略建议
   */
  private generateMitigations(
    commercial: TransparencyDebtMetrics['commercialGameCost'],
    compliance: TransparencyDebtMetrics['complianceGovernanceCost'],
    security: TransparencyDebtMetrics['securityRiskCost'],
    design: TransparencyDebtMetrics['designCost'],
  ): MitigationStrategy[] {
    const mitigations: MitigationStrategy[] = [];

    // 商业博弈缓解
    if (commercial.score > 0.4) {
      mitigations.push({
        strategy: '启用加密记录模型(EncryptedRecord)，隐藏交易对手、金额等敏感字段',
        targetDebtComponent: 'commercialGameCost',
        estimatedReduction: 0.85,
        implementationEffort: 'MEDIUM',
        ppclFeatureUsed: 'RecordModelEngine (L1)',
      });
    }

    // 合规缓解
    if (compliance.score > 0.3) {
      mitigations.push({
        strategy: '部署ZK合规引擎，实现零知识AML/KYC/制裁筛查',
        targetDebtComponent: 'complianceGovernanceCost',
        estimatedReduction: 0.6,
        implementationEffort: 'HIGH',
        ppclFeatureUsed: 'ZKComplianceEngine (L3)',
      });
    }
    if (compliance.travelRuleGap) {
      mitigations.push({
        strategy: '集成旅行规则ZK证明模块，满足FATF信息传递要求',
        targetDebtComponent: 'complianceGovernanceCost',
        estimatedReduction: 0.8,
        implementationEffort: 'MEDIUM',
        ppclFeatureUsed: 'ZKComplianceEngine.travelRuleProof',
      });
    }

    // 安全缓解
    if (security.score > 0.4) {
      mitigations.push({
        strategy: '部署View Key选择性披露机制，限制余额/资产的可见范围',
        targetDebtComponent: 'securityRiskCost',
        estimatedReduction: 0.7,
        implementationEffort: 'MEDIUM',
        ppclFeatureUsed: 'ViewKeyManager (L2)',
      });
    }

    // 设计缓解
    if (design.score > 0.3) {
      mitigations.push({
        strategy: '建立分级披露策略(RBAC+用途分类+时间窗口)',
        targetDebtComponent: 'designCost',
        estimatedReduction: 0.5,
        implementationEffort: 'LOW',
        ppclFeatureUsed: 'ViewKeyManager.scopePolicy',
      });
    }

    // 按estimatedReduction排序
    mitigations.sort((a, b) => b.estimatedReduction - a.estimatedReduction);

    return mitigations;
  }

  /**
   * 快速评估（仅基于Φ指标的简化版本）
   */
  quickAssess(phi: PhiMetric): {
    debtLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    primaryConcern: string;
    recommendedAction: string;
  } {
    const roughDebt = phi.topologicalImpedance * 0.3 + phi.entropy * 0.4 + (1 - phi.phaseCoupling) * 0.3;

    let debtLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    let primaryConcern: string;
    let recommendedAction: string;

    if (roughDebt < 0.25) {
      debtLevel = 'LOW';
      primaryConcern = '系统隐私状况良好';
      recommendedAction = '持续监控即可';
    } else if (roughDebt < 0.5) {
      debtLevel = 'MEDIUM';
      primaryConcern = '存在中度透明性债务，主要来自拓扑阻抗';
      recommendedAction = '建议部署加密记录模型';
    } else if (roughDebt < 0.75) {
      debtLevel = 'HIGH';
      primaryConcern = '高透明性债务，信息熵偏高且相位耦合不足';
      recommendedAction = '强烈建议部署PPCL全套三层架构';
    } else {
      debtLevel = 'CRITICAL';
      primaryConcern = '严重透明性债务，系统面临显著的隐私和安全风险';
      recommendedAction = '必须立即部署PPCL + 启用默认加密';
    }

    return { debtLevel, primaryConcern, recommendedAction };
  }
}
