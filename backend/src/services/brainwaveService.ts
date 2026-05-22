/**
 * Brainwave Service - V5.0 Brainwave整合服务层
 *
 * 整合所有V5.0模块的服务层，提供统一的业务逻辑接口。
 * 使用FPGA Emulator层的核心类进行实际计算。
 */

// V5.0 Brainwave Module Types (local stubs for cross-package compatibility)
declare class SRAMMemoryPool { static get_instance(): SRAMMemoryPool; registerFPGA(fpgaId: string, totalSRAM: number): void; allocate(fpgaId: string, size: number, prrId?: string | null, phiExcitationId?: string | null): any; deallocate(fpgaId: string, regionId: string): boolean; getGlobalAddress(fpgaId: string, localAddr: number): number; syncPhiBoundaries(): Promise<void>; findAvailableFPGA(size: number): string | null; getState(): any; getPoolStats(): any; }
declare class PhiQuantizer { static get_instance(): PhiQuantizer; estimateQuantizationError(phiValue: number, mode?: string): number; quantize(phiValue: number, mode?: string): any; dequantize(quantized: any): number; quantizeComplexPhi(magnitude: number, phase: number, mode?: string): any; dequantizeComplexPhi(quantized: any): { magnitude: number; phase: number }; batchQuantize(phiValues: number[], mode?: string): any[]; selectOptimalPrecision(phiValue: number): string; getState(): any; }
declare class ModelPartitioner { static get_instance(): ModelPartitioner; partition(graph: any, availableFPGAs: any[]): any; assignFPGAs(subGraphs: any[], fpgas: any): any; mapToPhiExcitation(subGraph: any): any; mapToPRR(subGraph: any, prrs: any[]): any; getState(): any; }
declare class NPUSoftCore { static get_instance(): NPUSoftCore; getCoreStats(): any; execute(instruction: any): any; allocateMVU(precision?: string): string | null; integrateWithGSphere(gSphere: any): void; getState(): any; }
declare class CatapultPool { static get_instance(): CatapultPool; registerNode(node: any): void; findOptimalNode(requirement: any): any; calculateLiuScore(node: any, requirement: any): number; allocateFPGAs(nodeId: string, count: number): any; getState(): any; getPoolStats(): any; }
declare class PrecisionValidator { static get_instance(): PrecisionValidator; validate(original: number, quantized: number, threshold?: number): any; batchValidate(originals: number[], quantized: number[], threshold?: number): any; checkRetrainRequired(modelId: string, layerErrors: any[]): any; generateRetrainPlan(trigger: any): any; getState(): any; }

type PrecisionMode = 'MS_FP8' | 'MS_FP9' | 'FP32';
interface DNNComputeGraph { nodes: ComputeNode[]; edges: DataFlowEdge[]; totalParams: number; }
interface ComputeNode { id: string; type: string; params: number; flops: number; sramRequired: number; fpgaAccelerable: boolean; }
interface DataFlowEdge { from: string; to: string; tensorSize: number; }
interface CatapultNode { nodeId: string; dataCenter: string; region: string; fpgaCount: number; totalSRAM: number; liuScore: number; bandwidth: number; latency: number; isActive: boolean; }
interface CatapultAllocation { nodeId: string; fpgaIds: string[]; totalSRAM: number; liuScore: number; }
interface ResourceRequirement { sramRequired: number; region?: string; preferredDataCenter?: string; maxLatency?: number; }

// =============== Service Response Types ===============

interface ServiceResponse<T> {
  code: number;
  data: T;
  message?: string;
}

// =============== Brainwave Service ===============

/**
 * BrainwaveServiceClass: V5.0 Brainwave整合服务
 *
 * 核心方法:
 * - getSRAMPoolStats() - 内存池统计
 * - allocateSRAM() - 分配SRAM
 * - quantizePhi() - Φ值量化
 * - dequantizePhi() - Φ值反量化
 * - partitionModel() - 模型分段
 * - deployModel() - 部署模型
 * - getNPUStats() - NPU统计
 * - getCatapultStats() - 资源池统计
 * - validatePrecision() - 精度验证
 */
class BrainwaveServiceClass {
  private sramPool: SRAMMemoryPool;
  private phiQuantizer: PhiQuantizer;
  private modelPartitioner: ModelPartitioner;
  private npuSoftCore: NPUSoftCore;
  private catapultPool: CatapultPool;
  private precisionValidator: PrecisionValidator;

  // 部署记录
  private deployments: Map<string, {
    graphId: string;
    subGraphs: any[];
    deployedAt: number;
    status: 'deploying' | 'deployed' | 'failed';
  }> = new Map();

  constructor() {
    this.sramPool = SRAMMemoryPool.get_instance();
    this.phiQuantizer = PhiQuantizer.get_instance();
    this.modelPartitioner = ModelPartitioner.get_instance();
    this.npuSoftCore = NPUSoftCore.get_instance();
    this.catapultPool = CatapultPool.get_instance();
    this.precisionValidator = PrecisionValidator.get_instance();

    console.log('[BrainwaveService] V5.0 Brainwave service initialized');
  }

  /**
   * 内存池统计
   */
  getSRAMPoolStats(): ServiceResponse<ReturnType<SRAMMemoryPool['getPoolStats']>> {
    try {
      const stats = this.sramPool.getPoolStats();
      return { code: 0, data: stats };
    } catch (error: any) {
      return { code: 5001, data: {} as any, message: error.message };
    }
  }

  /**
   * 分配SRAM
   */
  allocateSRAM(
    fpgaId: string,
    size: number,
    prrId?: string,
    phiExcitationId?: string
  ): ServiceResponse<{ region: any } | null> {
    try {
      const region = this.sramPool.allocate(fpgaId, size, prrId || null, phiExcitationId || null);
      if (!region) {
        return { code: 5002, data: null, message: 'SRAM allocation failed' };
      }
      return { code: 0, data: { region } };
    } catch (error: any) {
      return { code: 5003, data: null, message: error.message };
    }
  }

  /**
   * 释放SRAM
   */
  deallocateSRAM(fpgaId: string, regionId: string): ServiceResponse<boolean> {
    try {
      const result = this.sramPool.deallocate(fpgaId, regionId);
      if (!result) {
        return { code: 5004, data: false, message: 'SRAM deallocation failed' };
      }
      return { code: 0, data: true };
    } catch (error: any) {
      return { code: 5005, data: false, message: error.message };
    }
  }

  /**
   * Φ值量化
   */
  quantizePhi(
    values: number[],
    mode: PrecisionMode = 'MS_FP8'
  ): ServiceResponse<{ quantized: any[]; errorMetrics: any }> {
    try {
      const quantized = this.phiQuantizer.batchQuantize(values, mode);
      const errorMetrics = this.phiQuantizer.estimateQuantizationError(values[0] || 0, mode);
      return { code: 0, data: { quantized, errorMetrics } };
    } catch (error: any) {
      return { code: 5006, data: { quantized: [], errorMetrics: {} }, message: error.message };
    }
  }

  /**
   * Φ值反量化
   */
  dequantizePhi(quantized: any[]): ServiceResponse<{ values: number[] }> {
    try {
      const values = quantized.map((q: any) => this.phiQuantizer.dequantize(q));
      return { code: 0, data: { values } };
    } catch (error: any) {
      return { code: 5007, data: { values: [] }, message: error.message };
    }
  }

  /**
   * 模型分段
   */
  partitionModel(graph: DNNComputeGraph, sramLimit?: number): ServiceResponse<{ subGraphs: any[] }> {
    try {
      const subGraphs = this.modelPartitioner.partition(graph, sramLimit ? [sramLimit] : []);
      return { code: 0, data: { subGraphs } };
    } catch (error: any) {
      return { code: 5008, data: { subGraphs: [] }, message: error.message };
    }
  }

  /**
   * 部署模型
   */
  deployModel(graphId: string, graph: DNNComputeGraph): ServiceResponse<{
    deploymentId: string;
    subGraphCount: number;
    status: string;
  }> {
    try {
      const deploymentId = `deploy_${Date.now()}`;

      // 1. 分段
      const subGraphs = this.modelPartitioner.partition(graph, []);

      // 2. 为子图分配FPGA
      this.modelPartitioner.assignFPGAs(subGraphs, this.sramPool);

      // 3. 记录部署
      this.deployments.set(deploymentId, {
        graphId,
        subGraphs,
        deployedAt: Date.now(),
        status: 'deployed',
      });

      return {
        code: 0,
        data: {
          deploymentId,
          subGraphCount: subGraphs.length,
          status: 'deployed',
        },
      };
    } catch (error: any) {
      return { code: 5009, data: { deploymentId: '', subGraphCount: 0, status: 'failed' }, message: error.message };
    }
  }

  /**
   * NPU统计
   */
  getNPUStats(): ServiceResponse<ReturnType<NPUSoftCore['getCoreStats']>> {
    try {
      const stats = this.npuSoftCore.getCoreStats();
      return { code: 0, data: stats };
    } catch (error: any) {
      return { code: 5010, data: {} as any, message: error.message };
    }
  }

  /**
   * Catapult资源池统计
   */
  getCatapultStats(): ServiceResponse<ReturnType<CatapultPool['getPoolStats']>> {
    try {
      const stats = this.catapultPool.getPoolStats();
      return { code: 0, data: stats };
    } catch (error: any) {
      return { code: 5011, data: {} as any, message: error.message };
    }
  }

  /**
   * 精度验证
   */
  validatePrecision(
    modelId: string,
    originals: number[],
    quantized: number[],
    threshold: number = 0.01
  ): ServiceResponse<{
    validation: ReturnType<PrecisionValidator['batchValidate']>;
    retrainTriggers: any[];
  }> {
    try {
      const validation = this.precisionValidator.batchValidate(originals, quantized, threshold);

      // 检查是否需要再训练
      const layerErrors = validation.results.map((r: any, i: number) => ({
        layerId: `layer_${i}`,
        error: r.relativeError,
      }));
      const retrainTriggers = this.precisionValidator.checkRetrainRequired(modelId, layerErrors);

      return { code: 0, data: { validation, retrainTriggers } };
    } catch (error: any) {
      return { code: 5012, data: { validation: {} as any, retrainTriggers: [] }, message: error.message };
    }
  }

  /**
   * 注册Catapult节点
   */
  registerCatapultNode(node: CatapultNode): ServiceResponse<CatapultNode> {
    try {
      this.catapultPool.registerNode(node);
      return { code: 0, data: node };
    } catch (error: any) {
      return { code: 5013, data: {} as CatapultNode, message: error.message };
    }
  }

  /**
   * 获取部署信息
   */
  getDeployment(deploymentId: string): ServiceResponse<any> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      return { code: 5014, data: null, message: 'Deployment not found' };
    }
    return { code: 0, data: deployment };
  }

  /**
   * 获取内部状态
   */
  get_state(): object {
    return {
      sramPool: this.sramPool.getState(),
      phiQuantizer: this.phiQuantizer.getState(),
      modelPartitioner: this.modelPartitioner.getState(),
      npuSoftCore: this.npuSoftCore.getState(),
      catapultPool: this.catapultPool.getState(),
      precisionValidator: this.precisionValidator.getState(),
      deploymentCount: this.deployments.size,
    };
  }
}

export const brainwaveService = new BrainwaveServiceClass();
