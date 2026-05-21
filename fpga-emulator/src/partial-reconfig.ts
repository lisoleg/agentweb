/**
 * Partial Reconfiguration Simulation for FPGA Emulator
 * 
 * Based on Paper ②: FPGA partial reconfiguration corresponds to
 * Φ field topological excitation/reconfiguration (部分可重构对应 Φ 场的拓扑激发/重配)
 * 
 * This module simulates:
 * 1. Defining Partial Reconfiguration Regions (PRRs)
 * 2. Reconfiguring PRRs without affecting other regions
 * 3. Timestamp tracking for reconfiguration events
 * 4. Bitstream segmentation and management
 */

import { PRR, FPGAConfig } from './types';

/**
 * Partial Reconfigurator Class
 * 
 * Simulates FPGA partial reconfiguration capability
 */
export class PartialReconfigurator {
  private prrs: Map<string, PRR>;
  private hardwareSpec: {
    numCLBs: number;
    numPRRs: number;
    clbTypes: string[];
    interconnectTopology: string;
  };
  private reconfigCounter: number;

  constructor(hardwareSpec: {
    numCLBs: number;
    numPRRs: number;
    clbTypes: string[];
    interconnectTopology: string;
  }) {
    this.prrs = new Map();
    this.hardwareSpec = hardwareSpec;
    this.reconfigCounter = 0;

    // Initialize PRRs
    this.initializePRRs();
  }

  // =============== PRR Management ===============

  /**
   * Define a new Partial Reconfiguration Region (PRR)
   * Equivalent to: Creating a localized Φ field excitation region
   */
  definePRR(
    id: string,
    name: string,
    startAddress: number,
    endAddress: number,
    initialConfig?: string
  ): PRR {
    if (this.prrs.has(id)) {
      throw new Error(`PRR ${id} already exists`);
    }

    if (startAddress < 0 || endAddress >= this.hardwareSpec.numCLBs) {
      throw new Error(`Address out of range: [${startAddress}, ${endAddress}]`);
    }

    if (startAddress > endAddress) {
      throw new Error(`Invalid address range: start ${startAddress} > end ${endAddress}`);
    }

    // Check overlap with existing PRRs
    for (const [, existingPRR] of this.prrs) {
      if (this.checkOverlap(startAddress, endAddress, existingPRR.startAddress, existingPRR.endAddress)) {
        throw new Error(`PRR ${id} overlaps with existing PRR ${existingPRR.id}`);
      }
    }

    const prr: PRR = {
      id,
      name,
      startAddress,
      endAddress,
      currentConfig: initialConfig || '0'.repeat(endAddress - startAddress + 1),
      isReconfiguring: false
    };

    this.prrs.set(id, prr);

    console.log(`[PartialReconfigurator] Defined PRR ${id}: [${startAddress}, ${endAddress}]`);

    return { ...prr };
  }

  /**
   * Reconfigure a PRR with new bitstream
   * Equivalent to: Creating/modifying a Φ field topological excitation
   */
  reconfigure(prrId: string, newConfig: string): void {
    const prr = this.prrs.get(prrId);

    if (!prr) {
      throw new Error(`PRR ${prrId} not found`);
    }

    if (prr.isReconfiguring) {
      throw new Error(`PRR ${prrId} is already being reconfigured`);
    }

    // Validate new configuration size
    const expectedSize = prr.endAddress - prr.startAddress + 1;
    if (newConfig.length!== expectedSize * 2) {  // Hex string = 2 chars per byte
      throw new Error(`Configuration size mismatch: expected ${expectedSize * 2}, got ${newConfig.length}`);
    }

    // Mark as reconfiguring
    prr.isReconfiguring = true;

    try {
      // Simulate reconfiguration delay (will be handled by emulator)
      // Here we just update the configuration
      prr.currentConfig = newConfig;
      prr.lastReconfigTime = Date.now();
      this.reconfigCounter++;

      console.log(`[PartialReconfigurator] Reconfigured PRR ${prrId} (${this.reconfigCounter} total reconfigurations)`);
    } finally {
      prr.isReconfiguring = false;
    }
  }

  /**
   * Get PRR state
   */
  getPRRState(prrId: string): PRR | null {
    const prr = this.prrs.get(prrId);
    return prr ? { ...prr } : null;
  }

  /**
   * Get all PRRs
   */
  getAllPRRs(): PRR[] {
    return Array.from(this.prrs.values()).map(prr => ({ ...prr }));
  }

  /**
   * Delete a PRR
   */
  deletePRR(prrId: string): boolean {
    return this.prrs.delete(prrId);
  }

  /**
   * Reset all PRRs to initial state (all zeros)
   * Equivalent to: Collapsing all Φ field excitations
   */
  resetAllPRRs(): void {
    for (const [, prr] of this.prrs) {
      const size = prr.endAddress - prr.startAddress + 1;
      prr.currentConfig = '0'.repeat(size * 2);  // Hex string
      prr.lastReconfigTime = undefined;
    }

    console.log(`[PartialReconfigurator] Reset all ${this.prrs.size} PRRs`);
  }

  /**
   * Get reconfiguration statistics
   */
  getStats(): {
    totalPRRs: number;
    totalReconfigurations: number;
    averageReconfigTime: number;
    activePRRs: number;  // PRRs with non-zero config
  } {
    const prrs = this.getAllPRRs();
    const activePRRs = prrs.filter(
      prr => prr.currentConfig!.replace('0', '').length > 0
    ).length;

    return {
      totalPRRs: prrs.length,
      totalReconfigurations: this.reconfigCounter,
      averageReconfigTime: 0,  // TODO: Track timing
      activePRRs
    };
  }

  // =============== Bitstream Management ===============

  /**
   * Extract bitstream segment for a specific PRR
   * Equivalent to: Measuring localized Φ field excitation
   */
  extractBitstreamSegment(config: FPGAConfig, prrId: string): string {
    const prr = this.prrs.get(prrId);

    if (!prr) {
      throw new Error(`PRR ${prrId} not found`);
    }

    const startByte = Math.floor(prr.startAddress / 2);  // Simplified: 1 CLB = 2 hex chars
    const lengthBytes = Math.ceil((prr.endAddress - prr.startAddress + 1) / 2);

    const segment = config.bitstream.substring(startByte * 2, (startByte + lengthBytes) * 2);
    return segment;
  }

  /**
   * Merge PRR configuration back into full bitstream
   * Equivalent to: Integrating localized Φ field excitation into global field
   */
  mergeBitstreamSegment(
    baseConfig: FPGAConfig,
    prrId: string,
    prrConfig: string
  ): string {
    const prr = this.prrs.get(prrId);

    if (!prr) {
      throw new Error(`PRR ${prrId} not found`);
    }

    const startByte = Math.floor(prr.startAddress / 2);
    const lengthBytes = Math.ceil((prr.endAddress - prr.startAddress + 1) / 2);

    const before = baseConfig.bitstream.substring(0, startByte * 2);
    const after = baseConfig.bitstream.substring((startByte + lengthBytes) * 2);

    return before + prrConfig + after;
  }

  // =============== Φ Field Mapping (Helper Methods) ===============

  /**
   * Map Φ field excitation to PRR
   * In Φ theory: Excitation creates a localized field deformation
   * In FPGA: Excitation triggers PRR reconfiguration
   */
  mapExcitationToPRR(
    excitationAmplitude: number,
    excitationPosition: { x: number; y: number },
    fieldSize: { width: number; height: number }
  ): string | null {
    // Find PRR that contains the excitation position
    for (const [, prr] of this.prrs) {
      const prrX = Math.floor(prr.startAddress % fieldSize.width);
      const prrY = Math.floor(prr.startAddress / fieldSize.width);
      const prrWidth = Math.min(prr.endAddress - prr.startAddress + 1, fieldSize.width - prrX);
      const prrHeight = Math.ceil((prr.endAddress - prr.startAddress + 1) / fieldSize.width);

      if (
        excitationPosition.x >= prrX &&
        excitationPosition.x < prrX + prrWidth &&
        excitationPosition.y >= prrY &&
        excitationPosition.y < prrY + prrHeight
      ) {
        return prr.id;
      }
    }

    return null;  // No suitable PRR found
  }

  /**
   * Calculate phase gradient between two PRR configurations
   * Equivalent to: Measuring Φ field phase gradient between two regions
   */
  calculatePhaseGradient(prrId1: string, prrId2: string): number {
    const prr1 = this.prrs.get(prrId1);
    const prr2 = this.prrs.get(prrId2);

    if (!prr1 || !prr2) {
      throw new Error(`PRR not found`);
    }

    // Simplified: Calculate "phase" as average hex value
    const phase1 = this.averageHexValue(prr1.currentConfig);
    const phase2 = this.averageHexValue(prr2.currentConfig);

    const gradient = Math.abs(phase2 - phase1);
    return gradient;
  }

  /**
   * Detect topological transition in PRR configuration
   * Equivalent to: Detecting Φ field topological phase transition
   */
  detectTopologicalTransition(prrId: string): boolean {
    const prr = this.prrs.get(prrId);

    if (!prr) {
      throw new Error(`PRR ${prrId} not found`);
    }

    // Simplified: Transition detected if configuration changes from all zeros to non-zero
    const hasExcitation = prr.currentConfig!.replace('0', '').length > 0;
    const hadExcitation = prr.lastReconfigTime!== undefined;

    // Transition = excitation appeared or disappeared
    const transition = hasExcitation!!== hadExcitation;

    return transition;
  }

  // =============== Private Helper Methods ===============

  private initializePRRs(): void {
    // Automatically partition FPGA into equal-sized PRRs
    const clbsPerPRR = Math.floor(this.hardwareSpec.numCLBs / this.hardwareSpec.numPRRs);

    for (let i = 0; i < this.hardwareSpec.numPRRs; i++) {
      const startAddress = i * clbsPerPRR;
      const endAddress = (i + 1) * clbsPerPRR - 1;

      this.definePRR(
        `prr-${i}`,
        `PRR_${String(i).padStart(2, '0')}`,
        startAddress,
        endAddress
      );
    }

    console.log(`[PartialReconfigurator] Initialized ${this.hardwareSpec.numPRRs} PRRs`);
  }

  private checkOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number
  ): boolean {
    return start1 <= end2 && start2 <= end1;
  }

  private averageHexValue(hexString: string): number {
    if (hexString.length === 0) return 0;

    let sum = 0;
    for (let i = 0; i < hexString.length; i++) {
      const char = hexString[i];
      const value = parseInt(char, 16);
      if (!isNaN(value)) {
        sum += value;
      }
    }

    return sum / hexString.length;
  }
}
