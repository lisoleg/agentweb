/**
 * 视图密钥管理器 (View Key Manager)
 *
 * PPCL第二层：选择性披露
 *
 * 核心机制：
 * - View Key = 授权边界内的最小化披露凭证
 * - 类比Aleo的view key + snarkOS v4增强
 * - 支持：时间窗口、使用次数限制、用途分类、撤销、审计日志
 *
 * 安全原则：
 * - 最小特权原则（PoLP）：每次授权只开放必要字段
 * - 不可伪造性：View Key由所有者签名生成
 * - 可追溯性：所有使用操作记入Disclosure Log
 * - 可撤销性：所有者可在任何时候撤销已颁发的View Key
 *
 * @version V16.0
 */

import crypto from 'crypto';
import {
  ViewKey,
  ViewKeyScope,
  ViewKeyPurpose,
  ViewKeyStatus,
  DisclosureLogEntry,
  AccessLevel,
  DEFAULT_PPCL_CONFIG,
  ZKProof,
  ZKProofType,
} from './types';

// ============================================================================
// View Key 生成与签名的内部工具
// ============================================================================

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * 生成X25519密钥对（用于View Key的非对称封装）
 */
function generateKeyPair(): KeyPair {
  // 简化实现：使用ED25519兼容的密钥对
  // 生产环境应使用硬件安全模块(HSM)或KMS
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

/**
 * 用接收者公钥封装对称密钥（ECIES-like）
 */
function wrapSymmetricKey(
  symmetricKey: Buffer,
  recipientPubKeyB64: string
): string {
  // 简化：直接用RSA-OAEP封装（生产环境应使用ECIES/X25519）
  // 这里用AES加密模拟封装效果
  const pubKeyBuf = Buffer.from(recipientPubKeyB64, 'base64');
  // 生成临时对称key来加密实际的symmetricKey
  const tempKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', tempKey, iv);
  const encrypted = Buffer.concat([cipher.update(symmetricKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 返回组合结果（base64编码）
  return Buffer.concat([tempKey, iv, encrypted, tag]).toString('base64');
}

// ============================================================================
// ZK 访问证明（简化版 — 生产环境应接入真正的ZK电路）
// ============================================================================

/**
 * 生成简化的ZK访问证明
 *
 * 语义：证明"持有有效View Key且在授权范围内进行访问"
 * 但不泄露具体访问了哪些内容
 */
function generateZKAccessProof(
  viewKeyId: string,
  accessor: string,
  purpose: ViewKeyPurpose,
  timestamp: Date
): ZKProof {
  // 构造证明数据（简化版：HMAC-based MAC证明）
  const statement = `${viewKeyId}:${accessor}:${purpose}:${timestamp.getTime()}`;
  const proofData = crypto.createHmac('sha256', `zk-proof-key-${viewKeyId}`)
    .update(statement)
    .digest('hex');

  return {
    proofId: `zk-ap-${crypto.randomBytes(8).toString('hex')}`,
    proofType: ZKProofType.THRESHOLD_ACCESS,
    proofData,
    publicInputs: {
      viewKeyId,
      accessor: crypto.createHash('sha256').update(accessor).digest('hex'),   // 哈希化
      purpose,
      timestamp: timestamp.toISOString(),
    },
    verificationKeyRef: 'zk-access-vk-v1.0',
    createdAt: timestamp,
    validUntil: new Date(timestamp.getTime() + 24 * 60 * 60 * 1000),
    verified: false,
  };
}

/**
 * 验证ZK访问证明
 */
function verifyZKAccessProof(proof: ZKProof): boolean {
  if (proof.validUntil < new Date()) return false;
  if (proof.verified) return true;  // 已经验证过

  // 重构预期statement并比较
  const statement = `${proof.publicInputs.viewKeyId}:${proof.publicInputs.accessor}:${proof.publicInputs.purpose}:${new Date(proof.publicInputs.timestamp).getTime()}`;
  const expectedProofData = crypto.createHmac('sha256', `zk-proof-key-${proof.publicInputs.viewKeyId}`)
    .update(statement)
    .digest('hex');

  return proof.proofData === expectedProofData;
}

// ============================================================================
// ViewKeyManager 主类
// ============================================================================

export class ViewKeyManager {
  private config: typeof DEFAULT_PPCL_CONFIG;
  /** 所有者的密钥对 */
  private ownerKeys: KeyPair;
  /** 已颁发的View Key存储 */
  private viewKeys: Map<string, ViewKey> = new Map();
  /** 披露日志 */
  private disclosureLogs: DisclosureLogEntry[] = [];
  /** 记录所有者到字段访问级别的映射 */
  private recordAccessMap: Map<string, Record<string, AccessLevel>> = new Map();

  constructor(config?: Partial<typeof DEFAULT_PPCL_CONFIG>) {
    this.config = { ...DEFAULT_PPCL_CONFIG, ...config };
    this.ownerKeys = generateKeyPair();
  }

  /**
   * 注册记录的访问级别配置
   */
  registerRecordAccessLevels(
    recordId: string,
    fieldLevels: Record<string, AccessLevel>
  ): void {
    this.recordAccessMap.set(recordId, fieldLevels);
  }

  /**
   * 颁发 View Key（核心方法）
   *
   * @param targetRecordId 目标记录ID（'*'=所有记录）
   * @param grantedTo 接收者身份标识
   * @param scope 权限范围
   * @returns 颁发的View Key
   */
  issueViewKey(
    targetRecordId: string,
    grantedTo: string,
    scope: Partial<ViewKeyScope>
  ): ViewKey {
    const keyId = `vk-${crypto.randomBytes(12).toString('hex')}`;
    const symmetricKey = crypto.randomBytes(32);  // 实际解密用的对称密钥

    // 构建完整的scope
    const fullScope: ViewKeyScope = {
      allowedFields: scope.allowedFields ?? [],
      validFrom: scope.validFrom ?? new Date(),
      validUntil: scope.validUntil ?? new Date(Date.now() + this.config.viewKeyMaxTTL),
      maxUses: scope.maxUses ?? this.config.viewKeyMaxUses,
      usedCount: 0,
      purpose: scope.purpose ?? ViewKeyPurpose.AUDIT,
      grantorSignature: crypto.createSign('SHA256')
        .update(`${keyId}|${targetRecordId}|${grantedTo}|${JSON.stringify(scope)}`)
        .sign(this.ownerKeys.privateKey, 'base64'),
    };

    // 封装对称密钥到View Key中
    const wrappedKey = wrapSymmetricKey(symmetricKey, grantedTo);  // 简化：用grantedTo字符串作为公钥代理

    const viewKey: ViewKey = {
      keyId,
      targetRecordId,
      grantedTo,
      grantedBy: 'owner-system',
      encryptedSymmetricKey: wrappedKey,
      scope: fullScope,
      status: ViewKeyStatus.ACTIVE,
      createdAt: new Date(),
    };

    this.viewKeys.set(keyId, viewKey);
    return viewKey;
  }

  /**
   * 使用 View Key 解密/访问记录
   *
   * 每次调用都会：
   * 1. 验证View Key有效性（状态/时间/次数）
   * 2. 执行访问操作
   * 3. 生成ZK访问证明
   * 4. 写入披露日志
   * 5. 更新使用计数
   *
   * @param keyId View Key ID
   * @param accessor 使用者身份
   * @param targetRecordId 目标记录
   * @param requestFields 请求的字段
   * @returns 访问结果+ZK证明
   */
  useViewKey(
    keyId: string,
    accessor: string,
    targetRecordId: string,
    requestFields: string[] = []
  ): {
    success: boolean;
    grantedFields: string[];
    zkProof: ZKProof;
    logEntry: DisclosureLogEntry;
    error?: string;
  } {
    const vk = this.viewKeys.get(keyId);
    if (!vk) {
      return {
        success: false,
        grantedFields: [],
        zkProof: {} as ZKProof,
        logEntry: {} as DisclosureLogEntry,
        error: 'View Key not found',
      };
    }

    // 1. 状态检查
    if (vk.status !== ViewKeyStatus.ACTIVE) {
      return {
        success: false,
        grantedFields: [],
        zkProof: {} as ZKProof,
        logEntry: {} as DisclosureLogEntry,
        error: `View Key status is ${vk.status}`,
      };
    }

    // 2. 时间窗口检查
    const now = new Date();
    if (now < vk.scope.validFrom || (vk.scope.validUntil && now > vk.scope.validUntil)) {
      vk.status = ViewKeyStatus.EXPIRED;
      return {
        success: false,
        grantedFields: [],
        zkProof: {} as ZKProof,
        logEntry: {} as DisclosureLogEntry,
        error: 'View Key expired or not yet valid',
      };
    }

    // 3. 目标匹配检查
    if (vk.targetRecordId !== '*' && vk.targetRecordId !== targetRecordId) {
      return {
        success: false,
        grantedFields: [],
        zkProof: {} as ZKProof,
        logEntry: {} as DisclosureLogEntry,
        error: 'View Key does not grant access to this record',
      };
    }

    // 4. 使用次数检查
    if (vk.scope.maxUses > 0 && vk.scope.usedCount >= vk.scope.maxUses) {
      vk.status = ViewKeyStatus.DEPLETED;
      return {
        success: false,
        grantedFields: [],
        zkProof: {} as ZKProof,
        logEntry: {} as DisclosureLogEntry,
        error: 'View Key usage limit exceeded',
      };
    }

    // 5. 确定可访问字段
    const recordLevels = this.recordAccessMap.get(targetRecordId);
    let grantedFields: string[];

    if (vk.scope.allowedFields.length > 0) {
      // 只授予scope中明确指定的字段
      grantedFields = vk.scope.allowedFields.filter(f => {
        const level = recordLevels?.[f];
        return level !== undefined && level <= AccessLevel.VIEW_KEY;
      });
    } else if (requestFields.length > 0) {
      // 请求特定字段
      grantedFields = requestFields.filter(f => {
        const level = recordLevels?.[f];
        return level !== undefined && level <= AccessLevel.VIEW_KEY;
      });
    } else {
      // 全部VIEW_KEY及以下级别的字段
      grantedFields = recordLevels
        ? Object.entries(recordLevels)
            .filter(([, level]) => level <= AccessLevel.VIEW_KEY)
            .map(([name]) => name)
        : [];
    }

    // 6. 生成ZK访问证明
    const zkProof = generateZKAccessProof(keyId, accessor, vk.scope.purpose, now);
    zkProof.verified = verifyZKAccessProof(zkProof);

    // 7. 写入披露日志
    const logEntry: DisclosureLogEntry = {
      logId: `dl-${crypto.randomBytes(8).toString('hex')}`,
      viewKeyId: keyId,
      accessedBy: accessor,
      targetRecordId,
      accessedFields: grantedFields,
      accessTime: now,
      purpose: vk.scope.purpose,
      zkAccessProof: zkProof,
    };
    this.disclosureLogs.push(logEntry);

    // 8. 更新使用计数
    vk.scope.usedCount++;

    return {
      success: true,
      grantedFields,
      zkProof,
      logEntry,
    };
  }

  /**
   * 撤销 View Key
   */
  revokeViewKey(
    keyId: string,
    reason: string
  ): { success: boolean; error?: string } {
    const vk = this.viewKeys.get(keyId);
    if (!vk) {
      return { success: false, error: 'View Key not found' };
    }

    if (vk.status !== ViewKeyStatus.ACTIVE) {
      return { success: false, error: `Cannot revoke a ${vk.status} key` };
    }

    vk.status = ViewKeyStatus.REVOKED;
    vk.revokedAt = new Date();
    vk.revokeReason = reason;

    return { success: true };
  }

  /**
   * 批量撤销某接收者的所有View Key
   */
  revokeAllForGrantee(granteeId: string, reason: string): number {
    let count = 0;
    for (const [, vk] of this.viewKeys) {
      if (vk.grantedTo === granteeId && vk.status === ViewKeyStatus.ACTIVE) {
        vk.status = ViewKeyStatus.REVOKED;
        vk.revokedAt = new Date();
        vk.revokeReason = reason;
        count++;
      }
    }
    return count;
  }

  /**
   * 查询 View Key 详情
   */
  getViewKey(keyId: string): ViewKey | undefined {
    return this.viewKeys.get(keyId);
  }

  /**
   * 列出某记录的所有活跃View Key
   */
  listActiveViewKeysForRecord(recordId: string): ViewKey[] {
    return Array.from(this.viewKeys.values()).filter(
      vk => vk.status === ViewKeyStatus.ACTIVE &&
        (vk.targetRecordId === recordId || vk.targetRecordId === '*')
    );
  }

  /**
   * 查询披露日志
   */
  queryDisclosureLogs(filters?: {
    viewKeyId?: string;
    accessor?: string;
    targetRecordId?: string;
    purpose?: ViewKeyPurpose;
    from?: Date;
    to?: Date;
    limit?: number;
  }): DisclosureLogEntry[] {
    let logs = [...this.disclosureLogs];

    if (filters?.viewKeyId) logs = logs.filter(l => l.viewKeyId === filters.viewKeyId);
    if (filters?.accessor) logs = logs.filter(l => l.accessedBy === filters.accessor);
    if (filters?.targetRecordId) logs = logs.filter(l => l.targetRecordId === filters.targetRecordId);
    if (filters?.purpose) logs = logs.filter(l => l.purpose === filters.purpose);
    if (filters?.from !== undefined) logs = logs.filter(l => l.accessTime >= filters.from!);
    if (filters?.to !== undefined) logs = logs.filter(l => l.accessTime <= filters.to!);

    // 按时间倒序
    logs.sort((a, b) => b.accessTime.getTime() - a.accessTime.getTime());

    return logs.slice(0, filters?.limit ?? 100);
  }

  /**
   * 清理过期的View Key
   */
  cleanupExpiredKeys(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [keyId, vk] of this.viewKeys) {
      if (
        vk.status === ViewKeyStatus.ACTIVE &&
        vk.scope.validUntil &&
        vk.scope.validUntil < now
      ) {
        vk.status = ViewKeyStatus.EXPIRED;
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 获取统计摘要
   */
  getStats(): {
    totalIssued: number;
    active: number;
    expired: number;
    revoked: number;
    depleted: number;
    totalDisclosures: number;
    disclosuresByPurpose: Record<string, number>;
  } {
    const keys = Array.from(this.viewKeys.values());
    const stats = {
      totalIssued: keys.length,
      active: 0,
      expired: 0,
      revoked: 0,
      depleted: 0,
      totalDisclosures: this.disclosureLogs.length,
      disclosuresByPurpose: {} as Record<string, number>,
    };

    for (const k of keys) {
      switch (k.status) {
        case ViewKeyStatus.ACTIVE: stats.active++; break;
        case ViewKeyStatus.EXPIRED: stats.expired++; break;
        case ViewKeyStatus.REVOKED: stats.revoked++; break;
        case ViewKeyStatus.DEPLETED: stats.depleted++; break;
      }
    }

    for (const dl of this.disclosureLogs) {
      stats.disclosuresByPurpose[dl.purpose] = (stats.disclosuresByPurpose[dl.purpose] || 0) + 1;
    }

    return stats;
  }
}
