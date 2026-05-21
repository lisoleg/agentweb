/**
 * G-Sphere (Gold Spirit Sphere) Scheduler
 * 金灵球团簇调度器
 *
 * 基于 Paper 3 "太一万有理论白皮书" 的金灵球概念：
 * - 每个节点是一个 G-Sphere：(info, portCount, chirality) 三元组
 * - info: 信息量（Φ 模长）
 * - portCount: 端口数（连接度）
 * - chirality: 手性（+1=右旋/费米子, -1=左旋/玻色子）
 *
 * 离散欧拉-拉格朗日演化：
 * dL/dq - d/dt(dL/dq̇) = 0
 * 其中 q = (info, portCount), q̇ = (dinfo/dt, dportCount/dt)
 */

import { PhiFieldState, PhiExcitation, TokenType } from './types';

// =============== G-Sphere Types ===============

export interface GSphere {
  id: string;
  info: number;        // 信息量 = |Φ|
  portCount: number;    // 连接端口数
  chirality: Chirality; // 手性
  position: { x: number; y: number };
  velocity: { dx: number; dy: number }; // 演化速度
  energy: number;       // 拉格朗日量
  lastUpdate: number;
}

export enum Chirality {
  RIGHT = 1,   // 右旋 = 费米子型（排他锁）
  LEFT = -1,    // 左旋 = 玻色子型（共享锁）
}

export interface ClusterConfig {
  maxSpheres: number;
  evolutionInterval: number; // ms
  lagrangianAlpha: number;   // 动能权重
  lagrangianBeta: number;    // 势能权重
  couplingStrength: number;  // 耦合强度
}

export interface ClusterState {
  spheres: GSphere[];
  totalEnergy: number;
  totalInfo: number;
  avgConnectivity: number;
  chiralityBalance: number; // R/L 比例
  timestamp: number;
}

// =============== GSphere Scheduler ===============

export class GSphereScheduler {
  private spheres: Map<string, GSphere> = new Map();
  private config: ClusterConfig;
  private evolutionTimer: ReturnType<typeof setInterval> | null = null;
  private stateHistory: ClusterState[] = [];

  constructor(config?: Partial<ClusterConfig>) {
    this.config = {
      maxSpheres: 100,
      evolutionInterval: 5000,
      lagrangianAlpha: 0.5,
      lagrangianBeta: 0.5,
      couplingStrength: 0.1,
      ...config,
    };
  }

  /**
   * 添加 G-Sphere 到集群
   */
  addSphere(sphere: Omit<GSphere, 'energy' | 'lastUpdate' | 'velocity'>): GSphere {
    if (this.spheres.size >= this.config.maxSpheres) {
      throw new Error(`Max spheres (${this.config.maxSpheres}) reached`);
    }

    const fullSphere: GSphere = {
      ...sphere,
      velocity: { dx: 0, dy: 0 },
      energy: this.calculateLagrangian(sphere.info, sphere.portCount, sphere.chirality),
      lastUpdate: Date.now(),
    };

    this.spheres.set(sphere.id, fullSphere);
    console.log(`🔮 G-Sphere added: ${sphere.id} (info=${sphere.info.toFixed(2)}, ports=${sphere.portCount}, χ=${sphere.chirality})`);
    return fullSphere;
  }

  /**
   * 移除 G-Sphere
   */
  removeSphere(id: string): boolean {
    return this.spheres.delete(id);
  }

  /**
   * 获取所有 G-Sphere
   */
  getAllSpheres(): GSphere[] {
    return Array.from(this.spheres.values());
  }

  /**
   * 执行离散欧拉-拉格朗日演化
   *
   * L = α·T(info, portCount) - β·V(info, portCount)
   * 其中:
   *   T = 0.5 * (dinfo/dt)² + 0.5 * (dportCount/dt)²  (动能项)
   *   V = -coupling * Σ(info_i * info_j) / r_ij        (势能项)
   *
   * EL方程: d/dt(∂L/∂q̇) - ∂L/∂q = 0
   */
  evolve(): ClusterState {
    const dt = this.config.evolutionInterval / 1000; // 秒
    const spheres = Array.from(this.spheres.values());

    for (const sphere of spheres) {
      // 1. 计算势能梯度（来自其他球的影响）
      const force = this.calculateForce(sphere, spheres);

      // 2. 更新速度（欧拉法）
      sphere.velocity.dx += force.fx * dt;
      sphere.velocity.dy += force.fy * dt;

      // 3. 更新位置
      sphere.position.x += sphere.velocity.dx * dt;
      sphere.position.y += sphere.velocity.dy * dt;

      // 4. 更新信息量（演化核心）
      // dinfo/dt = ∂L/∂info = chirality * coupling * Σ(info_j / r_ij)
      const infoDelta = this.calculateInfoDelta(sphere, spheres, dt);
      sphere.info = Math.max(0.01, sphere.info + infoDelta);

      // 5. 更新端口数
      // portCount 基于连接数动态调整
      const connections = this.countConnections(sphere, spheres);
      sphere.portCount = connections;

      // 6. 更新拉格朗日量
      sphere.energy = this.calculateLagrangian(sphere.info, sphere.portCount, sphere.chirality);
      sphere.lastUpdate = Date.now();
    }

    // 生成集群状态
    const state = this.getClusterState();
    this.stateHistory.push(state);

    // 只保留最近100个状态
    if (this.stateHistory.length > 100) {
      this.stateHistory.shift();
    }

    return state;
  }

  /**
   * 获取集群状态
   */
  getClusterState(): ClusterState {
    const spheres = Array.from(this.spheres.values());
    const totalEnergy = spheres.reduce((sum, s) => sum + s.energy, 0);
    const totalInfo = spheres.reduce((sum, s) => sum + s.info, 0);
    const avgConnectivity = spheres.length > 0
      ? spheres.reduce((sum, s) => sum + s.portCount, 0) / spheres.length
      : 0;
    const rightCount = spheres.filter(s => s.chirality === Chirality.RIGHT).length;
    const leftCount = spheres.filter(s => s.chirality === Chirality.LEFT).length;
    const chiralityBalance = leftCount > 0 ? rightCount / leftCount : Infinity;

    return {
      spheres,
      totalEnergy,
      totalInfo,
      avgConnectivity,
      chiralityBalance,
      timestamp: Date.now(),
    };
  }

  /**
   * 启动自动演化
   */
  startEvolution(): void {
    if (this.evolutionTimer) return;
    this.evolutionTimer = setInterval(() => {
      this.evolve();
    }, this.config.evolutionInterval);
    console.log(`🔄 G-Sphere 自动演化启动 (间隔: ${this.config.evolutionInterval}ms)`);
  }

  /**
   * 停止自动演化
   */
  stopEvolution(): void {
    if (this.evolutionTimer) {
      clearInterval(this.evolutionTimer);
      this.evolutionTimer = null;
      console.log('⏹️ G-Sphere 自动演化停止');
    }
  }

  /**
   * 从 Φ 场状态同步 G-Sphere
   */
  syncFromPhiField(fieldState: PhiFieldState): number {
    let synced = 0;
    for (const excitation of fieldState.excitations) {
      const existingSphere = this.spheres.get(excitation.id);
      if (existingSphere) {
        // 更新现有球
        existingSphere.info = excitation.amplitude;
        existingSphere.position = excitation.position;
        existingSphere.chirality = this.inferChirality(excitation.type);
        synced++;
      } else {
        // 创建新球
        this.addSphere({
          id: excitation.id,
          info: excitation.amplitude,
          portCount: 1,
          chirality: this.inferChirality(excitation.type),
          position: excitation.position,
        });
        synced++;
      }
    }
    return synced;
  }

  // =============== Private Methods ===============

  private calculateLagrangian(info: number, portCount: number, chirality: Chirality): number {
    const kinetic = this.config.lagrangianAlpha * 0.5 * info * info;
    const potential = -this.config.lagrangianBeta * chirality * info * Math.log(portCount + 1);
    return kinetic - potential;
  }

  private calculateForce(sphere: GSphere, allSpheres: GSphere[]): { fx: number; fy: number } {
    let fx = 0;
    let fy = 0;
    const coupling = this.config.couplingStrength;

    for (const other of allSpheres) {
      if (other.id === sphere.id) continue;

      const dx = other.position.x - sphere.position.x;
      const dy = other.position.y - sphere.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1) continue; // 避免除零

      // 耦合力: F = coupling * (info_i * info_j) / r²
      // 手性相同 = 吸引, 手性相反 = 排斥
      const chiralitySign = sphere.chirality === other.chirality ? 1 : -1;
      const forceMag = coupling * chiralitySign * sphere.info * other.info / (dist * dist);

      fx += forceMag * dx / dist;
      fy += forceMag * dy / dist;
    }

    return { fx, fy };
  }

  private calculateInfoDelta(sphere: GSphere, allSpheres: GSphere[], dt: number): number {
    let delta = 0;
    for (const other of allSpheres) {
      if (other.id === sphere.id) continue;

      const dx = other.position.x - sphere.position.x;
      const dy = other.position.y - sphere.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1) continue;

      // 信息交换: 手性同 = 共振(增强), 手性异 = 干涉(抑制)
      const couplingSign = sphere.chirality === other.chirality ? 1 : -0.5;
      delta += couplingSign * this.config.couplingStrength * other.info / (dist + 1) * dt;
    }

    // 衰减项
    delta -= 0.01 * sphere.info * dt;

    return delta;
  }

  private countConnections(sphere: GSphere, allSpheres: GSphere[]): number {
    let count = 0;
    for (const other of allSpheres) {
      if (other.id === sphere.id) continue;
      const dx = other.position.x - sphere.position.x;
      const dy = other.position.y - sphere.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 30) count++; // 30 单位内的连接
    }
    return count;
  }

  private inferChirality(tokenType: TokenType): Chirality {
    // 费米子型(CALC, WIT) = 右旋, 玻色子型(WORD, PASS) = 左旋
    return (tokenType === TokenType.CALC || tokenType === TokenType.WIT)
      ? Chirality.RIGHT
      : Chirality.LEFT;
  }

  dispose(): void {
    this.stopEvolution();
    this.spheres.clear();
    this.stateHistory = [];
  }
}
