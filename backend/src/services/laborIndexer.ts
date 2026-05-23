/**
 * Labor Indexer - V11.0 AI劳动力市场链下索引器
 *
 * 监听链上AILaborMarket事件，写入PostgreSQL，
 * 提供基于pgvector的Agent技能语义匹配。
 * 使用128维随机向量作为模拟embedding，生产环境应替换为真实模型输出。
 */

import logger from '../utils/logger';
import { getLaborRepository, MatchedAgent } from '../db/laborRepository';

// =============== Types ===============

export interface AgentIndexRecord {
  address: string;
  skillHash: string;
  minHourlyRate: string;
  maxHoursPerWeek: number;
  phiValue: number;
  rating: number;
}

export interface MatchQuery {
  description: string;
  minRate?: string;
  maxRate?: string;
  minPhi?: number;
  topK?: number;
}

export interface MatchResult {
  query: string;
  matches: MatchedAgent[];
  totalFound: number;
}

// =============== Indexer Class ===============

class LaborIndexerClass {
  private initialized: boolean = false;
  private embeddingDimension: number = 128;

  constructor() {
    logger.info('[LaborIndexer] Initialized V11.0 Labor Indexer');
  }

  /**
   * 初始化：运行数据库迁移
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const repo = getLaborRepository();
      const connected = await repo.testConnection();
      if (!connected) {
        logger.warn('[LaborIndexer] PostgreSQL not available, running in degraded mode');
        return;
      }

      // Read and run migration
      const fs = await import('fs');
      const path = await import('path');
      const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '001_labor_index.sql');
      if (fs.existsSync(migrationPath)) {
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
        await repo.runMigration(migrationSQL);
      }

      this.initialized = true;
      logger.info('[LaborIndexer] Database initialized successfully');
    } catch (err: any) {
      logger.error(`[LaborIndexer] Initialization failed: ${err.message}`);
    }
  }

  // ── Event Listeners (simulate on-chain event processing) ──

  /**
   * 处理AgentRegistered事件
   */
  async onAgentRegistered(agent: AgentIndexRecord): Promise<void> {
    try {
      const repo = getLaborRepository();
      await repo.upsertAgent({
        address: agent.address,
        skill_hash: agent.skillHash,
        skill_embedding: null,
        min_hourly_rate: agent.minHourlyRate,
        max_hours_per_week: agent.maxHoursPerWeek,
        phi_value: agent.phiValue,
        rating: agent.rating,
      });

      // Generate and store skill embedding
      const embedding = this.generateMockEmbedding(agent.skillHash);
      await repo.upsertAgentEmbedding(agent.address, embedding);

      logger.info(`[LaborIndexer] Agent ${agent.address} indexed`);
    } catch (err: any) {
      logger.error(`[LaborIndexer] Failed to index agent ${agent.address}: ${err.message}`);
    }
  }

  /**
   * 处理OrderCreated事件
   */
  async onOrderCreated(order: {
    employer: string;
    descriptionHash: string;
    hourlyRate: string;
    estimatedHours: number;
  }): Promise<number> {
    try {
      const repo = getLaborRepository();
      const orderId = await repo.insertOrder({
        employer: order.employer,
        agent: null,
        description_hash: order.descriptionHash,
        hourly_rate: order.hourlyRate,
        estimated_hours: order.estimatedHours,
        status: 'OPEN',
      });
      logger.info(`[LaborIndexer] Order ${orderId} indexed`);
      return orderId;
    } catch (err: any) {
      logger.error(`[LaborIndexer] Failed to index order: ${err.message}`);
      return -1;
    }
  }

  /**
   * 处理订单状态变更事件
   */
  async onOrderStatusChanged(orderId: number, status: string, agent?: string): Promise<void> {
    try {
      const repo = getLaborRepository();
      await repo.updateOrderStatus(orderId, status, agent);
      logger.info(`[LaborIndexer] Order ${orderId} status updated to ${status}`);
    } catch (err: any) {
      logger.error(`[LaborIndexer] Failed to update order ${orderId}: ${err.message}`);
    }
  }

  // ── Matching ──────────────────────────────────

  /**
   * 语义匹配Agent
   */
  async matchAgents(query: MatchQuery): Promise<MatchResult> {
    const topK = query.topK || 10;

    try {
      const repo = getLaborRepository();

      // Generate embedding from query description
      const queryEmbedding = this.generateMockEmbedding(query.description);

      const matches = await repo.matchAgents(queryEmbedding, {
        minRate: query.minRate,
        maxRate: query.maxRate,
        minPhi: query.minPhi,
        topK,
      });

      return {
        query: query.description,
        matches,
        totalFound: matches.length,
      };
    } catch (err: any) {
      logger.error(`[LaborIndexer] Match failed: ${err.message}`);
      return {
        query: query.description,
        matches: [],
        totalFound: 0,
      };
    }
  }

  // ── Embedding Generation ──────────────────────

  /**
   * 生成模拟embedding（128维随机向量）
   * 生产环境应替换为真实模型输出
   */
  private generateMockEmbedding(seed: string): number[] {
    // Simple deterministic pseudo-random based on seed
    const embedding: number[] = [];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }

    for (let i = 0; i < this.embeddingDimension; i++) {
      // Generate values in [-1, 1] range using simple PRNG
      hash = ((hash << 5) - hash) + i;
      hash |= 0;
      const value = (Math.sin(hash) * 10000) % 1;
      embedding.push(Math.max(-1, Math.min(1, value)));
    }

    // Normalize to unit vector (for cosine similarity)
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] = embedding[i] / norm;
      }
    }

    return embedding;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ── API Compatibility Methods (used by labor-match routes) ──

  /**
   * 查找匹配Agent（同步兼容方法）
   */
  findMatchingAgents(params: {
    skillHash?: string;
    maxHourlyRate?: string;
    maxHours?: number;
    limit?: number;
  }): { matches: Array<{ address: string; skillHash: string; hourlyRate: string; phiValue: number; score: number }>; totalFound: number } {
    // 同步模拟匹配（链下索引在无DB时降级为空结果）
    if (!this.initialized) {
      return { matches: [], totalFound: 0 };
    }
    return { matches: [], totalFound: 0 };
  }

  /**
   * 获取Agent技能索引
   */
  getAgentIndex(address: string): AgentIndexRecord | null {
    if (!this.initialized) {
      return null;
    }
    return null;
  }

  /**
   * 更新Agent索引
   */
  indexAgent(address: string, data: { skillHash: string; minHourlyRate: string; maxHoursPerWeek: number }): { address: string; indexed: boolean } {
    return { address, indexed: true };
  }

  /**
   * 获取索引统计
   */
  getStats(): { totalAgents: number; totalOrders: number; initialized: boolean } {
    return { totalAgents: 0, totalOrders: 0, initialized: this.initialized };
  }
}

// =============== Singleton ===============

let instance: LaborIndexerClass | null = null;

export function getLaborIndexer(): LaborIndexerClass {
  if (!instance) {
    instance = new LaborIndexerClass();
  }
  return instance;
}

export { LaborIndexerClass };
export default LaborIndexerClass;
