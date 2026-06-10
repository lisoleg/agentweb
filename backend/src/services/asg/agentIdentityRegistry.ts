/**
 * L1: Agent 身份注册表 (Agent Identity Registry)
 *
 * 基于Ledger AI安全路线图四要素：
 * Agent Identity + Skills + Policies + Proof of Human
 *
 * 核心能力：
 * - DID-based Agent身份注册与验证
 * - 能力声明(Skill Declaration)管理
 * - 策略绑定(Policy Binding)
 * - 人类存在证明(PoH)验证
 *
 * @version V17.0
 */

import crypto from 'crypto';
import {
  AgentIdentity,
  AgentStatus,
  AgentSkillDeclaration,
  AgentPolicy,
  ProofOfHuman,
  HITLTriggerCondition,
  AgentMode,
} from './types';

// ============================================================================
// 内存存储（生产环境替换为数据库/链上状态）
// ============================================================================

const agentRegistry = new Map<string, AgentIdentity>();
const policyStore = new Map<string, AgentPolicy>();

// ============================================================================
// 工具函数
// ============================================================================

function generateDid(): string {
  const bytes = crypto.randomBytes(16);
  return `did:agent:${bytes.toString('hex')}`;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function generatePublicKeyPair(): { publicKey: string; privateKeyHash: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubKeyBuf = publicKey.export({ type: 'spki', format: 'der' });
  // 不存储私钥，仅存储其哈希用于验证签名时比对
  const privKeyHash = crypto
    .createHash('sha256')
    .update(privateKey.export({ type: 'pkcs8', format: 'der' }))
    .digest('hex');

  return {
    publicKey: pubKeyBuf.toString('base64'),
    privateKeyHash: privKeyHash,
  };
}

// ============================================================================
// AgentIdentityRegistry 类
// ============================================================================

export class AgentIdentityRegistry {
  private stats = {
    totalRegistered: 0,
    totalSuspended: 0,
    totalRevoked: 0,
    totalPohVerified: 0,
  };

  /**
   * 注册新Agent
   */
  registerAgent(params: {
    ownerDid: string;
    displayName: string;
    agentType: AgentIdentity['agentType'];
    skills: Omit<AgentSkillDeclaration, 'skillId'>[];
    initialPolicy: Omit<AgentPolicy, 'policyId' | 'agentId' | 'createdAt' | 'updatedAt' | 'version' | 'ownerSignature'>;
    pohMethod: ProofOfHuman['method'];
  }): AgentIdentity {
    const did = generateDid();
    const { publicKey } = generatePublicKeyPair();

    // 构建技能声明列表
    const skills: AgentSkillDeclaration[] = params.skills.map((s) => ({
      ...s,
      skillId: generateId('skill'),
    }));

    // 构建默认策略
    const policy: AgentPolicy = {
      ...params.initialPolicy,
      policyId: generateId('policy'),
      agentId: did,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      ownerSignature: this.signPolicy(did, params.initialPolicy),
    };

    // 构建PoH
    const poh: ProofOfHuman = {
      pohId: generateId('poh'),
      method: params.pohMethod,
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1年有效
      providerSignature: `sig_${generateId('poh')}`,
      valid: true,
    };

    const agent: AgentIdentity = {
      did,
      displayName: params.displayName,
      agentType: params.agentType,
      ownerDid: params.ownerDid,
      publicKey,
      skills,
      currentPolicy: policy,
      trustScore: 0.5, // 初始信任分数
      proofOfHuman: poh,
      registeredAt: new Date(),
      lastActiveAt: new Date(),
      totalOperations: 0,
      successfulOperations: 0,
      status: AgentStatus.ACTIVE,
    };

    agentRegistry.set(did, agent);
    policyStore.set(policy.policyId, policy);
    this.stats.totalRegistered++;
    this.stats.totalPohVerified++;

    return agent;
  }

  /**
   * 获取Agent身份
   */
  getAgent(did: string): AgentIdentity | undefined {
    return agentRegistry.get(did);
  }

  /**
   * 列出Owner名下所有Agent
   */
  listAgentsByOwner(ownerDid: string): AgentIdentity[] {
    return Array.from(agentRegistry.values()).filter(
      (a) => a.ownerDid === ownerDid && a.status !== AgentStatus.REVOKED
    );
  }

  /**
   * 更新Agent策略
   */
  updatePolicy(
    agentDid: string,
    policyUpdates: Partial<Omit<AgentPolicy, 'policyId' | 'agentId' | 'createdAt'>>,
  ): AgentPolicy | null {
    const agent = agentRegistry.get(agentDid);
    if (!agent || agent.status === AgentStatus.REVOKED) return null;

    const existing = agent.currentPolicy;
    const updated: AgentPolicy = {
      ...existing,
      ...policyUpdates,
      version: existing.version + 1,
      updatedAt: new Date(),
      ownerSignature: this.signPolicy(agentDid, { ...existing, ...policyUpdates }),
    };

    agent.currentPolicy = updated;
    policyStore.set(updated.policyId, updated);

    return updated;
  }

  /**
   * 添加HITL触发条件
   */
  addHitlTrigger(agentDid: string, condition: Omit<HITLTriggerCondition, 'triggerId'>): boolean {
    const agent = agentRegistry.get(agentDid);
    if (!agent) return false;

    agent.currentPolicy.hitlTriggers.push({
      ...condition,
      triggerId: generateId('hitl_trigger'),
    });
    agent.currentPolicy.updatedAt = new Date();
    agent.currentPolicy.version += 1;

    return true;
  }

  /**
   * 切换运行模式 (Guard ↔ Beast)
   */
  switchMode(agentDid: string, mode: AgentMode): boolean {
    const agent = agentRegistry.get(agentDid);
    if (!agent) return false;

    agent.currentPolicy.mode = mode;
    agent.currentPolicy.updatedAt = new Date();
    agent.currentPolicy.version += 1;

    return true;
  }

  /**
   * 验证PoH是否有效
   */
  verifyPoh(agentDid: string): boolean {
    const agent = agentRegistry.get(agentDid);
    if (!agent?.proofOfHuman) return false;

    const poh = agent.proofOfHuman;
    const now = new Date();

    return poh.valid && poh.expiresAt > now;
  }

  /**
   * 冻结/解冻Agent（紧急操作）
   */
  setFrozenStatus(agentDid: string, frozen: boolean): boolean {
    const agent = agentRegistry.get(agentDid);
    if (!agent) return false;

    agent.status = frozen ? AgentStatus.FROZEN : AgentStatus.ACTIVE;
    return true;
  }

  /**
   * 更新信任分数
   */
  updateTrustScore(agentDid: string, delta: number): number {
    const agent = agentRegistry.get(agentDid);
    if (!agent) return 0;

    agent.trustScore = Math.max(0, Math.min(1, agent.trustScore + delta));
    return agent.trustScore;
  }

  /**
   * 记录操作结果（更新统计数据）
   */
  recordOperation(agentDid: string, success: boolean): void {
    const agent = agentRegistry.get(agentDid);
    if (!agent) return;

    agent.totalOperations++;
    if (success) agent.successfulOperations++;
    agent.lastActiveAt = new Date();

    // 动态调整信任分数
    if (success) {
      agent.trustScore = Math.min(1, agent.trustScore + 0.001);
    } else {
      agent.trustScore = Math.max(0, agent.trustScore - 0.005);
    }
  }

  /**
   * 获取所有注册的Agent
   */
  listAllAgents(options?: { status?: AgentStatus; limit?: number }): AgentIdentity[] {
    let agents = Array.from(agentRegistry.values());

    if (options?.status) {
      agents = agents.filter((a) => a.status === options.status);
    }

    if (options?.limit) {
      agents = agents.slice(0, options.limit);
    }

    return agents;
  }

  /** 获取统计信息 */
  getStats() {
    const activeCount = Array.from(agentRegistry.values()).filter(
      (a) => a.status === AgentStatus.ACTIVE
    ).length;

    return {
      ...this.stats,
      activeAgents: activeCount,
      totalAgents: agentRegistry.size,
    };
  }

  // ========================================================================
  // 内部工具方法
  // ========================================================================

  private signPolicy(agentDid: string, policy: Record<string, unknown>): string {
    // 模拟签名：对策略内容哈希后附加agent标识
    const content = JSON.stringify({
      agentDid,
      ...policy,
      timestamp: Date.now(),
    });

    return `sig_v1_${crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)}`;
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let instance: AgentIdentityRegistry | null = null;

export function getInstance(): AgentIdentityRegistry {
  if (!instance) {
    instance = new AgentIdentityRegistry();
  }
  return instance;
}
