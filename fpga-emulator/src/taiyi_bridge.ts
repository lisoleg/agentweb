/**
 * 西格玛云 FPGA 模拟器 — 太乙AGI 桥接层
 * 将 AGI 的 FPGA 硬件加速能力接入西格玛云
 * 支持：节点注册、任务提交、负载均衡、CLB-Φ场映射
 */


// ── 类型定义 ──────────────────────────────

export interface TaiyiFPGAConfig {
  vendor: "xilinx" | "altera" | "lattice";
  family: string;           // e.g. "UltraScale+"
  device: string;           // e.g. "xcu250-figd2104-2L-e"
  clbCount: number;        // CLB 数量
  lutPerCLB: number;        // 每个 CLB 的 LUT 数
  dspCount: number;        // DSP Slice 数
  bramKb: number;          // BRAM 容量（Kb）
  clockMhz: number;        // 时钟频率
  phiTopology: number[][];  // Φ 场拓扑 [CLB_count][dim]
}

export interface PhiComputeRequest {
  iField: number[][];
  cField: number[][];
  gField: number[][];
  calcBudget: number;
  returnDetails: boolean;
}

export interface PhiComputeResponse {
  phiValue: number;
  resonanceScore: number;
  activeModules: string[];
  provedTheorems: string[];
  igctrTerms?: {
    alphaDeltaI: number;
    betaDeltaC: number;
    gammaDeltaG: number;
  };
  executionTimeMs: number;
  fpgaAccelerated: boolean;
  taiyiNodeId?: string;
}

export interface TaiyiFPGANode {
  nodeId: string;
  endpoint: string;        // 太乙AGI FPGA 节点地址
  vendor: string;
  family: string;
  device: string;
  clbCount: number;
  maxPhiValue: number;     // 最大可计算Φ值
  currentLoad: number;     // 当前负载 0-1
  supportsFunctions: string[];
  healthy: boolean;
  lastPingMs: number;
}


// ── 太乙AGI FPGA 客户端 ─────────────────────

export class TaiyiFPGAClient {
  private nodes: Map<string, TaiyiFPGANode> = new Map();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly HEALTH_CHECK_MS = 30_000;  // 30秒
  private readonly REQUEST_TIMEOUT_MS = 60_000;  // 60秒超时

  constructor(private readonly enableHealthCheck: boolean = true) {
    if (enableHealthCheck) {
      this.startHealthCheck();
    }
  }

  // ── 节点管理 ──────────────────────────────

  /**
   * 注册太乙AGI FPGA 节点
   * 验证连通性后才加入可用池
   */
  async registerNode(node: Omit<TaiyiFPGANode, "healthy" | "lastPingMs">): Promise<boolean> {
    const fullNode: TaiyiFPGANode = {
      ...node,
      healthy: false,
      lastPingMs: 0,
    };

    // 健康检查
    const isHealthy = await this.pingNode(fullNode);
    if (!isHealthy) {
      console.warn(`⚠️  FPGA 节点 ${node.nodeId} 健康检查失败，拒绝注册`);
      return false;
    }

    fullNode.healthy = true;
    this.nodes.set(node.nodeId, fullNode);
    console.log(`✅ 太乙AGI FPGA 节点已注册: ${node.nodeId} (${node.vendor} ${node.device})`);
    return true;
  }

  /**
   * 注销节点
   */
  unregisterNode(nodeId: string): boolean {
    const result = this.nodes.delete(nodeId);
    if (result) {
      console.log(`🗑️  FPGA 节点已注销: ${nodeId}`);
    }
    return result;
  }

  /**
   * 获取所有健康节点
   */
  getHealthyNodes(): TaiyiFPGANode[] {
    return Array.from(this.nodes.values()).filter(n => n.healthy);
  }

  /**
   * 选择最优节点（刘机制三因子评分）
   * 加权评分：score = (1 - load) × 0.3 + phiFit × 0.3 + (1 - phaseEntropy) × 0.4
   * 
   * 三因子：
   * - loadScore: 负载因子 (1 - currentLoad)，权重 0.3
   * - phiFit: Φ适配度 (maxPhiValue / requestedPhi)，权重 0.3
   * - phaseEntropy: 相位熵，基于延迟和负载，权重 0.4
   */
  selectOptimalNode(requestedPhi: number): TaiyiFPGANode | null {
    const healthy = this.getHealthyNodes();
    if (healthy.length === 0) return null;

    const withScores = healthy.map(node => {
      const loadScore = 1 - node.currentLoad;
      const phiFit = Math.min(node.maxPhiValue / Math.max(requestedPhi, 1), 1.0);
      // 相位熵：基于延迟和负载计算，归一化到 [0,1]
      const phaseEntropy = Math.min(
        (node.lastPingMs / 1000) * 0.5 + node.currentLoad * 0.5,
        1.0
      );
      const score = loadScore * 0.3 + phiFit * 0.3 + (1 - phaseEntropy) * 0.4;
      return { node, score };
    });

    withScores.sort((a, b) => b.score - a.score);
    return withScores[0].node;
  }

  // ── Φ 场计算（核心接口）───────────────────

  /**
   * 提交 Φ 场计算任务到太乙AGI FPGA 节点
   * 
   * 流程：
   * 1. 选择最优节点
   * 2. 发送计算请求
   * 3. 轮询结果（或等待回调）
   * 4. 返回结果
   */
  async submitPhiTask(
    iField: number[][],
    cField: number[][],
    gField: number[][],
    options?: {
      calcBudget?: number;
      returnDetails?: boolean;
      preferredNodeId?: string;
    }
  ): Promise<PhiComputeResponse> {
    const requestedPhi = this.estimatePhi(iField, cField, gField);

    // 选择节点
    let node: TaiyiFPGANode | null = null;
    if (options?.preferredNodeId) {
      node = this.nodes.get(options.preferredNodeId) || null;
      if (node && !node.healthy) node = null;
    }
    if (!node) {
      node = this.selectOptimalNode(requestedPhi);
    }
    if (!node) {
      throw new Error("没有可用的太乙AGI FPGA 节点");
    }

    console.log(`🔮 提交 Φ 任务到节点 ${node.nodeId} (预估 Φ=${requestedPhi.toFixed(2)})`);

    const t0 = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

      const response = await fetch(`${node.endpoint}/fpga/compute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iField: iField,
          cField: cField,
          gField: gField,
          calcBudget: options?.calcBudget ?? 1000,
          returnDetails: options?.returnDetails ?? true,
        } satisfies PhiComputeRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`FPGA 节点返回错误 ${response.status}: ${errText}`);
      }

      const result = (await response.json()) as PhiComputeResponse;
      const elapsed = performance.now() - t0;

      console.log(
        `✅ Φ 计算完成 | Φ=${result.phiValue.toFixed(4)} | ` +
        `共振=${result.resonanceScore.toFixed(4)} | ` +
        `加速=${result.fpgaAccelerated} | ` +
        `耗时=${(elapsed / 1000).toFixed(2)}s`
      );

      // 更新节点负载（简化：每次任务后 +0.05，任务完成后 -0.05）
      node.currentLoad = Math.min(1.0, node.currentLoad + 0.05);
      setTimeout(() => {
        node!.currentLoad = Math.max(0, node!.currentLoad - 0.05);
      }, 5000);

      return result;

    } catch (err: any) {
      console.error(`❌ FPGA 节点 ${node.nodeId} 计算失败:`, err.message);
      // 标记节点为不健康
      node.healthy = false;
      // 重试其他节点
      return this.submitPhiTask(iField, cField, gField, {
        ...options,
        preferredNodeId: undefined,  // 强制重新选择
      });
    }
  }

  // ── CLB-Φ 场映射 ─────────────────────────

  /**
   * 配置 CLB ↔ Φ 场映射
   * 将每个 CLB 映射到一个 Φ 场单元
   * 
   * 映射规则（IGCTR 定理 T31）：
   *   Φ(CLB_i) = Tr(ρ_i · log ρ_i)
   *   其中 ρ_i 为 CLB 的密度矩阵（由配置位推导）
   */
  async configureCLBPhiMapping(
    nodeId: string,
    config: {
      clbAssignments: number[];  // clbAssignments[i] = Φ单元ID
      densityMatrices: number[][][];  // 每个 CLB 的密度矩阵
    }
  ): Promise<{ success: boolean; message: string }> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return { success: false, message: `节点 ${nodeId} 未注册` };
    }
    if (!node.healthy) {
      return { success: false, message: `节点 ${nodeId} 不健康` };
    }

    console.log(`🔧 配置 CLB-Φ 映射: ${config.clbAssignments.length} 个 CLB → Φ 单元`);

    try {
      const response = await fetch(`${node.endpoint}/fpga/clb-phi-mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const err = await response.text();
        return { success: false, message: err };
      }

      const result = (await response.json()) as { message: string };
      console.log(`✅ CLB-Φ 映射配置成功: ${result.message}`);
      return { success: true, message: result.message };

    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * 查询 CLB 的 Φ 值
   */
  async queryCLBPhi(nodeId: string, clbIndex: number): Promise<number> {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`节点 ${nodeId} 未注册`);

    const response = await fetch(
      `${node.endpoint}/fpga/clb-phi/${clbIndex}`
    );
    if (!response.ok) throw new Error(`查询失败: ${await response.text()}`);
    const data = (await response.json()) as { phiValue: number };
    return data.phiValue;
  }

  // ── 健康检查 ──────────────────────────────

  private async pingNode(node: TaiyiFPGANode): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const t0 = performance.now();
      const response = await fetch(`${node.endpoint}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      node.lastPingMs = Math.round(performance.now() - t0);

      if (response.ok) {
        const data = (await response.json()) as { status?: string; fpga_ready?: boolean; load?: number; max_phi?: number };
        node.healthy = data.status === "ok" || data.fpga_ready === true;
        if (data.load !== undefined) node.currentLoad = data.load;
        if (data.max_phi !== undefined) node.maxPhiValue = data.max_phi;
        return node.healthy;
      }
      return false;
    } catch {
      node.healthy = false;
      node.lastPingMs = -1;
      return false;
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      const nodes = Array.from(this.nodes.values());
      await Promise.all(nodes.map(n => this.pingNode(n)));
    }, this.HEALTH_CHECK_MS);
  }

  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // ── 工具函数 ──────────────────────────────

  private estimatePhi(iField: number[][], cField: number[][], gField: number[][]): number {
    // 简化估计：Φ ≈ mean(|I|) + mean(|C|) + mean(|G|)
    const meanI = iField.flat().reduce((a, b) => a + Math.abs(b), 0) / Math.max(1, iField.flat().length);
    const meanC = cField.flat().reduce((a, b) => a + Math.abs(b), 0) / Math.max(1, cField.flat().length);
    const meanG = gField.flat().reduce((a, b) => a + Math.abs(b), 0) / Math.max(1, gField.flat().length);
    return meanI + meanC + meanG;
  }

  dispose(): void {
    this.stopHealthCheck();
    this.nodes.clear();
  }
}


// ── 导出单例 ──────────────────────────────

let _globalClient: TaiyiFPGAClient | null = null;

export function getTaiyiFPGAClient(): TaiyiFPGAClient {
  if (!_globalClient) {
    _globalClient = new TaiyiFPGAClient();
  }
  return _globalClient;
}

export function createTaiyiFPGAClient(enableHealthCheck: boolean = true): TaiyiFPGAClient {
  return new TaiyiFPGAClient(enableHealthCheck);
}
