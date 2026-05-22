/**
 * FPGA Metabolism Hardware Mapping Types — V10.0
 *
 * Maps biological metabolism concepts to FPGA hardware:
 * - Base Metabolic Rate ↔ FPGA idle power consumption
 * - Effective Metabolic Rate ↔ FPGA active compute throughput
 * - Aging ↔ FPGA bitstream degradation over time
 * - Hibernation ↔ FPGA low-power sleep mode
 * - Regeneration ↔ FPGA bitstream refresh/reconfiguration
 */

// =============== Metabolism Phase ===============

export type MetabolismPhase = 'GROWTH' | 'STABLE' | 'AGING' | 'HIBERNATION' | 'REGENERATION';

// =============== FPGA Metabolism State ===============

export interface FPGAMetabolismState {
  fpgaId: string;
  baseMetabolicRate: number;       // 基础代谢率 (0-10000), 对应FPGA空闲功耗
  effectiveMetabolicRate: number;   // 有效代谢率 (0-10000), 对应FPGA活跃吞吐量
  age: number;                      // FPGA运行周期数
  agingRate: number;               // 衰老速率 (基点/周期), 对应bitstream退化
  hibernating: boolean;            // 是否低功耗休眠
  hibernationStart: number;        // 休眠开始时间戳
  regenerationCount: number;       // bitstream刷新次数
  lastActivityEpoch: number;       // 最近活跃周期
  phase: MetabolismPhase;          // 当前代谢阶段
}

// =============== Hardware Mapping ===============

export interface MetabolismHardwareMapping {
  baseMetabolicRate: {
    biological: '基础代谢率';
    fpga: '空闲功耗基线';
    unit: 'mW';
    range: [0, 10000];
  };
  effectiveMetabolicRate: {
    biological: '有效代谢率';
    fpga: '活跃计算吞吐量';
    unit: 'FLOPS';
    range: [0, 10000];
  };
  aging: {
    biological: '衰老';
    fpga: 'bitstream退化';
    indicator: '时序裕量衰减';
  };
  hibernation: {
    biological: '冬眠';
    fpga: '低功耗休眠模式';
    powerReduction: '90%';
  };
  regeneration: {
    biological: '再生';
    fpga: 'bitstream刷新/部分重配置';
    trigger: '时序违例检测';
  };
}

// =============== Metabolism Event ===============

export interface MetabolismEvent {
  fpgaId: string;
  eventType: 'UPDATE' | 'HIBERNATE' | 'WAKE' | 'REGENERATE' | 'PHASE_CHANGE';
  oldPhase: MetabolismPhase;
  newPhase: MetabolismPhase;
  oldRate: number;
  newRate: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

// =============== Metabolism Config ===============

export interface MetabolismConfig {
  initialBaseRate: number;         // 初始基础代谢率 (default 5000)
  agingThresholdEpoch: number;     // 开始衰老的周期 (default 30)
  agingRateBps: number;           // 衰老速率基点 (default 100 = 1%/epoch)
  hibernationRateReduction: number; // 冬眠代谢率降幅 (default 0.1 = 90%)
  regenerationBoost: number;      // 再生恢复比例 (0-10000)
  maxRegenerationCount: number;    // 最大再生次数
}
