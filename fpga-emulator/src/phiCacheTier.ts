/**
 * Phi Cache Tier - Φ-CacheTier三层存储分级
 *
 * V7.0 超节点语义对齐版: P0-2
 * 来源: 华为A5超节点UB-SSD KV Cache架构
 *   "Agent时代KV Cache生命周期仅1-2小时，过期数据无复用价值，
 *    牺牲超长留存时间，大幅提升SSD擦写寿命。"
 *
 * 核心创新:
 * - 三层分级: 热层(SRAM) / 温层(SSD) / 冷层(全息边界)
 * - Φ值驱动分层: Φ≥0.75→热层, 0.4≤Φ<0.75→温层, Φ<0.4→冷层
 * - 短寿命优化: 温层数据1-2小时TTL，过期自动降级至冷层
 * - Agent时代适配: 调用频次50-100倍提升，序列4K→1M
 */

// =============== Types ===============

export type CacheTier = 'HOT' | 'WARM' | 'COLD';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  tier: CacheTier;
  phiScore: number;
  createdAt: number;
  lastAccessedAt: number;
  ttlMs: number;           // 生存时间
  accessCount: number;
  sizeBytes: number;
  metadata?: Record<string, any>;
}

export interface CacheTierStats {
  tier: CacheTier;
  entryCount: number;
  totalSizeBytes: number;
  hitRate: number;
  avgPhiScore: number;
  avgAccessCount: number;
  evictionCount: number;
}

export interface PhiCacheConfig {
  /** 热层最大容量 (bytes, 默认 100MB) */
  hotMaxBytes: number;
  /** 温层最大容量 (bytes, 默认 1GB) */
  warmMaxBytes: number;
  /** 冷层最大容量 (bytes, 默认 10GB) */
  coldMaxBytes: number;
  /** 温层默认TTL (ms, 默认2小时) */
  warmDefaultTtlMs: number;
  /** 冷层默认TTL (ms, 默认24小时) */
  coldDefaultTtlMs: number;
  /** 热层Φ阈值 (默认0.75) */
  hotPhiThreshold: number;
  /** 温层Φ阈值 (默认0.4) */
  warmPhiThreshold: number;
  /** 分层检查间隔 (ms, 默认60秒) */
  rebalanceIntervalMs: number;
  /** LRU淘汰比例 (默认0.1 = 10%) */
  evictionRatio: number;
}

export interface TierTransition {
  key: string;
  fromTier: CacheTier;
  toTier: CacheTier;
  reason: 'PHI_UPGRADE' | 'PHI_DOWNGRADE' | 'TTL_EXPIRED' | 'LRU_EVICTION';
  phiScore: number;
  timestamp: number;
}

// =============== Constants ===============

const DEFAULT_CACHE_CONFIG: PhiCacheConfig = {
  hotMaxBytes: 100 * 1024 * 1024,        // 100MB
  warmMaxBytes: 1024 * 1024 * 1024,      // 1GB
  coldMaxBytes: 10 * 1024 * 1024 * 1024,  // 10GB
  warmDefaultTtlMs: 2 * 60 * 60 * 1000,  // 2小时
  coldDefaultTtlMs: 24 * 60 * 60 * 1000,  // 24小时
  hotPhiThreshold: 0.75,
  warmPhiThreshold: 0.4,
  rebalanceIntervalMs: 60 * 1000,         // 60秒
  evictionRatio: 0.1,
};

// =============== Cache Tier Storage ===============

class TierStorage<T = any> {
  private entries: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];  // LRU tracking
  private currentBytes = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(
    private readonly tier: CacheTier,
    private readonly maxBytes: number
  ) {}

  get size(): number { return this.entries.size; }
  get totalBytes(): number { return this.currentBytes; }
  get hitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
  get evictionCount(): number { return this.evictions; }

  get(key: string): CacheEntry<T> | undefined {
    const entry = this.entries.get(key);
    if (entry) {
      this.hits++;
      entry.lastAccessedAt = Date.now();
      entry.accessCount++;
      // Move to end of LRU
      const idx = this.accessOrder.indexOf(key);
      if (idx >= 0) {
        this.accessOrder.splice(idx, 1);
        this.accessOrder.push(key);
      }
    } else {
      this.misses++;
    }
    return entry;
  }

  set(entry: CacheEntry<T>): void {
    const existing = this.entries.get(entry.key);
    if (existing) {
      this.currentBytes -= existing.sizeBytes;
      this.entries.delete(entry.key);
      const idx = this.accessOrder.indexOf(entry.key);
      if (idx >= 0) this.accessOrder.splice(idx, 1);
    }

    this.entries.set(entry.key, entry);
    this.accessOrder.push(entry.key);
    this.currentBytes += entry.sizeBytes;
  }

  delete(key: string): CacheEntry<T> | undefined {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      const idx = this.accessOrder.indexOf(key);
      if (idx >= 0) this.accessOrder.splice(idx, 1);
      this.currentBytes -= entry.sizeBytes;
      return entry;
    }
    return undefined;
  }

  /**
   * LRU淘汰: 返回被淘汰的entries
   */
  evictLRU(ratio: number): CacheEntry<T>[] {
    const evictCount = Math.max(1, Math.floor(this.entries.size * ratio));
    const evicted: CacheEntry<T>[] = [];

    for (let i = 0; i < evictCount && this.accessOrder.length > 0; i++) {
      const oldestKey = this.accessOrder[0];
      const entry = this.delete(oldestKey);
      if (entry) {
        evicted.push(entry);
        this.evictions++;
      }
    }

    return evicted;
  }

  /**
   * TTL过期检查: 返回过期的entries
   */
  evictExpired(): CacheEntry<T>[] {
    const now = Date.now();
    const expired: CacheEntry<T>[] = [];

    for (const [key, entry] of this.entries) {
      if (now - entry.createdAt > entry.ttlMs) {
        const removed = this.delete(key);
        if (removed) expired.push(removed);
      }
    }

    return expired;
  }

  /**
   * 获取统计信息
   */
  getStats(avgPhi: number): CacheTierStats {
    const entries = Array.from(this.entries.values());
    const totalAccess = entries.reduce((sum, e) => sum + e.accessCount, 0);

    return {
      tier: this.tier,
      entryCount: entries.length,
      totalSizeBytes: this.currentBytes,
      hitRate: Math.round(this.hitRate * 1000) / 1000,
      avgPhiScore: Math.round(avgPhi * 1000) / 1000,
      avgAccessCount: entries.length > 0 ? Math.round(totalAccess / entries.length * 10) / 10 : 0,
      evictionCount: this.evictions,
    };
  }

  values(): IterableIterator<CacheEntry<T>> {
    return this.entries.values();
  }
}

// =============== Phi Cache Tier Manager ===============

class PhiCacheTierManager {
  private hotTier: TierStorage;
  private warmTier: TierStorage;
  private coldTier: TierStorage;
  private config: PhiCacheConfig;
  private transitions: TierTransition[] = [];
  private rebalanceTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<PhiCacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.hotTier = new TierStorage('HOT', this.config.hotMaxBytes);
    this.warmTier = new TierStorage('WARM', this.config.warmMaxBytes);
    this.coldTier = new TierStorage('COLD', this.config.coldMaxBytes);
  }

  /**
   * 启动自动再平衡
   */
  startRebalance(): void {
    if (this.rebalanceTimer) return;
    this.rebalanceTimer = setInterval(() => this.rebalance(), this.config.rebalanceIntervalMs);
    console.log(`[PhiCache] 自动再平衡已启动, 间隔 ${this.config.rebalanceIntervalMs}ms`);
  }

  /**
   * 停止自动再平衡
   */
  stopRebalance(): void {
    if (this.rebalanceTimer) {
      clearInterval(this.rebalanceTimer);
      this.rebalanceTimer = null;
    }
  }

  /**
   * 核心: 根据Φ值确定缓存层
   *
   * 分层规则 (对齐华为UB-SSD设计哲学):
   * - Φ ≥ 0.75 → 热层 (SRAM): Agent活跃会话, 毫秒级访问
   * - 0.4 ≤ Φ < 0.75 → 温层 (SSD): 中间结果, 1-2小时TTL
   * - Φ < 0.4 → 冷层 (全息边界): 历史归档, 按需Rehydration
   */
  determineTier(phiScore: number): CacheTier {
    if (phiScore >= this.config.hotPhiThreshold) return 'HOT';
    if (phiScore >= this.config.warmPhiThreshold) return 'WARM';
    return 'COLD';
  }

  /**
   * 写入缓存
   */
  set<T = any>(
    key: string,
    value: T,
    phiScore: number,
    options?: {
      sizeBytes?: number;
      ttlMs?: number;
      metadata?: Record<string, any>;
    }
  ): CacheTier {
    const tier = this.determineTier(phiScore);

    const entry: CacheEntry<T> = {
      key,
      value,
      tier,
      phiScore,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      ttlMs: options?.ttlMs ?? this.getDefaultTtl(tier),
      accessCount: 0,
      sizeBytes: options?.sizeBytes ?? this.estimateSize(value),
      metadata: options?.metadata,
    };

    const storage = this.getStorage(tier);

    // 容量检查 → LRU淘汰
    if (storage.totalBytes + entry.sizeBytes > this.getMaxBytes(tier)) {
      const evicted = storage.evictLRU(this.config.evictionRatio);
      for (const e of evicted) {
        this.recordTransition(e.key, tier, this.downgradeTier(tier), 'LRU_EVICTION', e.phiScore);
      }
    }

    storage.set(entry);
    return tier;
  }

  /**
   * 读取缓存 (自动升级Φ值高的条目)
   */
  get<T = any>(key: string): { value: T; tier: CacheTier; phiScore: number } | null {
    // 按层级查找: 热→温→冷
    let entry = this.hotTier.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      entry = this.warmTier.get(key) as CacheEntry<T> | undefined;
    }
    if (!entry) {
      entry = this.coldTier.get(key) as CacheEntry<T> | undefined;
    }

    if (!entry) return null;

    // Φ值升级检查: 如果条目Φ值升高且层数不匹配，自动升级
    const expectedTier = this.determineTier(entry.phiScore);
    if (expectedTier !== entry.tier && this.isHigherTier(expectedTier, entry.tier)) {
      const oldTier = entry.tier;
      const oldStorage = this.getStorage(oldTier);
      oldStorage.delete(key);

      entry.tier = expectedTier;
      this.getStorage(expectedTier).set(entry);

      this.recordTransition(key, oldTier, expectedTier, 'PHI_UPGRADE', entry.phiScore);
    }

    return {
      value: entry.value,
      tier: entry.tier,
      phiScore: entry.phiScore,
    };
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return !!(
      this.hotTier.delete(key) ||
      this.warmTier.delete(key) ||
      this.coldTier.delete(key)
    );
  }

  /**
   * 更新Φ值 (可能导致层级迁移)
   */
  updatePhiScore(key: string, newPhiScore: number): CacheTier | null {
    // 查找条目
    let entry: CacheEntry | undefined;
    let currentTier: CacheTier | undefined;

    for (const [tier, storage] of [
      ['HOT', this.hotTier],
      ['WARM', this.warmTier],
      ['COLD', this.coldTier],
    ] as [CacheTier, TierStorage][]) {
      const e = storage.get(key);
      if (e) {
        entry = e;
        currentTier = tier;
        break;
      }
    }

    if (!entry || !currentTier) return null;

    const newTier = this.determineTier(newPhiScore);
    entry.phiScore = newPhiScore;

    // 需要迁移
    if (newTier !== currentTier) {
      const oldStorage = this.getStorage(currentTier);
      oldStorage.delete(key);

      entry.tier = newTier;
      this.getStorage(newTier).set(entry);

      const reason = this.isHigherTier(newTier, currentTier) ? 'PHI_UPGRADE' : 'PHI_DOWNGRADE';
      this.recordTransition(key, currentTier, newTier, reason, newPhiScore);
    }

    return newTier;
  }

  /**
   * 再平衡: TTL过期 + Φ值再评估
   */
  rebalance(): {
    expired: number;
    upgraded: number;
    downgraded: number;
  } {
    // 1. TTL过期: 温层→冷层
    const warmExpired = this.warmTier.evictExpired();
    for (const entry of warmExpired) {
      entry.tier = 'COLD';
      entry.ttlMs = this.config.coldDefaultTtlMs;
      this.coldTier.set(entry);
      this.recordTransition(entry.key, 'WARM', 'COLD', 'TTL_EXPIRED', entry.phiScore);
    }

    // 2. TTL过期: 冷层直接删除
    const coldExpired = this.coldTier.evictExpired();
    void coldExpired;  // 已删除

    // 3. 冷层LRU淘汰
    if (this.coldTier.totalBytes > this.config.coldMaxBytes) {
      this.coldTier.evictLRU(this.config.evictionRatio);
    }

    // 4. Φ值再评估 (采样检查)
    let upgraded = 0;
    let downgraded = 0;

    // 检查温层中Φ值升高的条目
    for (const entry of this.warmTier.values()) {
      if (entry.phiScore >= this.config.hotPhiThreshold) {
        this.warmTier.delete(entry.key);
        entry.tier = 'HOT';
        this.hotTier.set(entry);
        this.recordTransition(entry.key, 'WARM', 'HOT', 'PHI_UPGRADE', entry.phiScore);
        upgraded++;
      }
    }

    // 检查热层中Φ值降低的条目
    for (const entry of this.hotTier.values()) {
      if (entry.phiScore < this.config.hotPhiThreshold) {
        this.hotTier.delete(entry.key);
        const newTier = entry.phiScore >= this.config.warmPhiThreshold ? 'WARM' : 'COLD';
        entry.tier = newTier;
        this.getStorage(newTier).set(entry);
        this.recordTransition(entry.key, 'HOT', newTier, 'PHI_DOWNGRADE', entry.phiScore);
        downgraded++;
      }
    }

    return {
      expired: warmExpired.length + coldExpired.length,
      upgraded,
      downgraded,
    };
  }

  /**
   * 获取全局统计
   */
  getStats(): {
    tiers: CacheTierStats[];
    transitions: TierTransition[];
    totalEntries: number;
    totalBytes: number;
  } {
    const hotStats = this.hotTier.getStats(this.calcAvgPhi(this.hotTier));
    const warmStats = this.warmTier.getStats(this.calcAvgPhi(this.warmTier));
    const coldStats = this.coldTier.getStats(this.calcAvgPhi(this.coldTier));

    return {
      tiers: [hotStats, warmStats, coldStats],
      transitions: this.transitions.slice(-50),
      totalEntries: hotStats.entryCount + warmStats.entryCount + coldStats.entryCount,
      totalBytes: hotStats.totalSizeBytes + warmStats.totalSizeBytes + coldStats.totalSizeBytes,
    };
  }

  /**
   * 获取层级迁移历史
   */
  getTransitions(limit: number = 100): TierTransition[] {
    return this.transitions.slice(-limit);
  }

  /**
   * 清理所有缓存
   */
  clear(): void {
    this.hotTier = new TierStorage('HOT', this.config.hotMaxBytes);
    this.warmTier = new TierStorage('WARM', this.config.warmMaxBytes);
    this.coldTier = new TierStorage('COLD', this.config.coldMaxBytes);
    this.transitions = [];
  }

  dispose(): void {
    this.stopRebalance();
    this.clear();
  }

  // =============== Private Methods ===============

  private getStorage(tier: CacheTier): TierStorage {
    switch (tier) {
      case 'HOT': return this.hotTier;
      case 'WARM': return this.warmTier;
      case 'COLD': return this.coldTier;
    }
  }

  private getMaxBytes(tier: CacheTier): number {
    switch (tier) {
      case 'HOT': return this.config.hotMaxBytes;
      case 'WARM': return this.config.warmMaxBytes;
      case 'COLD': return this.config.coldMaxBytes;
    }
  }

  private getDefaultTtl(tier: CacheTier): number {
    switch (tier) {
      case 'HOT': return Infinity;  // 热层无TTL (由LRU淘汰管理)
      case 'WARM': return this.config.warmDefaultTtlMs;
      case 'COLD': return this.config.coldDefaultTtlMs;
    }
  }

  private downgradeTier(tier: CacheTier): CacheTier {
    switch (tier) {
      case 'HOT': return 'WARM';
      case 'WARM': return 'COLD';
      case 'COLD': return 'COLD';  // 冷层淘汰即删除
    }
  }

  private isHigherTier(a: CacheTier, b: CacheTier): boolean {
    const order: Record<CacheTier, number> = { HOT: 2, WARM: 1, COLD: 0 };
    return order[a] > order[b];
  }

  private estimateSize(value: any): number {
    return JSON.stringify(value).length * 2;  // 粗略估计
  }

  private calcAvgPhi(storage: TierStorage): number {
    let sum = 0;
    let count = 0;
    for (const entry of storage.values()) {
      sum += entry.phiScore;
      count++;
    }
    return count > 0 ? sum / count : 0;
  }

  private recordTransition(
    key: string,
    fromTier: CacheTier,
    toTier: CacheTier,
    reason: TierTransition['reason'],
    phiScore: number
  ): void {
    this.transitions.push({
      key,
      fromTier,
      toTier,
      reason,
      phiScore,
      timestamp: Date.now(),
    });

    // 保留最近1000条
    if (this.transitions.length > 1000) {
      this.transitions = this.transitions.slice(-1000);
    }
  }
}

// =============== Singleton Export ===============

let _cacheManager: PhiCacheTierManager | null = null;

export function getPhiCacheTierManager(
  config?: Partial<PhiCacheConfig>
): PhiCacheTierManager {
  if (!_cacheManager) {
    _cacheManager = new PhiCacheTierManager(config);
  }
  return _cacheManager;
}

export function createPhiCacheTierManager(
  config?: Partial<PhiCacheConfig>
): PhiCacheTierManager {
  return new PhiCacheTierManager(config);
}

export { PhiCacheTierManager };

// =============== Self-Test ===============

if (require.main === module) {
  const cache = createPhiCacheTierManager({
    hotMaxBytes: 1024,
    warmMaxBytes: 10 * 1024,
    coldMaxBytes: 100 * 1024,
  });

  console.log('\n=== Φ-CacheTier三层存储分级自测 ===\n');

  // 测试1: Φ值驱动分层
  const tier75 = cache.determineTier(0.75);
  const tier50 = cache.determineTier(0.50);
  const tier30 = cache.determineTier(0.30);
  console.log(`测试1 - Φ分层: 0.75→${tier75}, 0.50→${tier50}, 0.30→${tier30} → ${
    tier75 === 'HOT' && tier50 === 'WARM' && tier30 === 'COLD' ? 'PASS' : 'FAIL'
  }`);

  // 测试2: 写入+读取
  cache.set('hot-key', { agent: 'session-1' }, 0.9, { sizeBytes: 100 });
  cache.set('warm-key', { data: 'intermediate' }, 0.6, { sizeBytes: 200 });
  cache.set('cold-key', { archive: 'old' }, 0.3, { sizeBytes: 300 });

  const hotResult = cache.get('hot-key');
  const warmResult = cache.get('warm-key');
  const coldResult = cache.get('cold-key');
  console.log(`测试2 - 读写: hot=${hotResult?.tier}, warm=${warmResult?.tier}, cold=${coldResult?.tier} → ${
    hotResult?.tier === 'HOT' && warmResult?.tier === 'WARM' && coldResult?.tier === 'COLD' ? 'PASS' : 'FAIL'
  }`);

  // 测试3: Φ值升级 (温→热)
  cache.updatePhiScore('warm-key', 0.85);
  const upgraded = cache.get('warm-key');
  console.log(`测试3 - Φ升级: WARM→${upgraded?.tier} (Φ=0.85) → ${upgraded?.tier === 'HOT' ? 'PASS' : 'FAIL'}`);

  // 测试4: Φ值降级 (热→冷)
  cache.updatePhiScore('hot-key', 0.2);
  const downgraded = cache.get('hot-key');
  console.log(`测试4 - Φ降级: HOT→${downgraded?.tier} (Φ=0.2) → ${downgraded?.tier === 'COLD' ? 'PASS' : 'FAIL'}`);

  // 测试5: 统计
  const stats = cache.getStats();
  console.log(`测试5 - 统计: ${stats.totalEntries}条, ${stats.tiers.map(t => `${t.tier}:${t.entryCount}`).join(', ')}`);

  console.log('\n=== 自测完成 ===\n');
}
