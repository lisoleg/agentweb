/**
 * Type declarations for FPGA Emulator module
 * These are re-exported types from the fpga-emulator package
 */

declare module '../../fpga-emulator/src/index' {
  export class SRAMMemoryPool {
    constructor(config?: any);
    registerFPGA(fpgaId: string, totalSRAM: number): void;
    allocate(fpgaId: string, size: number, prrId?: string): any;
    deallocate(allocationId: string): boolean;
    getGlobalAddress(fpgaId: string, localAddr: number): number;
    syncPhiBoundaries(): Promise<void>;
    findAvailableFPGA(size: number): string | null;
    getState(): any;
  }

  export class PhiQuantizer {
    constructor(config?: any);
    quantize(phiValue: number, mode?: string): any;
    dequantize(quantized: any): number;
    quantizeComplexPhi(magnitude: number, phase: number, mode?: string): any;
    dequantizeComplexPhi(quantized: any): { magnitude: number; phase: number };
    batchQuantize(phiValues: number[], mode?: string): any[];
    selectOptimalPrecision(phiValue: number): string;
    getState(): any;
  }

  export class ModelPartitioner {
    constructor(config?: any);
    partition(graph: any, availableFPGAs: any[]): any;
    assignFPGAs(subGraphs: any[], fpgas: any[]): any;
    mapToPhiExcitation(subGraph: any): any;
    mapToPRR(subGraph: any, prrs: any[]): any;
    getState(): any;
  }

  export class NPUSoftCore {
    constructor(config?: any);
    execute(instruction: any): any;
    allocateMVU(precision?: string): string | null;
    integrateWithGSphere(gSphere: any): void;
    getState(): any;
  }

  export class CatapultPool {
    constructor(config?: any);
    registerNode(node: any): void;
    findOptimalNode(requirement: any): any;
    calculateLiuScore(node: any, requirement: any): number;
    allocateFPGAs(nodeId: string, count: number): any;
    getState(): any;
  }

  export class PrecisionValidator {
    constructor(config?: any);
    validate(original: number, quantized: number, threshold?: number): any;
    batchValidate(values: any[], threshold?: number): any[];
    checkRetrainRequired(results: any[]): any;
    generateRetrainPlan(trigger: any): any;
    getState(): any;
  }
}

declare module '../../fpga-emulator/src/types' {
  export type PrecisionMode = 'MS_FP8' | 'MS_FP9' | 'FP32';

  export interface BRAMRegion {
    id: string;
    startAddr: number;
    size: number;
    prrId: string | null;
    phiExcitationId: string | null;
  }

  export interface SRAMPoolNode {
    fpgaId: string;
    totalSRAM: number;
    usedSRAM: number;
    blockRamRegions: BRAMRegion[];
    phiBoundarySync: number;
  }

  export interface DNNComputeGraph {
    nodes: ComputeNode[];
    edges: DataFlowEdge[];
    totalParams: number;
  }

  export interface ComputeNode {
    id: string;
    type: string;
    params: number;
    flops: number;
    sramRequired: number;
    fpgaAccelerable: boolean;
  }

  export interface DataFlowEdge {
    from: string;
    to: string;
    tensorSize: number;
  }

  export interface CatapultNode {
    nodeId: string;
    dataCenter: string;
    region: string;
    fpgaCount: number;
    totalSRAM: number;
    liuScore: number;
    bandwidth: number;
    latency: number;
    isActive: boolean;
  }

  export interface CatapultPoolConfig {
    liuLoadWeight: number;
    liuPhiFitWeight: number;
    liuPhaseEntropyWeight: number;
  }

  export interface PrecisionValidationResult {
    originalValue: number;
    quantizedValue: number;
    absoluteError: number;
    relativeError: number;
    passesThreshold: boolean;
    threshold: number;
  }

  export interface RetrainTrigger {
    modelId: string;
    layerId: string;
    currentError: number;
    maxAcceptableError: number;
    retrainRequired: boolean;
  }
}

declare module '../../fpga-emulator/src/catapultPool' {
  export interface CatapultAllocation {
    nodeId: string;
    fpgaIds: string[];
    totalSRAM: number;
    liuScore: number;
  }

  export interface ResourceRequirement {
    sramRequired: number;
    region?: string;
    preferredDataCenter?: string;
    maxLatency?: number;
  }
}
