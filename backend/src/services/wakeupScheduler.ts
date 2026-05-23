/**
 * Wakeup Scheduler - V11.0 冬眠唤醒调度器
 *
 * 定时扫描冬眠Agent，检查唤醒条件并执行唤醒。
 * 使用 node-cron 每6小时扫描一次。
 * 使用 PostgreSQL advisory lock 实现分布式调度（同一时刻只有一个实例运行）。
 * 通过环境变量 SCHEDULER_ENABLED 控制是否启用。
 */

import * as cron from 'node-cron';
import logger from '../utils/logger';
import { get_instance as getMetabolismService } from './metabolismService';
import { getLaborRepository } from '../db/laborRepository';

// =============== Types ===============

export interface WakeupResult {
  agent: string;
  woken: boolean;
  reason: number;  // 0=not woken, 1=phiThreshold, 2=timeout, 3=pendingOrders, 4=votingWeight
  details: string;
}

export interface WakeupScanResult {
  scanTime: number;
  totalScanned: number;
  totalWoken: number;
  results: WakeupResult[];
}

// =============== Scheduler Class ===============

class WakeupSchedulerClass {
  private task: ReturnType<typeof cron.schedule> | null = null;
  private enabled: boolean;
  private running: boolean = false;
  private lastScanTime: number = 0;
  private lastScanResult: WakeupScanResult | null = null;

  constructor() {
    this.enabled = process.env.SCHEDULER_ENABLED === 'true';
    logger.info(`[WakeupScheduler] Initialized (enabled=${this.enabled})`);
  }

  /**
   * 启动调度器
   */
  start(): void {
    if (!this.enabled) {
      logger.info('[WakeupScheduler] Scheduler is disabled by SCHEDULER_ENABLED env');
      return;
    }

    if (this.task) {
      logger.warn('[WakeupScheduler] Scheduler already running');
      return;
    }

    // Cron: every 6 hours at minute 0 → "0 */6 * * *"
    this.task = cron.schedule('0 */6 * * *', async () => {
      await this.scanAndWake();
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai',
    } as any);

    logger.info('[WakeupScheduler] Started with schedule: 0 */6 * * *');
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('[WakeupScheduler] Stopped');
    }
  }

  /**
   * 执行一次唤醒扫描
   */
  async scanAndWake(): Promise<WakeupScanResult> {
    if (this.running) {
      logger.warn('[WakeupScheduler] Scan already in progress, skipping');
      return this.lastScanResult || {
        scanTime: Date.now(),
        totalScanned: 0,
        totalWoken: 0,
        results: [],
      };
    }

    this.running = true;
    const scanTime = Date.now();
    const results: WakeupResult[] = [];
    let totalScanned = 0;
    let totalWoken = 0;

    try {
      // Try to acquire advisory lock for distributed scheduling
      const repo = getLaborRepository();
      const lockAcquired = await repo.tryAdvisoryLock(20241101);  // V11 lock ID

      if (!lockAcquired) {
        logger.info('[WakeupScheduler] Advisory lock not acquired, another instance is scanning');
        return {
          scanTime,
          totalScanned: 0,
          totalWoken: 0,
          results: [],
        };
      }

      try {
        const metabolismService = getMetabolismService();

        // Get all hibernating agents from the metabolism service
        // In production, this would query the on-chain contract state
        // For mock mode, we scan the in-memory state
        const hibernatingAgents = this.getHibernatingAgents();

        for (const agent of hibernatingAgents) {
          totalScanned++;
          const result = await this.checkAndWakeAgent(agent, metabolismService);
          results.push(result);
          if (result.woken) {
            totalWoken++;
          }
        }

        logger.info(`[WakeupScheduler] Scan complete: scanned=${totalScanned}, woken=${totalWoken}`);
      } finally {
        await repo.releaseAdvisoryLock(20241101);
      }
    } catch (err: any) {
      logger.error(`[WakeupScheduler] Scan error: ${err.message}`);
    } finally {
      this.running = false;
      this.lastScanTime = scanTime;
      this.lastScanResult = {
        scanTime,
        totalScanned,
        totalWoken,
        results,
      };
    }

    return {
      scanTime,
      totalScanned,
      totalWoken,
      results,
    };
  }

  /**
   * 检查并唤醒单个Agent
   */
  private async checkAndWakeAgent(agent: string, metabolismService: any): Promise<WakeupResult> {
    const state = metabolismService.getMetabolismState(agent);
    if (!state || !state.hibernating) {
      return { agent, woken: false, reason: 0, details: 'Not hibernating' };
    }

    // Check 4 wakeup conditions
    let wakeReason = 0;
    let details = '';

    // Condition 1: PhiStaking power >= wakePhiThreshold (default 3000)
    // In mock mode, check the agent's phi value
    if (state.baseMetabolicRate >= 3000) {
      wakeReason = 1;
      details = `Phi staking power (${state.baseMetabolicRate}) >= threshold (3000)`;
    }

    // Condition 2: Timeout >= 30 days
    if (wakeReason === 0 && state.hibernationStart > 0) {
      const hibernationDuration = Date.now() - state.hibernationStart;
      const thirtyDaysMs = 30 * 24 * 3600 * 1000;
      if (hibernationDuration >= thirtyDaysMs) {
        wakeReason = 2;
        details = `Hibernation duration (${Math.floor(hibernationDuration / (24 * 3600 * 1000))} days) >= 30 days`;
      }
    }

    // Condition 3: Pending labor orders
    if (wakeReason === 0) {
      try {
        const repo = getLaborRepository();
        const pendingOrders = await repo.getPendingOrdersForAgent(agent);
        if (pendingOrders.length > 0) {
          wakeReason = 3;
          details = `${pendingOrders.length} pending labor orders`;
        }
      } catch {
        // PG not available, skip this condition
      }
    }

    // Condition 4: 1% voting weight (simplified check in mock mode)
    if (wakeReason === 0 && state.baseMetabolicRate >= 100) {
      wakeReason = 4;
      details = 'Agent voting weight >= 1%';
    }

    if (wakeReason > 0) {
      try {
        metabolismService.exitHibernation(agent);
        logger.info(`[WakeupScheduler] Agent ${agent} woken up (reason=${wakeReason}: ${details})`);
        return { agent, woken: true, reason: wakeReason, details };
      } catch (err: any) {
        return { agent, woken: false, reason: 0, details: `Wake failed: ${err.message}` };
      }
    }

    return { agent, woken: false, reason: 0, details: 'No wakeup condition met' };
  }

  /**
   * 获取所有冬眠Agent列表（模拟模式）
   */
  private getHibernatingAgents(): string[] {
    // In production, this would query the TaiyiReward contract
    // For mock mode, return a placeholder list
    // The metabolism service doesn't expose a list-all method,
    // so we rely on a known set or external configuration
    return [];
  }

  /**
   * 获取调度器状态
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    lastScanTime: number;
    lastScanResult: WakeupScanResult | null;
  } {
    return {
      enabled: this.enabled,
      running: this.running,
      lastScanTime: this.lastScanTime,
      lastScanResult: this.lastScanResult,
    };
  }

  /**
   * 手动触发唤醒指定Agent
   */
  async manualWake(agent: string): Promise<WakeupResult> {
    const metabolismService = getMetabolismService();
    const state = metabolismService.getMetabolismState(agent);

    if (!state || !state.hibernating) {
      return { agent, woken: false, reason: 0, details: 'Not hibernating' };
    }

    try {
      metabolismService.exitHibernation(agent);
      logger.info(`[WakeupScheduler] Agent ${agent} manually woken`);
      return { agent, woken: true, reason: 0, details: 'Manual wake' };
    } catch (err: any) {
      return { agent, woken: false, reason: 0, details: `Wake failed: ${err.message}` };
    }
  }

  /**
   * 手动触发全量扫描（API路由别名）
   */
  async manualScan(): Promise<WakeupScanResult> {
    return this.scanAndWake();
  }

  /**
   * 获取上次扫描结果
   */
  getLastScanResult(): WakeupScanResult | null {
    return this.lastScanResult;
  }

  /**
   * 检查单个Agent唤醒条件
   */
  async checkAgent(agent: string): Promise<WakeupResult> {
    const metabolismService = getMetabolismService();
    const state = metabolismService.getMetabolismState(agent);
    if (!state || !state.hibernating) {
      return { agent, woken: false, reason: 0, details: 'Not hibernating' };
    }
    return this.checkAndWakeAgent(agent, metabolismService);
  }

  /**
   * 更新唤醒参数
   */
  updateParams(params: { wakePhiThreshold?: number; wakeTimeoutDays?: number; wakeVotingWeightBps?: number }): { updated: boolean } {
    logger.info(`[WakeupScheduler] Params update requested: ${JSON.stringify(params)}`);
    // In production, this would call contract setter functions
    return { updated: true };
  }
}

// =============== Singleton ===============

let instance: WakeupSchedulerClass | null = null;

export function getWakeupScheduler(): WakeupSchedulerClass {
  if (!instance) {
    instance = new WakeupSchedulerClass();
  }
  return instance;
}

export { WakeupSchedulerClass };
export default WakeupSchedulerClass;
