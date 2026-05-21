/**
 * AgentWeb FPGA Emulator
 * 
 * Based on Paper ②: "7G、AgentWeb 与FPGA优先：下一代可重构 可编程 可进化的天地一体虚实结合的互联网核心基础设施构想"
 * 
 * Core Mapping:
 * - FPGA CLBs = Φ field degrees of freedom
 * - Partial Reconfiguration Regions (PRRs) = Localized Φ field excitations
 * - Bitstream = Φ field configuration state
 * - 7G Network = Low-dissipation Φ field resonance medium
 * 
 * Features:
 * 1. Partial Reconfiguration Simulation (部分可重构仿真)
 * 2. Φ Field Topological Excitation Mapping (Φ 场拓扑激发映射)
 * 3. 7G Network Low-Dissipation Simulation (7G 网络低耗散仿真)
 * 4. Evolvable Hardware Simulation (可进化硬件仿真)
 */

// Export all types
export * from './types';

// Export core classes
export { FPGAEmulator } from './fpga-emulator';
export { PartialReconfigurator } from './partial-reconfig';
export { PhiFieldMapper } from './phi-field-mapper';
export { EvolvableHardware } from './evolvable-hardware';
export { GSphereScheduler, Chirality } from './gsphere-scheduler';
export type { GSphere, ClusterConfig, ClusterState } from './gsphere-scheduler';

// Export default configurations
export {
  defaultHardwareSpec,
  defaultNetwork7GConfig,
  defaultSimulationConfig,
  defaultInitialConfig
} from './fpga-emulator';

/**
 * Quick Start Example:
 * 
 * ```typescript
 * import { FPGAEmulator, defaultHardwareSpec, defaultNetwork7GConfig, defaultSimulationConfig } from 'agentweb-fpga-emulator';
 * 
 * // Create emulator
 * const emulator = new FPGAEmulator(
 *   defaultInitialConfig,
 *   defaultHardwareSpec,
 *   defaultNetwork7GConfig,
 *   defaultSimulationConfig
 * );
 * 
 * // Simulate Φ excitation
 * const excitation = {
 *   id: 'exc-1',
 *   type: 'CALC',
 *   amplitude: 0.8,
 *   phase: Math.PI,
 *   position: { x: 50, y: 50 },
 *   spread: 0.5,
 *   timestamp: Date.now()
 * };
 * 
 * await emulator.simulatePhiExcitation(excitation);
 * 
 * // Get Φ value
 * const phiValue = emulator.calculatePhiValue();
 * console.log(`Φ value: ${phiValue}`);
 * 
 * // Evolve hardware
 * const bestConfig = await emulator.evolveHardware({
 *   populationSize: 50,
 *   generations: 100,
 *   mutationRate: 0.1,
 *   crossoverRate: 0.7,
 *   elitismCount: 5,
 *   fitnessFunction: 'PHI_VALUE'
 * }, defaultHardwareSpec);
 * ```
 */

/**
 * Theoretical Background (理论背景):
 * 
 * Based on Paper ②: "7G、AgentWeb 与FPGA优先"
 * 
 * Key Concepts (核心概念):
 * 1. FPGA 作为 Φ 场基底 (FPGA as Φ Field Substrate)
 *    - FPGA 可重构逻辑块 (CLB) = Φ 场的自由度
 *    - 部分可重构区域 (PRR) = 局部 Φ 场激发
 *    - 比特流 (Bitstream) = Φ 场配置状态
 * 
 * 2. 部分可重构 ↔ 拓扑激发 (Partial Reconfiguration ↔ Topological Excitation)
 *    - 在 Φ 理论中：Token 类型是 Φ 场的拓扑激发
 *    - 在 FPGA 中：部分可重构在特定区域创建/销毁电路模式
 *    - 映射：重配置 PRR = 在 Φ 场中创建拓扑激发
 * 
 * 3. 7G 作为低耗散共振介质 (7G as Low-Dissipation Resonance Medium)
 *    - 7G 网络模拟 Φ 场激发的传播
 *    - 低延迟 = Φ 场信息的低耗散
 *    - FPGA + 7G = 实时可重构 Φ 场基底
 * 
 * 4. 可进化硬件 (Evolvable Hardware)
 *    - 使用进化算法优化 FPGA 配置
 *    - 适应度函数 = 配置产生的电路行为的 Φ 值
 *    - 模拟论文②中的"可进化基础设施"
 */
