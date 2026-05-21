/**
 * FPGA Emulator Types for AgentWeb Sigma Cloud V2.0
 * 
 * Based on Paper ②: "7G、AgentWeb 与FPGA优先：下一代可重构 可编程 可进化的天地一体虚实结合的互联网核心基础设施构想"
 * 
 * Core Concept: FPGA Partial Reconfiguration ↔ Φ Field Topological Excitation
 * - FPGA CLBs (Configurable Logic Blocks) = Φ field degrees of freedom
 * - Partial Reconfiguration Regions (PRRs) = Localized Φ field excitations
 * - Bitstream = Φ field configuration state
 */

// =============== FPGA Hardware Types ===============

export interface FPGAConfig {
  id: string;
  bitstream: string;  // Hex string representing FPGA configuration
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PRR (PartialReconfigurationRegion) {
  id: string;
  name: string;
  startAddress: number;  // Bitstream address range
  endAddress: number;
  currentConfig: string;  // Current bitstream segment
  isReconfiguring: boolean;
  lastReconfigTime?: number;
}

export interface CLB (ConfigurableLogicBlock) {
  id: string;
  x: number;  // Grid position
  y: number;
  function: CLBFunction;
  inputs: number[];  // Input signal IDs
  outputs: number[];  // Output signal IDs
  configuration: string;  // LUT (Look-Up Table) configuration
}

export enum CLBFunction {
  LUT = "LUT",  // Look-Up Table
  FF = "FF",  // Flip-Flop
  MUX = "MUX",  // Multiplexer
  CARRY = "CARRY",  // Carry chain
  BRAM = "BRAM",  // Block RAM
  DSP = "DSP"  // Digital Signal Processing
}

// =============== Φ Field Types ===============

export interface PhiExcitation {
  id: string;
  type: TokenType;  // Calc | Wit | Word | Pass (from Prisma schema)
  amplitude: number;  // Excitation amplitude (0-1)
  phase: number;  // Phase angle (0-2π)
  position: { x: number; y: number };  // Position in Φ field
  spread: number;  // Gaussian spread σ
  timestamp: number;
}

export enum TokenType {
  CALC = "CALC",  // 算元 - Wave Kernel
  WIT = "WIT",  // 智元 - Particle Kernel
  WORD = "WORD",  // 词元 - Wave Kernel
  PASS = "PASS"  // 通证 - Particle Kernel
}

export interface PhiFieldState {
  timestamp: number;
  excitations: PhiExcitation[];
  phaseGradient: number[][];  // 2D phase gradient map
  windingNumber: number;  // Topological winding number
  resonanceScore: number;  // Field resonance score (0-1)
}

// =============== Reconfiguration Types ===============

export interface ReconfigurationRequest {
  id: string;
  prrId: string;
  newConfig: string;  // New bitstream segment
  trigger: ReconfigurationTrigger;
  priority: number;  // 0-1, higher = more urgent
  estimatedTime: number;  // ms
  status: ReconfigurationStatus;
}

export enum ReconfigurationTrigger {
  PHI_EXCITATION = "PHI_EXCITATION",  // Triggered by Φ field excitation
  USER_REQUEST = "USER_REQUEST",  // Manual user request
  EVOLUTION = "EVOLUTION",  // Evolutionary algorithm optimization
  ADAPTATION = "ADAPTATION"  // Adaptive reconfiguration
}

export enum ReconfigurationStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}

// =============== Evolutionary Hardware Types ===============

export interface EvolutionConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;  // 0-1
  crossoverRate: number;  // 0-1
  elitismCount: number;  // Number of top individuals preserved
  fitnessFunction: FitnessFunctionType;
}

export enum FitnessFunctionType {
  PHI_VALUE = "PHI_VALUE",  // Maximize Φ value
  THROUGHPUT = "THROUGHPUT",  // Maximize throughput
  LATENCY = "LATENCY",  // Minimize latency
  ENERGY = "ENERGY",  // Minimize energy consumption
  CUSTOM = "CUSTOM"  // User-defined fitness function
}

export interface HardwareSpec {
  numCLBs: number;
  numPRRs: number;
  clbTypes: CLBFunction[];
  interconnectTopology: TopologyType;
  constraints?: Record<string, any>;
}

export enum TopologyType {
  MESH = "MESH",  // 2D mesh
  TORUS = "TORUS",  // 2D torus
  TREE = "TREE",  // Tree
  HYPERCUBE = "HYPERCUBE"  // Hypercube
}

// =============== 7G Network Types ===============

export interface Network7GConfig {
  bandwidth: number;  // Gbps
  latency: number;  // ms
  reliability: number;  // 0-1
  dissipationFactor: number;  // Φ field dissipation factor (lower = better)
  resonanceFrequency: number;  // Hz, for Φ field resonance
}

export interface ResonanceMedium {
  type: "7G" | "OPTICAL" | "QUANTUM";
  propagationSpeed: number;  // m/s
  dissipationRate: number;  // Φ field dissipation per meter
  noiseLevel: number;  // 0-1
}

// =============== Simulation Types ===============

export interface SimulationConfig {
  duration: number;  // ms
  timeStep: number;  // ms
  enableEvolution: boolean;
  enable7GSimulation: boolean;
  logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
}

export interface SimulationResult {
  config: FPGAConfig;
  fieldStateHistory: PhiFieldState[];
  reconfigEvents: ReconfigurationRequest[];
  performanceMetrics: PerformanceMetrics;
}

export interface PerformanceMetrics {
  avgReconfigTime: number;  // ms
  throughput: number;  // operations/second
  latency: number;  // ms
  energyConsumption: number;  // Joules
  phiValue: number;  // Average Φ value
  fitnessScore: number;  // Overall fitness score
}

// =============== G-Sphere Types ===============

export interface GSphereNode {
  id: string;
  info: number;
  portCount: number;
  chirality: 1 | -1;
  position: { x: number; y: number };
}

export interface ClusterEvolutionConfig {
  maxSpheres: number;
  evolutionIntervalMs: number;
  lagrangianAlpha: number;
  lagrangianBeta: number;
  couplingStrength: number;
}
