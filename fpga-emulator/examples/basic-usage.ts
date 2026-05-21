/**
 * FPGA Emulator Usage Example
 * 
 * Demonstrates:
 * 1. Creating emulator
 * 2. Simulating Φ excitation
 * 3. Running evolution
 * 4. Calculating Φ value
 * 
 * Run with: ts-node examples/basic-usage.ts
 */

import { FPGAEmulator } from '../src/fpga-emulator';
import {
  defaultHardwareSpec,
  defaultNetwork7GConfig,
  defaultSimulationConfig,
  defaultInitialConfig
} from '../src/fpga-emulator';
import { TokenType, PhiExcitation } from '../src/types';

async function main(): Promise<void> {
  console.log('=== FPGA Emulator Example ===\n');

  // ============================================
  // 1. Create Emulator
  // ============================================
  console.log('1. Creating FPGA Emulator...\n');

  const emulator = new FPGAEmulator(
    defaultInitialConfig,
    defaultHardwareSpec,
    defaultNetwork7GConfig,
    { ...defaultSimulationConfig, logLevel: 'INFO' }
  );

  console.log('✓ Emulator created');
  console.log(`  - Hardware: ${defaultHardwareSpec.numCLBs} CLBs, ${defaultHardwareSpec.numPRRs} PRRs`);
  console.log(`  - Network: ${defaultNetwork7GConfig.bandwidth} Gbps, ${defaultNetwork7GConfig.latency} ms latency`);
  console.log();

  // ============================================
  // 2. Get Initial State
  // ============================================
  console.log('2. Getting initial state...\n');

  const initialState = emulator.getPhiFieldState();
  console.log(`  - Initial Φ field state:`);
  console.log(`    Timestamp: ${initialState.timestamp}`);
  console.log(`    Excitations: ${initialState.excitations.length}`);
  console.log(`    Winding number: ${initialState.windingNumber}`);
  console.log(`    Resonance score: ${initialState.resonanceScore.toFixed(4)}`);
  console.log();

  // ============================================
  // 3. Simulate Φ Excitation (Φ 场激发仿真)
  // ============================================
  console.log('3. Simulating Φ excitation...\n');

  const excitation: PhiExcitation = {
    id: `exc-${Date.now()}`,
    type: TokenType.CALC,  // 算元 (Calc-Token)
    amplitude: 0.8,  // Excitation amplitude
    phase: Math.PI,  // Phase angle
    position: { x: 50, y: 50 },  // Position in Φ field
    spread: 0.5,  // Gaussian spread σ
    timestamp: Date.now()
  };

  console.log(`  - Excitation: ${excitation.id}`);
  console.log(`    Type: ${excitation.type}`);
  console.log(`    Amplitude: ${excitation.amplitude}`);
  console.log(`    Phase: ${excitation.phase.toFixed(2)} rad`);
  console.log(`    Position: (${excitation.position.x}, ${excitation.position.y})`);
  console.log();

  const request = await emulator.simulatePhiExcitation(excitation);

  if (request) {
    console.log(`  ✓ Excitation triggered PRR reconfiguration:`);
    console.log(`    PRR ID: ${request.prrId}`);
    console.log(`    Status: ${request.status}`);
    console.log(`    Estimated time: ${request.estimatedTime.toFixed(2)} ms`);
  } else {
    console.log(`  ✗ No suitable PRR found for excitation`);
  }
  console.log();

  // ============================================
  // 4. Calculate Φ Value (计算 Φ 值)
  // ============================================
  console.log('4. Calculating Φ value...\n');

  const phiValue = emulator.calculatePhiValue();
  console.log(`  - Φ value: ${phiValue.toFixed(4)}`);
  console.log(`    (Integrated information measure, range [0, 1])`);
  console.log();

  // ============================================
  // 5. Get Updated Φ Field State
  // ============================================
  console.log('5. Getting updated Φ field state...\n');

  const updatedState = emulator.getPhiFieldState();
  console.log(`  - Updated Φ field state:`);
  console.log(`    Excitations: ${updatedState.excitations.length}`);
  console.log(`    Winding number: ${updatedState.windingNumber}`);
  console.log(`    Resonance score: ${updatedState.resonanceScore.toFixed(4)}`);
  console.log();

  // ============================================
  // 6. Manual PRR Reconfiguration (手动 PRR 重配置)
  // ============================================
  console.log('6. Manual PRR reconfiguration...\n');

  const prrs = emulator.getPRRs();
  if (prrs.length > 0) {
    const prr = prrs[0];
    const newConfig = 'A1B2C3D4'.repeat(100);  // Fake bitstream

    console.log(`  - Reconfiguring PRR: ${prr.id}`);
    console.log(`    Name: ${prr.name}`);
    console.log(`    Address range: [${prr.startAddress}, ${prr.endAddress}]`);

    const reconfigRequest = await emulator.reconfigurePRR(
      prr.id,
      newConfig,
      'USER_REQUEST'
    );

    console.log(`  ✓ Reconfiguration complete:`);
    console.log(`    Status: ${reconfigRequest.status}`);
    console.log(`    Time: ${reconfigRequest.estimatedTime.toFixed(2)} ms`);
  } else {
    console.log(`  ✗ No PRRs available`);
  }
  console.log();

  // ============================================
  // 7. Run Short Simulation (运行短仿真)
  // ============================================
  console.log('7. Running short simulation (1 second)...\n');

  const simulationResult = await emulator.runSimulation(
    1000,  // 1 second
    100,  // 100 ms time step
    [
      {
        id: `exc-2-${Date.now()}`,
        type: TokenType.WIT,  // 智元 (Wit-Token)
        amplitude: 0.6,
        phase: Math.PI / 2,
        position: { x: 30, y: 70 },
        spread: 0.3,
        timestamp: Date.now()
      }
    ]
  );

  console.log(`  ✓ Simulation complete:`);
  console.log(`    Config ID: ${simulationResult.config.id}`);
  console.log(`    Field state history: ${simulationResult.fieldStateHistory.length} entries`);
  console.log(`    Reconfiguration events: ${simulationResult.reconfigEvents.length}`);
  console.log(`    Performance metrics:`);
  console.log(`      Avg reconfig time: ${simulationResult.performanceMetrics.avgReconfigTime.toFixed(2)} ms`);
  console.log(`      Throughput: ${simulationResult.performanceMetrics.throughput.toFixed(2)} ops/s`);
  console.log(`      Latency: ${simulationResult.performanceMetrics.latency.toFixed(2)} ms`);
  console.log(`      Energy: ${simulationResult.performanceMetrics.energyConsumption.toFixed(4)} J`);
  console.log(`      Φ value: ${simulationResult.performanceMetrics.phiValue.toFixed(4)}`);
  console.log(`      Fitness score: ${simulationResult.performanceMetrics.fitnessScore.toFixed(4)}`);
  console.log();

  // ============================================
  // 8. Evolve Hardware (进化硬件)
  // ============================================
  console.log('8. Evolving hardware (simplified demo)...\n');

  console.log(`  - This would run evolutionary algorithm to optimize FPGA configuration`);
  console.log(`  - Fitness function: Φ value of configuration`);
  console.log(`  - Due to time constraints, skipping full evolution`);
  console.log(`  - In production, use: emulator.evolveHardware(config, hardwareSpec)`);
  console.log();

  // ============================================
  // 9. Theory Mapping (理论映射)
  // ============================================
  console.log('9. Theory Mapping (理论映射)...\n');

  console.log(`  Based on Paper ②: "7G、AgentWeb 与FPGA优先"`);
  console.log();
  console.log(`  FPGA Concept  →  Φ Field Concept`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  CLB              →  Φ field degree of freedom`);
  console.log(`  Bitstream        →  Φ field configuration state`);
  console.log(`  PRR              →  Localized Φ field excitation`);
  console.log(`  Reconfiguration →  Topological excitation/de-excitation`);
  console.log(`  7G Network       →  Low-dissipation resonance medium`);
  console.log();

  // ============================================
  // 10. Summary (总结)
  // ============================================
  console.log('=== Summary ===\n');

  const finalPhiValue = emulator.calculatePhiValue();
  const finalState = emulator.getPhiFieldState();
  const reconfigHistory = emulator.getReconfigurationHistory();

  console.log(`  - Final Φ value: ${finalPhiValue.toFixed(4)}`);
  console.log(`  - Final winding number: ${finalState.windingNumber}`);
  console.log(`  - Total reconfigurations: ${reconfigHistory.length}`);
  console.log(`  - Theory: FPGA partial reconfiguration ↔ Φ field topological excitation`);
  console.log();

  console.log('✅ Example complete!');
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}
