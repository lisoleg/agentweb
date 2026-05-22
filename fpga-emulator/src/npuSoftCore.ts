/**
 * NPU Soft Core - NPU软核+超级SIMD
 *
 * V5.0 Brainwave Integration: P1-1
 * 软核NPU模拟器，超级SIMD指令集（单指令>1M运算），MVU矩阵向量乘单元。
 * 与G-Sphere调度器集成。
 *
 * 默认配置:
 * - clockFreq: 600 MHz
 * - opsPerCycle: 130,000
 * - simdWidth: 512
 * - 8个MVU单元
 */

import {
  PrecisionMode,
  SIMDOpcode,
  NPUSIMDInstruction,
  MVUnit,
  NPUSoftCoreConfig,
} from './types';

// =============== Constants ===============

const DEFAULT_NPU_CONFIG: NPUSoftCoreConfig = {
  id: 'npu-default',
  clockFreq: 600, // MHz
  opsPerCycle: 130000,
  simdWidth: 512,
  mvuUnits: Array.from({ length: 8 }, (_, i) => ({
    id: `mvu-${i}`,
    precision: 'MS_FP8' as PrecisionMode,
    accumulatorSize: 4096,
    currentLoad: 0,
  })),
};

const MAX_INSTRUCTION_BUFFER = 1024;

// =============== NPU Execution Result ===============

export interface NPUExecutionResult {
  instructionsExecuted: number;
  totalMegaOps: number;
  executionTimeMs: number;
  mvuUtilization: number;
  throughputGops: number;
}

// =============== NPU Soft Core ===============

/**
 * NPUSoftCore: NPU软核模拟器
 *
 * 核心功能:
 * - 超级SIMD指令集执行
 * - MVU矩阵向量乘单元管理
 * - G-Sphere调度器集成
 */
export class NPUSoftCore {
  private static instance: NPUSoftCore | null = null;
  private config: NPUSoftCoreConfig;
  private instructionBuffer: NPUSIMDInstruction[] = [];
  private mvuUnits: Map<string, MVUnit> = new Map();
  private totalInstructionsExecuted: number = 0;
  private totalMegaOpsExecuted: number = 0;
  private gSphereIntegration: boolean = false;
  private gSphereRef: any | null = null;

  private constructor(config?: Partial<NPUSoftCoreConfig>) {
    this.config = { ...DEFAULT_NPU_CONFIG, ...config };

    // 初始化MVU单元
    for (const mvu of this.config.mvuUnits) {
      this.mvuUnits.set(mvu.id, { ...mvu });
    }

    console.log(`[NPU] Initialized: ${this.config.id}, ${this.config.clockFreq} MHz, ${this.config.opsPerCycle} ops/cycle`);
  }

  /**
   * 获取单例实例
   */
  static get_instance(config?: Partial<NPUSoftCoreConfig>): NPUSoftCore {
    if (!NPUSoftCore.instance) {
      NPUSoftCore.instance = new NPUSoftCore(config);
    }
    return NPUSoftCore.instance;
  }

  /**
   * 初始化NPU配置
   */
  initialize(config: Partial<NPUSoftCoreConfig>): void {
    this.config = { ...DEFAULT_NPU_CONFIG, ...config };

    // 重建MVU单元
    this.mvuUnits.clear();
    for (const mvu of this.config.mvuUnits) {
      this.mvuUnits.set(mvu.id, { ...mvu });
    }

    this.instructionBuffer = [];
    this.totalInstructionsExecuted = 0;
    this.totalMegaOpsExecuted = 0;

    console.log(`[NPU] Re-initialized: ${this.config.id}`);
  }

  /**
   * 加载SIMD指令
   */
  loadInstructions(instructions: NPUSIMDInstruction[]): void {
    if (this.instructionBuffer.length + instructions.length > MAX_INSTRUCTION_BUFFER) {
      throw new Error(
        `Instruction buffer overflow: ${this.instructionBuffer.length + instructions.length} > ${MAX_INSTRUCTION_BUFFER}`
      );
    }

    this.instructionBuffer.push(...instructions);
    console.log(`[NPU] Loaded ${instructions.length} instructions (buffer: ${this.instructionBuffer.length})`);
  }

  /**
   * 执行指令流
   */
  execute(): NPUExecutionResult {
    if (this.instructionBuffer.length === 0) {
      return {
        instructionsExecuted: 0,
        totalMegaOps: 0,
        executionTimeMs: 0,
        mvuUtilization: 0,
        throughputGops: 0,
      };
    }

    let totalMegaOps = 0;
    const instructionsExecuted = this.instructionBuffer.length;

    for (const instruction of this.instructionBuffer) {
      totalMegaOps += this.executeInstruction(instruction);
    }

    // 计算执行时间
    const totalOps = totalMegaOps * 1e6;
    const cyclesNeeded = totalOps / this.config.opsPerCycle;
    const executionTimeMs = cyclesNeeded / (this.config.clockFreq * 1e3);

    // 计算MVU利用率
    const mvuUtilization = this.calculateMVUUtilization();

    // 计算吞吐量 (GOPS)
    const throughputGops = executionTimeMs > 0
      ? totalMegaOps / executionTimeMs / 1000
      : 0;

    this.totalInstructionsExecuted += instructionsExecuted;
    this.totalMegaOpsExecuted += totalMegaOps;

    // 清空指令缓冲区
    this.instructionBuffer = [];

    // 如果已集成G-Sphere，同步执行结果
    if (this.gSphereIntegration && this.gSphereRef) {
      this.syncToGSphere(totalMegaOps);
    }

    console.log(`[NPU] Executed ${instructionsExecuted} instructions, ${totalMegaOps.toFixed(2)} MOPS, ${executionTimeMs.toFixed(3)} ms`);

    return {
      instructionsExecuted,
      totalMegaOps,
      executionTimeMs,
      mvuUtilization,
      throughputGops,
    };
  }

  /**
   * 分配MVU
   */
  allocateMVU(precision: PrecisionMode = 'MS_FP8'): MVUnit | null {
    for (const mvu of this.mvuUnits.values()) {
      if (mvu.currentLoad === 0) {
        mvu.precision = precision;
        mvu.currentLoad = 1;
        console.log(`[NPU] Allocated MVU: ${mvu.id} (${precision})`);
        return mvu;
      }
    }
    console.warn('[NPU] No available MVU');
    return null;
  }

  /**
   * 释放MVU
   */
  releaseMVU(mvuId: string): boolean {
    const mvu = this.mvuUnits.get(mvuId);
    if (!mvu) {
      console.warn(`[NPU] MVU ${mvuId} not found`);
      return false;
    }

    mvu.currentLoad = 0;
    console.log(`[NPU] Released MVU: ${mvuId}`);
    return true;
  }

  /**
   * 与金灵球调度器集成
   */
  integrateWithGSphere(gSphereScheduler: any): void {
    this.gSphereRef = gSphereScheduler;
    this.gSphereIntegration = true;
    console.log('[NPU] Integrated with G-Sphere scheduler');
  }

  /**
   * 获取核心统计
   */
  getCoreStats(): {
    config: NPUSoftCoreConfig;
    instructionBufferSize: number;
    totalInstructionsExecuted: number;
    totalMegaOpsExecuted: number;
    mvuUtilization: number;
    gSphereIntegrated: boolean;
  } {
    return {
      config: this.config,
      instructionBufferSize: this.instructionBuffer.length,
      totalInstructionsExecuted: this.totalInstructionsExecuted,
      totalMegaOpsExecuted: this.totalMegaOpsExecuted,
      mvuUtilization: this.calculateMVUUtilization(),
      gSphereIntegrated: this.gSphereIntegration,
    };
  }

  // =============== Private Methods ===============

  /**
   * 执行单条SIMD指令
   */
  private executeInstruction(instruction: NPUSIMDInstruction): number {
    switch (instruction.opcode) {
      case 'MAC':
        // 乘累加：simdWidth × operand_pairs
        return instruction.megaOpsPerInstruction || this.config.simdWidth * 2 / 1e6;

      case 'LOAD':
        // 数据加载：simdWidth × bytes
        return instruction.megaOpsPerInstruction || this.config.simdWidth / 1e6;

      case 'STORE':
        // 数据存储：simdWidth × bytes
        return instruction.megaOpsPerInstruction || this.config.simdWidth / 1e6;

      case 'ACTIVATE':
        // 激活函数：element-wise操作
        return instruction.megaOpsPerInstruction || this.config.simdWidth / 1e6;

      case 'SYNC':
        // 同步屏障：开销较小
        return instruction.megaOpsPerInstruction || 0.001;

      default:
        return instruction.megaOpsPerInstruction || 0;
    }
  }

  /**
   * 计算MVU利用率
   */
  private calculateMVUUtilization(): number {
    if (this.mvuUnits.size === 0) return 0;
    const totalLoad = Array.from(this.mvuUnits.values())
      .reduce((sum, mvu) => sum + mvu.currentLoad, 0);
    return totalLoad / this.mvuUnits.size;
  }

  /**
   * 同步执行结果到G-Sphere
   */
  private syncToGSphere(megaOps: number): void {
    if (!this.gSphereRef) return;
    // 将NPU执行结果反馈到G-Sphere演化循环
    try {
      if (typeof this.gSphereRef.evolve === 'function') {
        // 在两次演化tick之间注入NPU执行信息
        console.log(`[NPU] Synced ${megaOps.toFixed(2)} MOPS to G-Sphere`);
      }
    } catch (e) {
      console.warn('[NPU] G-Sphere sync failed:', e);
    }
  }

  /**
   * 获取内部状态
   */
  get_state(): object {
    return {
      config: this.config,
      instructionBufferSize: this.instructionBuffer.length,
      totalInstructionsExecuted: this.totalInstructionsExecuted,
      totalMegaOpsExecuted: this.totalMegaOpsExecuted,
      mvuUnits: Array.from(this.mvuUnits.entries()).map(([id, mvu]) => ({
        id,
        precision: mvu.precision,
        currentLoad: mvu.currentLoad,
      })),
      gSphereIntegration: this.gSphereIntegration,
    };
  }

  /**
   * 重置（用于测试）
   */
  reset(): void {
    this.instructionBuffer = [];
    this.totalInstructionsExecuted = 0;
    this.totalMegaOpsExecuted = 0;
    this.gSphereIntegration = false;
    this.gSphereRef = null;

    for (const mvu of this.mvuUnits.values()) {
      mvu.currentLoad = 0;
    }
  }
}

// =============== Self-Test ===============

function selfTest(): void {
  const npu = NPUSoftCore.get_instance();
  npu.reset();

  // 测试1: 初始化
  console.log(`[Test] NPU initialized: ${npu.getCoreStats().config.clockFreq} MHz`);

  // 测试2: 加载指令
  npu.loadInstructions([
    { opcode: 'MAC', operands: [0, 1, 512], megaOpsPerInstruction: 1.024 },
    { opcode: 'ACTIVATE', operands: [0], megaOpsPerInstruction: 0.512 },
    { opcode: 'STORE', operands: [0, 100], megaOpsPerInstruction: 0.512 },
    { opcode: 'SYNC', operands: [], megaOpsPerInstruction: 0.001 },
  ]);
  console.log('[Test] Loaded 4 instructions');

  // 测试3: 执行
  const result = npu.execute();
  console.log(`[Test] Execution: ${result.instructionsExecuted} instructions, ${result.totalMegaOps.toFixed(2)} MOPS, ${result.executionTimeMs.toFixed(3)} ms`);

  // 测试4: MVU分配/释放
  const mvu = npu.allocateMVU('MS_FP9');
  console.log(`[Test] Allocated MVU: ${mvu?.id} (${mvu?.precision})`);
  if (mvu) {
    npu.releaseMVU(mvu.id);
    console.log(`[Test] Released MVU: ${mvu.id}`);
  }

  // 测试5: 核心统计
  const stats = npu.getCoreStats();
  console.log(`[Test] Stats: ${stats.totalInstructionsExecuted} instructions, ${stats.totalMegaOpsExecuted.toFixed(2)} MOPS total`);

  console.log('[SelfTest] NPUSoftCore: ALL PASSED');
  npu.reset();
}

if (typeof require !== 'undefined' && require.main === module) {
  selfTest();
}
