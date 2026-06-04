/**
 * 加密记录模型引擎 (Encrypted Record Model Engine)
 *
 * PPCL第一层：默认保密
 *
 * 参考Aleo的record model架构：
 * - 状态从"账户余额(公开数字)"升级为"加密记录(Encrypted Record)"
 * - 支持字段级加密（不同字段可设置不同访问级别）
 * - Merkle Commitment用于后续ZK证明
 *
 * 技术选型：
 * - 对称加密: AES-256-GCM（性能优先）
 * - 非对称封装: X25519 + ChaCha20-Poly1305（密钥交换）
 * - 哈希: SHA-256（承诺值计算）
 *
 * @version V16.0
 */

import crypto from 'crypto';
import {
  EncryptedRecord,
  PlaintextRecordTemplate,
  AccessLevel,
  EncryptionAlgorithm,
  DEFAULT_PPCL_CONFIG,
} from './types';

// ============================================================================
// 加密工具函数
// ============================================================================

const ALGORITHM_MAP: Record<EncryptionAlgorithm, { algorithm: string; keyLength: number; ivLength: number; tagLength: number }> = {
  [EncryptionAlgorithm.AES_256_GCM]: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 12,   // GCM推荐96bit IV
    tagLength: 16,  // GCM认证标签
  },
  [EncryptionAlgorithm.X25519_CHACHA20]: {
    algorithm: 'chacha20-poly1305',
    keyLength: 32,
    ivLength: 12,
    tagLength: 16,
  },
  [EncryptionAlgorithm.SHA256_HMAC]: {
    algorithm: 'sha256',
    keyLength: 32,
    ivLength: 0,
    tagLength: 32,
  },
};

/**
 * 生成随机密钥
 */
function generateRandomKey(length: number): Buffer {
  return crypto.randomBytes(length);
}

/**
 * 生成随机IV/Nonce
 */
function generateRandomIV(algorithm: EncryptionAlgorithm): Buffer {
  const spec = ALGORITHM_MAP[algorithm];
  return crypto.randomBytes(spec.ivLength || 16);
}

/**
 * 派生密钥（HKDF-based）— 兼容旧版Node.js
 */
function deriveKey(
  seed: Buffer,
  context: string,
  length: number
): Buffer {
  // 使用HMAC-based HKDF替代（兼容Node.js 16+）
  const hash = crypto.createHash('sha256');
  hash.update(seed);
  hash.update(context);
  const prk = hash.digest();

  const okm = crypto.createHmac('sha256', prk);
  okm.update(Buffer.from([0x01])); // info block
  okm.update(Buffer.from(context));

  if (okm.digest().length >= length) {
    return okm.digest().subarray(0, length);
  }
  // 多轮扩展（简化版）
  return crypto.createHmac('sha256', prk)
    .update(context + '\x01')
    .digest()
    .subarray(0, length);
}

// ============================================================================
// 字段级加密器
// ============================================================================

interface FieldCipherText {
  fieldName: string;
  ciphertext: Buffer;
  nonce: Buffer;
  authTag?: Buffer;   // GCM认证标签
  accessLevel: AccessLevel;
}

/**
 * 将明文模板按字段访问级别分别加密
 */
function encryptFields(
  plaintext: PlaintextRecordTemplate,
  masterKey: Buffer,
  algorithm: EncryptionAlgorithm
): { concatenatedCiphertext: Buffer; fieldMeta: EncryptedRecord['fieldEncryptionMeta'] } {
  const spec = ALGORITHM_MAP[algorithm];
  const cipherTexts: FieldCipherText[] = [];
  let offset = 0;

  for (const [fieldName, rawValue] of Object.entries(plaintext.fields)) {
    // 为每个字段派生子密钥（字段名作为context）
    const fieldKey = deriveKey(masterKey, `field:${fieldName}`, spec.keyLength);

    // 序列化字段值为JSON字符串
    const fieldValue = JSON.stringify(rawValue);
    const valueBuffer = Buffer.from(fieldValue, 'utf-8');

    if (algorithm === EncryptionAlgorithm.SHA256_HMAC) {
      // HMAC模式：仅完整性保护，不做加密
      const hmac = crypto.createHmac(spec.algorithm, fieldKey);
      hmac.update(valueBuffer);
      const mac = hmac.digest();
      cipherTexts.push({
        fieldName,
        ciphertext: Buffer.concat([valueBuffer, mac]),
        nonce: Buffer.alloc(0),
        accessLevel: plaintext.fieldAccessLevels?.[fieldName] ?? AccessLevel.VIEW_KEY,
      });
      offset += valueBuffer.length + mac.length;
    } else {
      // AES-GCM 或 ChaCha20-Poly1305
      const nonce = generateRandomIV(algorithm);
      const cipher = crypto.createCipheriv(spec.algorithm, fieldKey, nonce);
      const encrypted = Buffer.concat([cipher.update(valueBuffer), cipher.final()]);
      const authTag = (cipher as unknown as { getAuthTag: () => Buffer }).getAuthTag();

      cipherTexts.push({
        fieldName,
        ciphertext: Buffer.concat([encrypted, authTag]),
        nonce,
        authTag,
        accessLevel: plaintext.fieldAccessLevels?.[fieldName] ?? AccessLevel.VIEW_KEY,
      });
      offset += encrypted.length + authTag.length;
    }
  }

  // 拼接所有字段密文为单一buffer
  const concatenatedCiphertext = Buffer.concat(
    cipherTexts.map(ct => ct.ciphertext)
  );

  // 构建字段元数据
  const fieldMeta = cipherTexts.map((ct, index) => ({
    fieldName: ct.fieldName,
    ciphertextOffset: index === 0 ? 0 : cipherTexts.slice(0, index).reduce((sum, c) => sum + c.ciphertext.length, 0),
    ciphertextLength: ct.ciphertext.length,
    accessLevel: ct.accessLevel,
  }));

  return { concatenatedCiphertext, fieldMeta };
}

/**
 * 解密指定字段
 */
function decryptField(
  concatenatedCiphertext: Buffer,
  fieldMeta: EncryptedRecord['fieldEncryptionMeta'][number],
  masterKey: Buffer,
  algorithm: EncryptionAlgorithm
): unknown {
  const spec = ALGORITHM_MAP[algorithm];
  const fieldKey = deriveKey(masterKey, `field:${fieldMeta.fieldName}`, spec.keyLength);

  const fieldData = concatenatedCiphertext.subarray(
    fieldMeta.ciphertextOffset,
    fieldMeta.ciphertextOffset + fieldMeta.ciphertextLength
  );

  if (algorithm === EncryptionAlgorithm.SHA256_HMAC) {
    const valuePart = fieldData.subarray(0, fieldData.length - 32);
    const macPart = fieldData.subarray(fieldData.length - 32);
    const expectedMac = crypto.createHmac(spec.algorithm, fieldKey).update(valuePart).digest();
    if (!crypto.timingSafeEqual(macPart, expectedMac)) {
      throw new Error(`Field "${fieldMeta.fieldName}" integrity check failed`);
    }
    return JSON.parse(valuePart.toString('utf-8'));
  }

  // 提取密文和认证标签
  const ctLength = fieldData.length - spec.tagLength;
  const ciphertext = fieldData.subarray(0, ctLength);
  const authTag = fieldData.subarray(ctLength);

  // 从fieldMeta重建nonce需要额外存储——简化版：nonce由fieldKey确定性地派生
  const nonce = deriveKey(masterKey, `nonce:${fieldMeta.fieldName}`, spec.ivLength);

    const decipher = crypto.createDecipheriv(spec.algorithm, fieldKey, nonce);
    (decipher as unknown as { setAuthTag: (t: Buffer) => void }).setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return JSON.parse(decrypted.toString('utf-8'));
}

// ============================================================================
// Merkle 承诺值计算
// ============================================================================

/**
 * 为加密记录计算Merkle承诺值
 * 此承诺值可用于后续ZK证明（证明知道明文但不暴露）
 */
function computeMerkleCommitment(record: {
  recordId: string;
  ciphertext: string;
  ownerPublicKeyHash: string;
  recordType: string;
}): string {
  const data = `${record.recordId}|${record.ciphertext.slice(0, 64)}|${record.ownerPublicKeyHash}|${record.recordType}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ============================================================================
// RecordModelEngine 主类
// ============================================================================

export class RecordModelEngine {
  private config: typeof DEFAULT_PPCL_CONFIG;
  /** 主密钥（运行时内存中，不持久化） */
  private masterKey: Buffer;
  /** 记录存储（模拟数据库） */
  private records: Map<string, EncryptedRecord> = new Map();
  /** 临时明文缓存（仅内存，用于即将解密的记录） */
  private plaintextCache: Map<string, PlaintextRecordTemplate> = new Map();

  constructor(config?: Partial<typeof DEFAULT_PPCL_CONFIG>) {
    this.config = { ...DEFAULT_PPCL_CONFIG, ...config };
    this.masterKey = generateRandomKey(32);
  }

  /**
   * 创建新的加密记录
   *
   * @param template 明文模板（含数据和字段访问级别）
   * @returns 加密记录（明文不被持久化）
   */
  createEncryptedRecord(template: PlaintextRecordTemplate): EncryptedRecord {
    const algorithm = this.config.defaultAlgorithm;

    // 1. 加密各字段
    const { concatenatedCiphertext, fieldMeta } = encryptFields(
      template,
      this.masterKey,
      algorithm
    );

    // 2. 生成nonce（用于整个记录）
    const nonce = generateRandomIV(algorithm);

    // 3. 构建加密记录
    const record: EncryptedRecord = {
      recordId: template.recordId,
      ciphertext: concatenatedCiphertext.toString('base64'),
      nonce: nonce.toString('base64'),
      algorithm,
      ownerPublicKeyHash: template.ownerPublicKeyHash,
      recordType: template.recordType,
      fieldAccessLevels: template.fieldAccessLevels ?? {},
      fieldEncryptionMeta: fieldMeta,
      createdAt: template.createdAt,
      merkleCommitment: computeMerkleCommitment({
        recordId: template.recordId,
        ciphertext: concatenatedCiphertext.toString('base64'),
        ownerPublicKeyHash: template.ownerPublicKeyHash,
        recordType: template.recordType,
      }),
    };

    // 4. 存储（仅存密文）
    this.records.set(record.recordId, record);

    // 5. 短暂缓存明文（用于立即解密测试，实际生产环境不应长期缓存）
    this.plaintextCache.set(record.recordId, template);

    return record;
  }

  /**
   * 解密记录（需要masterKey或有效View Key授权）
   *
   * @param recordId 记录ID
   * @param requestedFields 请求的字段列表（空数组=全部可用字段）
   * @param accessorIdentity 访问者身份（用于日志）
   * @returns 解密后的明文字段
   */
  decryptRecord(
    recordId: string,
    requestedFields: string[] = [],
    accessorIdentity: string = 'system'
  ): Record<string, unknown> {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }

    const ciphertext = Buffer.from(record.ciphertext, 'base64');
    const result: Record<string, unknown> = {};

    for (const meta of record.fieldEncryptionMeta) {
      // 如果指定了字段过滤，只解密请求的字段
      if (requestedFields.length > 0 && !requestedFields.includes(meta.fieldName)) {
        continue;
      }

      // 访问级别检查（系统级总是可以访问）
      if (meta.accessLevel !== AccessLevel.SYSTEM && accessorIdentity !== 'system') {
        // 在真实实现中，这里会检查View Key权限
        // 简化版：只允许PUBLIC和VIEW_KEY级别
        if (meta.accessLevel === AccessLevel.OWNER) {
          continue; // 跳过OWNER级别字段（需要特殊授权）
        }
      }

      try {
        result[meta.fieldName] = decryptField(ciphertext, meta, this.masterKey, record.algorithm);
      } catch (e) {
        result[meta.fieldName] = `[DECRYPT_ERROR: ${(e as Error).message}]`;
      }
    }

    return result;
  }

  /**
   * 获取记录的公共信息（无需解密即可获取的字段）
   */
  getPublicInfo(recordId: string): Pick<EncryptedRecord,
    'recordId' | 'recordType' | 'ownerPublicKeyHash' | 'createdAt' | 'merkleCommitment'
  > | null {
    const record = this.records.get(recordId);
    if (!record) return null;

    return {
      recordId: record.recordId,
      recordType: record.recordType,
      ownerPublicKeyHash: record.ownerPublicKeyHash,
      createdAt: record.createdAt,
      merkleCommitment: record.merkleCommitment,
    };
  }

  /**
   * 验证记录完整性（通过Merkle Commitment）
   */
  verifyRecordIntegrity(recordId: string): boolean {
    const record = this.records.get(recordId);
    if (!record) return false;

    const expectedCommitment = computeMerkleCommitment({
      recordId: record.recordId,
      ciphertext: record.ciphertext,
      ownerPublicKeyHash: record.ownerPublicKeyHash,
      recordType: record.recordType,
    });

    return record.merkleCommitment === expectedCommitment;
  }

  /**
   * 获取字段访问级别概览（不解密）
   */
  getFieldAccessOverview(recordId: string): Array<{
    fieldName: string;
    accessLevel: AccessLevel;
    isPubliclyAccessible: boolean;
  }> {
    const record = this.records.get(recordId);
    if (!record) return [];

    return record.fieldEncryptionMeta.map(meta => ({
      fieldName: meta.fieldName,
      accessLevel: meta.accessLevel,
      isPubliclyAccessible: meta.accessLevel === AccessLevel.PUBLIC,
    }));
  }

  /**
   * 获取记录统计
   */
  getStats(): {
    totalRecords: number;
    recordsByType: Record<string, number>;
    recordsByAlgorithm: Record<string, number>;
    averageFieldCount: number;
  } {
    const records = Array.from(this.records.values());
    const recordsByType: Record<string, number> = {};
    const recordsByAlgorithm: Record<string, number> = {};
    let totalFields = 0;

    for (const r of records) {
      recordsByType[r.recordType] = (recordsByType[r.recordType] || 0) + 1;
      recordsByAlgorithm[r.algorithm] = (recordsByAlgorithm[r.algorithm] || 0) + 1;
      totalFields += r.fieldEncryptionMeta.length;
    }

    return {
      totalRecords: records.length,
      recordsByType,
      recordsByAlgorithm,
      averageFieldCount: records.length > 0 ? totalFields / records.length : 0,
    };
  }

  /**
   * 清理过期记录
   */
  cleanupExpiredRecords(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, record] of this.records) {
      if (record.expiresAt && record.expiresAt < now) {
        this.records.delete(id);
        this.plaintextCache.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}
