/**
 * Simple test for FPGA Emulator
 * 
 * Run with: npm test
 */

import { FPGAEmulator } from '../src/fpga-emulator';
import {
  defaultHardwareSpec,
  defaultNetwork7GConfig,
  defaultSimulationConfig,
  defaultInitialConfig
} from '../src/fpga-emulator';
import { TokenType, ReconfigurationTrigger } from '../src/types';

/**
 * Test 1: Basic emulator creation
 */
export async function testBasicCreation(): Promise<void> {
  console.log('Test 1: Basic emulator creation');

  const emulator = new FPGAEmulator(
    defaultInitialConfig,
    defaultHardwareSpec,
    defaultNetwork7GConfig,
    defaultSimulationConfig
  );

  const config = emulator.getConfig();
  console.assert(config.id === 'fpga-default', 'Config ID should match');
  console.log('✓ Basic creation test passed');
}

/**
 * Test 2: Basic excitation simulation
 */
export async function testExcitationSimulation(): Promise<void> {
  console.log('Test 2: Excitation simulation');

  const emulator = new FPGAEmulator(
    defaultInitialConfig,
    defaultHardwareSpec,
    defaultNetwork7GConfig,
    { ...defaultSimulationConfig, logLevel: 'DEBUG' }
  );

  const excitation = {
    id: 'test-exc-1',
    type: TokenType.CALC,
    amplitude: 0.8,
    phase: Math.PI,
    position: { x: 50, y: 50 },
    spread: 0.5,
    timestamp: Date.now()
  };

  const request = await emulator.simulatePhiExcitation(excitation);

  console.assert(request!= null, 'Should return a reconfiguration request');
  console.log('✓ Excitation simulation test passed');
}

/**
 * Test 3: PRR reconfiguration
 */
export async function testPRRReconfiguration(): Promise<void> {
  console.log('Test 3: PRR reconfiguration');

  const emulator = new FPGAEmulator(
    defaultInitialConfig,
    defaultHardwareSpec,
    defaultNetwork7GConfig,
    defaultSimulationConfig
  );

  const prrs = emulator.getPRRs();
  console.assert(prrs.length > 0, 'Should have at least 1 PRR');

  const prrId = prrs[0].id;
  const newConfig = 'A1B2C3D4'.repeat(100);  // Fake bitstream

  const request = await emulator.reconfigurePRR(
    prrId,
    newConfig,
    ReconfigurationTrigger.USER_REQUEST
  );

  console.assert(request.status === 'COMPLETED', 'Reconfiguration should complete');
  console.log('✓ PRR reconfiguration test passed');
}

/**
 * Test 4: Φ value calculation
 */
export async function testPhiValueCalculation(): Promise<void> {
  console.log('Test 4: Φ value calculation');

  const emulator = new FPGAEmulator(
    defaultInitialConfig,
    defaultHardwareSpec,
    defaultNetwork7GConfig,
    defaultSimulationConfig
  );

  // Load a non-zero bitstream
  const testBitstream = 'A'.repeat(1000);  // All 'A' = some pattern
  emulator.loadBitstream(testBitstream);

  const phiValue = emulator.calculatePhiValue();
  console.assert(phiValue >= 0 && phiValue <= 1, 'Φ value should be [0, 1]');

  console.log(`Φ value: ${phiValue.toFixed(4)}`);
  console.log('✓ Φ value calculation test passed');
}

/**
 * Test 5: Get Φ field state
 */
export async function testGetPhiFieldState(): Promise<void> {
  console.log('Test 5: Get Φ field state');

  const emulator = new FPGAEmulator(
    defaultInitialConfig,
    defaultHardwareSpec,
    defaultNetwork7GConfig,
    defaultSimulationConfig
  );

  const state = emulator.getPhiFieldState();

  console.assert(state.timestamp > 0, 'Timestamp should be positive');
  console.assert(Array.isArray(state.excitations), 'Excitations should be array');
  console.assert(Array.isArray(state.phaseGradient), 'Phase gradient should be array');

  console.log('✓ Get Φ field state test passed');
}

/**
 * Test 6: Run short simulation
 */
export async function testRunSimulation(): Promise<void> {
  console.log('Test 6: Run short simulation');

  const emulator = new FPGAEmulator(
    defaultInitialConfig,
    defaultHardwareSpec,
    defaultNetwork7GConfig,
    { ...defaultSimulationConfig, duration: 1000, timeStep: 100 }  // 1 second
  );

  const result = await emulator.runSimulation(
    1000,  // 1 second
    100,  // 100 ms steps
    [
      {
        id: 'exc-1',
        type: TokenType.CALC,
        amplitude: 0.8,
        phase: Math.PI,
        position: { x: 50, y: 50 },
        spread: 0.5,
        timestamp: Date.now()
      }
    ]
  );

  console.assert(result.config!= null, 'Result should have config');
  console.assert(Array.isArray(result.fieldStateHistory), 'Should have field state history');
  console.assert(result.performanceMetrics!= null, 'Should have performance metrics');

  console.log('✓ Run simulation test passed');
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<void> {
  console.log('=== FPGA Emulator Tests ===\n');

  try {
    await testBasicCreation();
    await testExcitationSimulation();
    await testPRRReconfiguration();
    await testPhiValueCalculation();
    await testGetPhiFieldState();
    await testRunSimulation();

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests
if (require.main === module) {
  runAllTests().catch(console.error);
}
