/**
 * Φ Field Mapper for FPGA Emulator
 * 
 * Maps between Φ field excitations and FPGA configurations:
 * - Φ excitation → PRR reconfiguration
 * - Bitstream → Φ field state
 * 
 * Based on Paper ②: FPGA partial reconfiguration corresponds to
 * Φ field topological excitation/reconfiguration
 */

import { PhiExcitation, PRR, TokenType, PhiFieldState } from './types';
import { PartialReconfigurator } from './partial-reconfig';

/**
 * PhiFieldMapper Class
 * 
 * Maps between Φ field concepts and FPGA hardware concepts
 */
export class PhiFieldMapper {
  private reconfigurator: PartialReconfigurator;
  private fieldSize: { width: number; height: number };
  private excitationToPRRMap: Map<string, string>;  // excitationId → prrId
  private prrToExcitationMap: Map<string, string>;  // prrId → excitationId

  constructor() {
    this.reconfigurator = new PartialReconfigurator({
      numCLBs: 1000,
      numPRRs: 10,
      clbTypes: ['LUT', 'FF', 'MUX'],
      interconnectTopology: 'MESH'
    });
    this.fieldSize = { width: 100, height: 100 };  // 100x100 Φ field grid
    this.excitationToPRRMap = new Map();
    this.prrToExcitationMap = new Map();
  }

  /**
   * Map Φ excitation to suitable PRR
   * Core mapping: Φ excitation → FPGA partial reconfiguration
   */
  mapExcitationToPRR(
    excitation: PhiExcitation,
    availablePRRs: PRR[]
  ): PRR | null {
    // Strategy 1: Find PRR containing excitation position
    const containingPRR = this.findContainingPRR(excitation.position, availablePRRs);
    if (containingPRR) {
      this.recordMapping(excitation.id, containingPRR.id);
      return containingPRR;
    }

    // Strategy 2: Find nearest free PRR
    const nearestPRR = this.findNearestFreePRR(excitation.position, availablePRRs);
    if (nearestPRR) {
      this.recordMapping(excitation.id, nearestPRR.id);
      return nearestPRR;
    }

    // Strategy 3: Find PRR with compatible TokenType
    const compatiblePRR = this.findCompatiblePRR(excitation.type, availablePRRs);
    if (compatiblePRR) {
      this.recordMapping(excitation.id, compatiblePRR.id);
      return compatiblePRR;
    }

    // No suitable PRR found
    console.warn(`[PhiFieldMapper] No suitable PRR found for excitation ${excitation.id}`);
    return null;
  }

  /**
   * Map bitstream to Φ field excitation parameters
   * Reverse mapping: FPGA configuration → Φ field state
   */
  mapBitstreamToExcitation(
    bitstream: string,
    prr: PRR
  ): PhiExcitation {
    // Extract PRR segment from bitstream
    const segment = bitstream.substring(
      prr.startAddress * 2,
      (prr.endAddress + 1) * 2
    );

    // Calculate excitation parameters from bitstream segment
    const amplitude = this.calculateAmplitude(segment);
    const phase = this.calculatePhase(segment);
    const position = this.calculatePosition(prr);
    const spread = this.calculateSpread(segment);
    const tokenType = this.inferTokenType(segment);

    const excitation: PhiExcitation = {
      id: `exc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: tokenType,
      amplitude,
      phase,
      position,
      spread,
      timestamp: Date.now()
    };

    this.recordMapping(excitation.id, prr.id);

    return excitation;
  }

  /**
   * Convert Φ excitation to bitstream segment
   * Maps excitation parameters to FPGA configuration
   */
  excitationToBitstream(excitation: PhiExcitation): string {
    // Convert excitation parameters to hex string
    // This is a simplified mapping - real implementation would be more complex

    const amplitudeHex = this.amplitudeToHex(excitation.amplitude);
    const phaseHex = this.phaseToHex(excitation.phase);
    const positionHex = this.positionToHex(excitation.position);
    const spreadHex = this.spreadToHex(excitation.spread);
    const typeHex = this.tokenTypeToHex(excitation.type);

    // Combine into bitstream segment (simplified)
    const segment = amplitudeHex + phaseHex + positionHex + spreadHex + typeHex;

    return segment;
  }

  /**
   * Calculate phase gradient between two PRRs
   * Equivalent to: Φ field phase gradient between two regions
   */
  calculatePhaseGradient(prr1: PRR, prr2: PRR, bitstream: string): number {
    const segment1 = bitstream.substring(
      prr1.startAddress * 2,
      (prr1.endAddress + 1) * 2
    );
    const segment2 = bitstream.substring(
      prr2.startAddress * 2,
      (prr2.endAddress + 1) * 2
    );

    const phase1 = this.calculatePhase(segment1);
    const phase2 = this.calculatePhase(segment2);

    const gradient = Math.abs(phase2 - phase1);
    return gradient;
  }

  /**
   * Calculate winding number from phase gradient
   * Topological invariant: measures how many times phase wraps around 2π
   */
  calculateWindingNumber(phaseGradients: number[][]): number {
    let windingNumber = 0;

    // Simplified: Count phase wraps in 2D grid
    for (let i = 0; i < phaseGradients.length - 1; i++) {
      for (let j = 0; j < phaseGradients[i].length - 1; j++) {
        const dPhase = phaseGradients[i + 1][j] - phaseGradients[i][j];

        // Phase wrap detection
        if (dPhase > Math.PI) windingNumber++;
        if (dPhase < -Math.PI) windingNumber--;
      }
    }

    return windingNumber;
  }

  /**
   * Detect topological phase transition
   * Equivalent to: Φ field undergoing phase transition
   */
  detectTopologicalTransition(
    beforeState: PhiFieldState,
    afterState: PhiFieldState
  ): boolean {
    // Transition detected if:
    // 1. Winding number changes
    // 2. Resonance score changes significantly
    // 3. New excitation appears/disappears

    const windingChange = beforeState.windingNumber !== afterState.windingNumber;
    const resonanceChange = Math.abs(afterState.resonanceScore - beforeState.resonanceScore) > 0.1;
    const excitationChange = beforeState.excitations.length !== afterState.excitations.length;

    return windingChange || resonanceChange || excitationChange;
  }

  /**
   * Get mapped PRR for excitation
   */
  getMappedPRR(excitationId: string): string | null {
    return this.excitationToPRRMap.get(excitationId) || null;
  }

  /**
   * Get mapped excitation for PRR
   */
  getMappedExcitation(prrId: string): string | null {
    return this.prrToExcitationMap.get(prrId) || null;
  }

  /**
   * Clear all mappings
   */
  clearMappings(): void {
    this.excitationToPRRMap.clear();
    this.prrToExcitationMap.clear();
  }

  // =============== Private Helper Methods ===============

  private findContainingPRR(
    position: { x: number; y: number },
    prrs: PRR[]
  ): PRR | null {
    // Simplified: Assume PRRs are arranged in a grid
    const prrWidth = this.fieldSize.width / Math.sqrt(prrs.length);
    const prrHeight = this.fieldSize.height / Math.sqrt(prrs.length);

    for (const prr of prrs) {
      const prrCol = parseInt(prr.id.split('-')[1]) % Math.sqrt(prrs.length);
      const prrRow = Math.floor(parseInt(prr.id.split('-')[1]) / Math.sqrt(prrs.length));

      const prrX = prrCol * prrWidth;
      const prrY = prrRow * prrHeight;

      if (
        position.x >= prrX &&
        position.x < prrX + prrWidth &&
        position.y >= prrY &&
        position.y < prrY + prrHeight
      ) {
        return prr;
      }
    }

    return null;
  }

  private findNearestFreePRR(
    position: { x: number; y: number },
    prrs: PRR[]
  ): PRR | null {
    // Find PRRs not currently mapped to any excitation
    const freePRRs = prrs.filter(prr => !this.prrToExcitationMap.has(prr.id));

    if (freePRRs.length === 0) return null;

    // Find nearest by Euclidean distance
    let nearest: PRR | null = null;
    let minDistance = Infinity;

    for (const prr of freePRRs) {
      const prrCenter = this.calculatePRRCenter(prr);
      const distance = Math.sqrt(
        Math.pow(position.x - prrCenter.x, 2) +
        Math.pow(position.y - prrCenter.y, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = prr;
      }
    }

    return nearest;
  }

  private findCompatiblePRR(
    tokenType: TokenType,
    prrs: PRR[]
  ): PRR | null {
    // Simplified: Just return first free PRR
    // Real implementation would consider TokenType compatibility
    return prrs.find(prr => !this.prrToExcitationMap.has(prr.id)) || null;
  }

  private recordMapping(excitationId: string, prrId: string): void {
    this.excitationToPRRMap.set(excitationId, prrId);
    this.prrToExcitationMap.set(prrId, excitationId);
  }

  private calculateAmplitude(bitstreamSegment: string): number {
    // Simplified: Amplitude = normalized Hamming weight
    const hammingWeight = bitstreamSegment
      .split('')
      .filter(c => c === '1')
      .length;
    const maxWeight = bitstreamSegment.length;
    return hammingWeight / maxWeight;
  }

  private calculatePhase(bitstreamSegment: string): number {
    // Simplified: Phase = average hex value * 2π
    let sum = 0;
    for (let i = 0; i < bitstreamSegment.length; i += 2) {
      const byte = parseInt(bitstreamSegment.substring(i, i + 2), 16);
      sum += byte;
    }
    const avg = sum / (bitstreamSegment.length / 2);
    return (avg / 255) * 2 * Math.PI;
  }

  private calculatePosition(prr: PRR): { x: number; y: number } {
    // Simplified: Position = center of PRR
    return this.calculatePRRCenter(prr);
  }

  private calculatePRRCenter(prr: PRR): { x: number; y: number } {
    const prrIndex = parseInt(prr.id.split('-')[1]);
    const gridSize = Math.sqrt(this.reconfigurator.getAllPRRs().length);
    const prrWidth = this.fieldSize.width / gridSize;
    const prrHeight = this.fieldSize.height / gridSize;

    const col = prrIndex % gridSize;
    const row = Math.floor(prrIndex / gridSize);

    return {
      x: col * prrWidth + prrWidth / 2,
      y: row * prrHeight + prrHeight / 2
    };
  }

  private calculateSpread(bitstreamSegment: string): number {
    // Simplified: Spread = variance of hex values
    const bytes: number[] = [];
    for (let i = 0; i < bitstreamSegment.length; i += 2) {
      bytes.push(parseInt(bitstreamSegment.substring(i, i + 2), 16));
    }

    const mean = bytes.reduce((a, b) => a + b, 0) / bytes.length;
    const variance = bytes.reduce((sum, b) => sum + Math.pow(b - mean, 2), 0) / bytes.length;

    return Math.sqrt(variance) / 255;  // Normalized
  }

  private inferTokenType(bitstreamSegment: string): TokenType {
    // Simplified: Infer TokenType from bitstream pattern
    const firstByte = parseInt(bitstreamSegment.substring(0, 2), 16);

    if (firstByte < 64) return TokenType.CALC;  // 0x00-0x3F
    if (firstByte < 128) return TokenType.WIT;   // 0x40-0x7F
    if (firstByte < 192) return TokenType.WORD;  // 0x80-0xBF
    return TokenType.PASS;  // 0xC0-0xFF
  }

  private amplitudeToHex(amplitude: number): string {
    const byteValue = Math.floor(amplitude * 255);
    return byteValue.toString(16).padStart(2, '0');
  }

  private phaseToHex(phase: number): string {
    const byteValue = Math.floor((phase / (2 * Math.PI)) * 255);
    return byteValue.toString(16).padStart(2, '0');
  }

  private positionToHex(position: { x: number; y: number }): string {
    const xHex = Math.floor(position.x).toString(16).padStart(4, '0');
    const yHex = Math.floor(position.y).toString(16).padStart(4, '0');
    return xHex + yHex;
  }

  private spreadToHex(spread: number): string {
    const byteValue = Math.floor(spread * 255);
    return byteValue.toString(16).padStart(2, '0');
  }

  private tokenTypeToHex(tokenType: TokenType): string {
    switch (tokenType) {
      case TokenType.CALC: return '00';
      case TokenType.WIT: return '01';
      case TokenType.WORD: return '02';
      case TokenType.PASS: return '03';
    }
  }
}
