/**
 * ASG (Agent Security Gateway) — V17.0
 * 模块导出索引
 *
 * @version V17.0
 * 基于MetaMask Agent Wallet四道安全防线
 * L1: AgentIdentityRegistry  — DID身份+能力声明+策略绑定+PoH验证
 * L2: PolicySandboxEngine   — Guard/Beast双模式+规则沙箱+策略评估
 * L3: TransactionGatePipeline — 模拟/威胁扫描/MEV防护三重门控
 * L4: HumanInLoopService     — HITL人机回环+2FA+带外认证
 * L5: TeeKeyManager          — TEE密钥隔离+派生+助记词导出
 * L6: EconomicSafetyPool     — Stake/Slashing/赔付池
 */

export { AgentIdentityRegistry, getInstance as getAgentRegistry } from './agentIdentityRegistry';
export { PolicySandboxEngine, getInstance as getPolicyEngine } from './policySandboxEngine';
export { TransactionGatePipeline, getInstance as getGatePipeline } from './transactionGatePipeline';
export { HumanInLoopService, getInstance as getHitlService } from './humanInLoopService';
export { TeeKeyManager, getInstance as getTeeKeyMgr } from './teeKeyManager';
export { EconomicSafetyPool, getInstance as getEcoPool } from './economicSafetyPool';
export { ASGCoreService, getInstance as getAsgCore } from './asgCoreService';

// 类型导出
export type {
  AgentIdentity,
  AgentSkillDeclaration,
  AgentPolicy,
  ProofOfHuman,
  HITLTriggerCondition,
  GateResult,
  SimulationResult,
  ThreatScanResult,
  MEVProtectionResult,
  FullGatePipelineResult,
  HITLRequest,
  TeeKeyEntry,
  MnemonicExportRequest,
  StakeEntry,
  SlashingEvent,
  ClaimRequest,
  EconomicSafetyPoolStats,
  AgentOperationRequest,
  AgentOperationResponse,
  ASGSystemState,
} from './types';

export {
  AgentMode,
  AgentStatus,
  GateStage,
  HITLStatus,
  NotificationChannel,
  TeeKeyStatus,
} from './types';
