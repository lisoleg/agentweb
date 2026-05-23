/**
 * Labor Repository - V11.0 AI Labor Index PG Repository
 *
 * PostgreSQL connection pool wrapper with CRUD operations
 * for agent profiles, orders, and skill embedding matching.
 */

import { Pool, PoolConfig, QueryResult } from 'pg';
import logger from '../utils/logger';

// =============== Types ===============

export interface AgentRecord {
  address: string;
  skill_hash: string;
  skill_embedding: number[] | null;
  min_hourly_rate: string;
  max_hours_per_week: number;
  phi_value: number;
  rating: number;
  last_active: Date;
  created_at: Date;
}

export interface OrderRecord {
  order_id: number;
  employer: string;
  agent: string | null;
  description_hash: string;
  hourly_rate: string;
  estimated_hours: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface MatchedAgent {
  address: string;
  skill_hash: string;
  min_hourly_rate: string;
  max_hours_per_week: number;
  phi_value: number;
  rating: number;
  similarity: number;
}

// =============== Repository Class ===============

class LaborRepositoryClass {
  private pool: Pool;
  private connected: boolean = false;

  constructor() {
    const config: PoolConfig = {
      host: process.env.PGVECTOR_HOST || 'localhost',
      port: parseInt(process.env.PGVECTOR_PORT || '5433', 10),
      database: process.env.PGVECTOR_DB || 'labor_index',
      user: process.env.PGVECTOR_USER || 'laborindex',
      password: process.env.PGVECTOR_PASSWORD || 'laborindex_secure_password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    this.pool = new Pool(config);

    this.pool.on('error', (err: Error) => {
      logger.error('[LaborRepository] Unexpected pool error', { error: err.message });
      this.connected = false;
    });

    this.pool.on('connect', () => {
      if (!this.connected) {
        logger.info('[LaborRepository] Connected to PostgreSQL + pgvector');
        this.connected = true;
      }
    });
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.connected = true;
      return true;
    } catch (err: any) {
      logger.error('[LaborRepository] Connection test failed', { error: err.message });
      this.connected = false;
      return false;
    }
  }

  /**
   * Run migration SQL
   */
  async runMigration(sql: string): Promise<void> {
    try {
      await this.pool.query(sql);
      logger.info('[LaborRepository] Migration executed successfully');
    } catch (err: any) {
      logger.error('[LaborRepository] Migration failed', { error: err.message });
      throw err;
    }
  }

  // ── Agent CRUD ──────────────────────────────────

  /**
   * Insert or update an agent profile
   */
  async upsertAgent(agent: Omit<AgentRecord, 'last_active' | 'created_at'>): Promise<void> {
    const query = `
      INSERT INTO agents (address, skill_hash, min_hourly_rate, max_hours_per_week, phi_value, rating)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (address) DO UPDATE SET
        skill_hash = EXCLUDED.skill_hash,
        min_hourly_rate = EXCLUDED.min_hourly_rate,
        max_hours_per_week = EXCLUDED.max_hours_per_week,
        phi_value = EXCLUDED.phi_value,
        rating = EXCLUDED.rating,
        last_active = NOW()
    `;
    await this.pool.query(query, [
      agent.address,
      agent.skill_hash,
      agent.min_hourly_rate,
      agent.max_hours_per_week,
      agent.phi_value,
      agent.rating,
    ]);
  }

  /**
   * Get agent by address
   */
  async getAgent(address: string): Promise<AgentRecord | null> {
    const result = await this.pool.query<AgentRecord>(
      'SELECT * FROM agents WHERE address = $1',
      [address]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all agents with optional filters
   */
  async getAgents(options?: {
    minPhi?: number;
    maxRate?: string;
    minRating?: number;
    limit?: number;
  }): Promise<AgentRecord[]> {
    const opts = options || {};
    const limit = opts.limit || 100;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (opts.minPhi !== undefined) {
      conditions.push(`phi_value >= $${paramIdx++}`);
      params.push(opts.minPhi);
    }
    if (opts.maxRate !== undefined) {
      conditions.push(`min_hourly_rate <= $${paramIdx++}`);
      params.push(opts.maxRate);
    }
    if (opts.minRating !== undefined) {
      conditions.push(`rating >= $${paramIdx++}`);
      params.push(opts.minRating);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const result = await this.pool.query<AgentRecord>(
      `SELECT * FROM agents ${where} ORDER BY rating DESC, phi_value DESC LIMIT $${paramIdx}`,
      params
    );
    return result.rows;
  }

  /**
   * Update agent's phi value
   */
  async updateAgentPhi(address: string, phiValue: number): Promise<void> {
    await this.pool.query(
      'UPDATE agents SET phi_value = $1, last_active = NOW() WHERE address = $2',
      [phiValue, address]
    );
  }

  /**
   * Update agent's skill embedding
   */
  async upsertAgentEmbedding(address: string, embedding: number[]): Promise<void> {
    const embeddingStr = `[${embedding.join(',')}]`;
    await this.pool.query(
      `INSERT INTO agent_embeddings (address, skill_embedding, updated_at)
       VALUES ($1, $2::vector, NOW())
       ON CONFLICT (address) DO UPDATE SET
         skill_embedding = EXCLUDED.skill_embedding,
         updated_at = NOW()`,
      [address, embeddingStr]
    );
  }

  // ── Order CRUD ──────────────────────────────────

  /**
   * Insert a new order
   */
  async insertOrder(order: Omit<OrderRecord, 'order_id' | 'created_at' | 'updated_at'>): Promise<number> {
    const result = await this.pool.query<{ order_id: number }>(
      `INSERT INTO orders (employer, agent, description_hash, hourly_rate, estimated_hours, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING order_id`,
      [order.employer, order.agent, order.description_hash, order.hourly_rate, order.estimated_hours, order.status]
    );
    return result.rows[0].order_id;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: number, status: string, agent?: string): Promise<void> {
    if (agent) {
      await this.pool.query(
        'UPDATE orders SET status = $1, agent = $2, updated_at = NOW() WHERE order_id = $3',
        [status, agent, orderId]
      );
    } else {
      await this.pool.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2',
        [status, orderId]
      );
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: number): Promise<OrderRecord | null> {
    const result = await this.pool.query<OrderRecord>(
      'SELECT * FROM orders WHERE order_id = $1',
      [orderId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(status: string, limit: number = 100): Promise<OrderRecord[]> {
    const result = await this.pool.query<OrderRecord>(
      'SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
      [status, limit]
    );
    return result.rows;
  }

  /**
   * Get pending orders for a specific agent
   */
  async getPendingOrdersForAgent(agent: string): Promise<OrderRecord[]> {
    const result = await this.pool.query<OrderRecord>(
      `SELECT * FROM orders
       WHERE (agent = $1 OR agent IS NULL) AND status IN ('OPEN', 'CONFIRMED')
       ORDER BY created_at DESC`,
      [agent]
    );
    return result.rows;
  }

  // ── Similarity Search ───────────────────────────

  /**
   * Match agents by embedding similarity with filters
   */
  async matchAgents(
    queryEmbedding: number[],
    options?: {
      minRate?: string;
      maxRate?: string;
      minPhi?: number;
      topK?: number;
    }
  ): Promise<MatchedAgent[]> {
    const opts = options || {};
    const topK = opts.topK || 10;
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const conditions: string[] = [];
    const params: any[] = [embeddingStr];
    let paramIdx = 2;

    if (opts.minRate !== undefined) {
      conditions.push(`a.min_hourly_rate >= $${paramIdx++}`);
      params.push(opts.minRate);
    }
    if (opts.maxRate !== undefined) {
      conditions.push(`a.min_hourly_rate <= $${paramIdx++}`);
      params.push(opts.maxRate);
    }
    if (opts.minPhi !== undefined) {
      conditions.push(`a.phi_value >= $${paramIdx++}`);
      params.push(opts.minPhi);
    }

    const where = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
    params.push(topK);

    const result = await this.pool.query<MatchedAgent>(
      `SELECT
         a.address,
         a.skill_hash,
         a.min_hourly_rate,
         a.max_hours_per_week,
         a.phi_value,
         a.rating,
         1 - (e.skill_embedding <=> $1::vector) AS similarity
       FROM agents a
       JOIN agent_embeddings e ON a.address = e.address
       WHERE 1=1 ${where}
       ORDER BY e.skill_embedding <=> $1::vector
       LIMIT $${paramIdx}`,
      params
    );

    return result.rows;
  }

  // ── Advisory Lock ───────────────────────────────

  /**
   * Try to acquire a PostgreSQL advisory lock (for distributed scheduling)
   */
  async tryAdvisoryLock(lockId: number): Promise<boolean> {
    const result = await this.pool.query<{ pg_try_advisory_lock: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS pg_try_advisory_lock',
      [lockId]
    );
    return result.rows[0].pg_try_advisory_lock;
  }

  /**
   * Release a PostgreSQL advisory lock
   */
  async releaseAdvisoryLock(lockId: number): Promise<boolean> {
    const result = await this.pool.query<{ pg_advisory_unlock: boolean }>(
      'SELECT pg_advisory_unlock($1) AS pg_advisory_unlock',
      [lockId]
    );
    return result.rows[0].pg_advisory_unlock;
  }

  // ── Cleanup ─────────────────────────────────────

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
    this.connected = false;
    logger.info('[LaborRepository] Connection pool closed');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// =============== Singleton ===============

let instance: LaborRepositoryClass | null = null;

export function getLaborRepository(): LaborRepositoryClass {
  if (!instance) {
    instance = new LaborRepositoryClass();
  }
  return instance;
}

export { LaborRepositoryClass };
export default LaborRepositoryClass;
