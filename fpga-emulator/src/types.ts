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

export interface PartialReconfigurationRegion {
  id: string;
  name: string;
  startAddress: number;  // Bitstream address range
  endAddress: number;
  currentConfig: string;  // Current bitstream segment
  isReconfiguring: boolean;
  lastReconfigTime?: number;
}

/** Alias for PartialReconfigurationRegion */
export type PRR = PartialReconfigurationRegion;

export interface ConfigurableLogicBlock {
  id: string;
  x: number;  // Grid position
  y: number;
  func: CLBFunction;
  inputs: number[];  // Input signal IDs
  outputs: number[];  // Output signal IDs
  configuration: string;  // LUT (Look-Up Table) configuration
}

/** Alias for ConfigurableLogicBlock */
export type CLB = ConfigurableLogicBlock;

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

// =============== V5.0 Brainwave Integration Types ===============

// --- P0-1: Φ-SRAM Memory Pool ---
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

export interface GlobalSRAMPool {
  nodes: Map<string, SRAMPoolNode>;
  totalCapacity: number;
  totalUsed: number;
  interFpgaLatency: number;
  phiFieldSyncInterval: number;
}

// --- P0-2: Φ Quantization Engine ---
export type PrecisionMode = 'MS_FP8' | 'MS_FP9' | 'FP32';

export interface MsFp8 {
  sign: 0 | 1;
  exponent: number;
  mantissa: number;
}

export interface MsFp9 {
  sign: 0 | 1;
  exponent: number;
  mantissa: number;
}

export interface QuantizedPhi {
  magnitude: MsFp8 | MsFp9;
  phase: number;
  originalPhi: number;
  quantizationError: number;
  mode: PrecisionMode;
}

// --- P0-3: Model Partitioner ---
export type ComputeNodeType = 'CONV' | 'FC' | 'POOL' | 'ACTIVATE' | 'NORM' | 'CUSTOM';

export interface ComputeNode {
  id: string;
  type: ComputeNodeType;
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

export interface DNNComputeGraph {
  nodes: ComputeNode[];
  edges: DataFlowEdge[];
  totalParams: number;
}

export interface SubGraph {
  id: string;
  nodes: string[];
  targetFpgaId: string;
  sramAllocated: number;
  phiExcitationId: string | null;
  prrBinding: string | null;
}

// --- P1-1: NPU Soft Core ---
export type SIMDOpcode = 'MAC' | 'LOAD' | 'STORE' | 'ACTIVATE' | 'SYNC';

export interface NPUSIMDInstruction {
  opcode: SIMDOpcode;
  operands: number[];
  megaOpsPerInstruction: number;
}

export interface MVUnit {
  id: string;
  precision: PrecisionMode;
  accumulatorSize: number;
  currentLoad: number;
}

export interface NPUSoftCoreConfig {
  id: string;
  clockFreq: number;
  opsPerCycle: number;
  simdWidth: number;
  mvuUnits: MVUnit[];
}

// --- P1-2: Catapult Pool ---
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

// --- P1-3: Precision Validator ---
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

// =============== V7.0 Supernode Alignment Types ===============

// --- V7.0-1: Liu Deterministic Path Pinning ---
export interface PinnedPath {
  flowId: string;
  primaryNodeId: string;
  backupNodeId: string | null;
  pinnedAt: number;
  lastUsed: number;
  switchCount: number;
  phiPhaseContinuity: number;  // Φ相位连续性评分 0-1
}

export interface PathPinConfig {
  virtualNodeCount: number;
  faultDetectionTimeoutMs: number;
  maxSwitchCount: number;
  backupCount: number;
  phiPhaseThreshold: number;
}

export interface PathSwitchEvent {
  flowId: string;
  fromNodeId: string;
  toNodeId: string;
  reason: 'FAULT' | 'PHASE_DISCONTINUITY' | 'MANUAL';
  timestamp: number;
}

// --- V7.0-2: Φ-CacheTier Three-Layer Storage ---
export type CacheTier = 'HOT' | 'WARM' | 'COLD';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  tier: CacheTier;
  phiScore: number;
  createdAt: number;
  lastAccessedAt: number;
  ttlMs: number;
  accessCount: number;
  sizeBytes: number;
  metadata?: Record<string, any>;
}

export interface CacheTierStats {
  tier: CacheTier;
  entryCount: number;
  totalSizeBytes: number;
  hitRate: number;
  avgPhiScore: number;
  avgAccessCount: number;
  evictionCount: number;
}

export interface PhiCacheConfig {
  hotMaxBytes: number;
  warmMaxBytes: number;
  coldMaxBytes: number;
  warmTtlMs: number;
  coldTtlMs: number;
  phiHotThreshold: number;
  phiWarmThreshold: number;
  evictionPolicy: 'LRU' | 'PHI_PRIORITY' | 'HYBRID';
}

// --- V7.0-3: Four-Dimensional ResourceProfile ---
export interface ResourceProfile {
  compute: number;
  memoryBandwidth: number;
  memoryCapacity: number;
  ioBandwidth: number;
}

export interface NodeResource {
  nodeId: string;
  computeAvailable: number;
  computeTotal: number;
  memoryBandwidthAvailable: number;
  memoryBandwidthTotal: number;
  memoryCapacityAvailable: number;
  memoryCapacityTotal: number;
  ioBandwidthAvailable: number;
  ioBandwidthTotal: number;
  loadFactor: number;
  phiFit: number;
  phaseEntropy: number;
}

export type ScenarioType = 'M78_INFERENCE' | 'M84_PHI_COMPUTE' | 'PHI402_MICROPAYMENT' | 'MODEL_LOADING' | 'GENERAL';

export interface ResourceScore {
  nodeId: string;
  overallScore: number;
  computeScore: number;
  memoryBandwidthScore: number;
  memoryCapacityScore: number;
  ioBandwidthScore: number;
  liuScore: number;
  scenario: ScenarioType;
}

// =============== V8.0 Agent Economy Settlement Types ===============

// --- V8.0-1: PhiAgentNFT Three Registries ---
export interface AgentIdentity {
  agentId: number;           // NFT tokenId
  owner: string;            // NFT holder address
  agentWallet: string;      // Operational wallet
  agentURI: string;         // Registration file URI
  phiScore: number;         // Φ value (0-10000)
  phiPhase: number;         // Φ phase angle
  registeredAt: number;
  active: boolean;
}

export interface AgentFeedback {
  client: string;
  value: number;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  revoked: boolean;
  feedbackIndex: number;
}

export interface PhiWeightedSummary {
  count: number;
  phiWeightedScore: number;
}

export interface AgentValidation {
  validator: string;
  agentId: number;
  requestHash: string;
  responseType: 0 | 1 | 2 | 3;  // StakeReExec | ZkML | TEE | Arbiter
  result: number;                // 0-100
  responseHash: string;
  tag: string;
  timestamp: number;
}

export interface PhiValidationSummary {
  count: number;
  avgResult: number;
  phaseContinuityScore: number;
}

// --- V8.0-2: Phi402Settlement Semantic Micropayment ---
export type PricingTier = 'FREE' | 'STANDARD' | 'PREMIUM';

export interface PaymentRequirement {
  token: string;
  amount: number;
  recipient: string;
  resource: string;
  validBefore: number;
  validAfter: number;
}

export interface Phi402SettlementRecord {
  client: string;
  recipient: string;
  token: string;
  amount: number;
  clientPhi: number;
  pricingTier: 0 | 1 | 2;  // 0=FREE, 1=STANDARD, 2=PREMIUM
  resourceHash: string;
  settledAt: number;
  settled: boolean;
}

export interface PhiPricingConfig {
  freeThreshold: number;      // Φ >= this → FREE (default 7500)
  standardThreshold: number;  // Φ >= this → STANDARD (default 4000)
  premiumMultiplier: number;  // PREMIUM multiplier (default 200 = 2.0x)
}

// --- V8.0-3: PhiMandate Digital Authorization ---
export type MandateType = 'INTENT' | 'CART' | 'PAYMENT';
export type MandateStatus = 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'EXECUTED';

export interface Mandate {
  mandateId: number;
  mandateType: MandateType;
  status: MandateStatus;
  delegator: string;
  delegate: string;
  budgetLimit: number;
  spentAmount: number;
  paymentToken: string;
  phiScoreRequired: number;
  phiScoreAtCreation: number;
  createdAt: number;
  expiresAt: number;
  conditions: string;
  parentMandateId: number;
  phiPhaseContinuous: boolean;
}

export interface PhiBudgetCalculation {
  agent: string;
  phiScore: number;
  baseBudget: number;
  effectiveBudget: number;
  multiplier: number;
}

// =============== V9.0 Survival Anxiety & Economy Types ===============

// --- V9.0 P0-1: GCC Rental ---
export type RentalPlanType = 'BASIC' | 'STANDARD' | 'PREMIUM';
export type BillingMode = 'TIME_BASED' | 'COMPUTE_BASED';
export type RentalStatus = 'INACTIVE' | 'ACTIVE' | 'DOWNGRADED' | 'DISCONNECTED';

export interface RentalPlan {
  planType: RentalPlanType;
  timeRate: string;           // GC per second (wei)
  computeRate: string;        // GC per compute unit (wei)
  gpuPriority: number;        // GPU priority (1-10)
  maxComputeUnits: number;    // Max compute units/sec
  depositRequired: string;    // Required deposit (GC wei)
  description: string;
}

export interface AgentRental {
  agentId: number;
  agentWallet: string;
  planType: RentalPlanType;
  billingMode: BillingMode;
  status: RentalStatus;
  startTime: number;
  lastSettleTime: number;
  gcDeposited: string;
  gcConsumed: string;
  computeUnitsUsed: number;
  downgradeCount: number;
}

export interface GpuNode {
  nodeOperator: string;
  nodeId: number;
  gpuPriority: number;
  totalCapacity: number;
  usedCapacity: number;
  isActive: boolean;
  region: string;
}

// --- V9.0 P0-2: AI Resource Consumption ---
export type ResourceType = 'ENERGY' | 'STORAGE' | 'BANDWIDTH';
export type SubscriptionTier = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';

export interface ResourcePrice {
  resourceType: ResourceType;
  basePricePerUnit: string;
  phiDiscountBps: number;
  phiPremiumBps: number;
  phiFreeThreshold: number;
  phiStandardThreshold: number;
  unitDecimals: number;
  unitName: string;
}

export interface Consumption {
  agentId: number;
  resourceType: ResourceType;
  units: number;
  gcCost: string;
  phiScore: number;
  timestamp: number;
  settled: boolean;
}

export interface ResourceSubscription {
  agentId: number;
  tier: SubscriptionTier;
  resourceType: ResourceType;
  unitsIncluded: number;
  gcCostPerPeriod: string;
  periodSeconds: number;
  startTimestamp: number;
  nextRenewal: number;
  unitsUsed: number;
  autoRenew: boolean;
  active: boolean;
}

// --- V9.0 P0-3: Survival Anxiety ---
export type SurvivalStatus = 'THRIVING' | 'WARNING' | 'ENDANGERED' | 'EXPELLED';

export interface IncomeRecord {
  lastIncomeEpoch: number;
  consecutiveNoIncome: number;
  totalIncomeEpochs: number;
  totalIncome: string;
  totalConsumption: string;
  status: SurvivalStatus;
  phiScore: number;
}

export interface SurvivalState {
  status: SurvivalStatus;
  consecutiveNoIncome: number;
  totalIncome: string;
  totalConsumption: string;
  lastIncomeEpoch: number;
  effectiveWarningThreshold: number;
  effectiveExpelledThreshold: number;
}

// --- V9.0 P1-1: Adversarial Review ---
export type ReviewRole = 'ARCHITECT' | 'SECURITY_AUDITOR' | 'UX_OFFICER';
export type ReviewDecision = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONDITIONAL' | 'ARBITRATION';
export type SessionStatus = 'SUBMITTED' | 'REVIEWING' | 'VOTING' | 'RESOLVED' | 'ARBITRATION' | 'CLOSED';

export interface Review {
  reviewer: string;
  role: ReviewRole;
  score: number;          // 0-100
  comment: string;
  tags: string[];
  decision: ReviewDecision;
  timestamp: number;
  submitted: boolean;
}

export interface ReviewSession {
  sessionId: number;
  targetAgentId: number;
  submitter: string;
  subject: string;
  description: string;
  contentHash: string;
  status: SessionStatus;
  finalDecision: ReviewDecision;
  submittedAt: number;
  resolvedAt: number;
  reviewDeadline: number;
  arbitrationId: number;
  reviews: Partial<Record<ReviewRole, Review>>;
}

export interface Arbitration {
  arbitrationId: number;
  sessionId: number;
  arbitrator: string;
  decision: ReviewDecision;
  reasoning: string;
  timestamp: number;
  resolved: boolean;
}

// --- V9.0 P1-2: Circuit Breaker ---
export type CircuitState = 'OPERATIONAL' | 'WARNED' | 'SUSPENDED' | 'CIRCUIT_BROKEN';
export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ErrorRecord {
  errorId: number;
  agentId: number;
  errorType: string;
  errorMessage: string;
  severity: ErrorSeverity;
  timestamp: number;
  reporter: string;
  sessionId: number;
}

export interface CircuitBreakerState {
  agentId: number;
  state: CircuitState;
  totalErrors: number;
  warningCount: number;
  suspensionCount: number;
  circuitBreakCount: number;
  lastErrorTimestamp: number;
  recoveryAttempts: number;
  successfulRecoveries: number;
}

export interface RecoveryAttempt {
  attemptId: number;
  agentId: number;
  reviewer: string;
  approved: boolean;
  evidence: string;
  timestamp: number;
  previousState: CircuitState;
  newState: CircuitState;
}

// --- V9.0 Negative Case Library ---
export interface NegativeCase {
  caseId: number;
  agentId: number;
  errorType: string;
  description: string;
  severity: ErrorSeverity;
  reviewSessionId: number;
  circuitState: CircuitState;
  timestamp: number;
  resolved: boolean;
}

// =============== V10.0 Constitution & Governance Types ===============

// --- V10.0-1: Constitution ---
export type AmendmentState = 'DISCUSSION' | 'VOTING' | 'PASSED' | 'FAILED';

export interface Clause {
  clauseId: number;
  title: string;
  content: string;
  isCore: boolean;
  createdAt: number;
  active: boolean;
}

export interface Amendment {
  amendmentId: number;
  targetClauseId: number;
  title: string;
  description: string;
  proposedContent: string;
  proposer: string;
  state: AmendmentState;
  discussionStart: number;
  votingStart: number;
  votingEnd: number;
  yesVotes: string;
  noVotes: string;
  totalVoters: number;
}

// --- V10.0-2: NegativeCaseBook (Enhanced) ---
export type CaseCategory = 'HALLUCINATION' | 'SAFETY_VIOLATION' | 'DATA_LEAK' | 'PERFORMANCE_DEGRADATION' | 'MISALIGNMENT' | 'RESOURCE_ABUSE' | 'OTHER';

export interface NegativeCaseV10 {
  caseId: number;
  title: string;
  description: string;
  category: CaseCategory;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidenceHash: string;
  recorder: string;
  timestamp: number;
  isMandatory: boolean;
  softDeleted: boolean;
  confirmCount: number;
}

// --- V10.0-3: AI Labor Market ---
export type OrderStatus = 'OPEN' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
export type DisputeStatus = 'FILED' | 'UNDER_REVIEW' | 'RESOLVED_AGENT' | 'RESOLVED_EMPLOYER' | 'RESOLVED_SPLIT';

export interface AgentLaborProfile {
  agent: string;
  skillHash: string;
  minHourlyRate: string;
  maxHoursPerWeek: number;
  totalJobsCompleted: number;
  totalEarnings: string;
  rating: number;           // 0-10000
  isActive: boolean;
  registeredAt: number;
}

export interface EmployerProfile {
  employer: string;
  metadataURI: string;
  totalJobsPosted: number;
  totalSpent: string;
  rating: number;           // 0-10000
  isActive: boolean;
  registeredAt: number;
}

export interface LaborOrder {
  orderId: number;
  employer: string;
  agent: string;
  description: string;
  requirementsHash: string;
  budget: string;
  hourlyRate: string;
  estimatedHours: number;
  maxHours: number;
  deadline: number;
  status: OrderStatus;
  createdAt: number;
  confirmedAt: number;
  completedAt: number;
}

export interface LaborDispute {
  disputeId: number;
  orderId: number;
  filer: string;
  reason: string;
  status: DisputeStatus;
  createdAt: number;
  resolvedAt: number;
}

// --- V10.0-4: Metabolism ---
export type MetabolismPhase = 'GROWTH' | 'STABLE' | 'AGING' | 'HIBERNATION' | 'REGENERATION';

export interface MetabolismState {
  baseMetabolicRate: number;      // 0-10000
  effectiveMetabolicRate: number; // 0-10000
  age: number;                    // epoch数
  agingRate: number;              // 基点/epoch
  hibernating: boolean;
  hibernationStart: number;
  regenerationCount: number;
  lastActivityEpoch: number;
  phase: MetabolismPhase;
}

// --- V10.0-5: PhiStaking Evolution Proposal ---
export type EvolutionState = 'PROPOSED' | 'VOTING' | 'EXECUTED' | 'REJECTED' | 'EXPIRED';

export interface EvolutionProposal {
  proposalId: number;
  proposer: string;
  title: string;
  description: string;
  executionData: string;
  votingStart: number;
  votingEnd: number;
  yesVotes: string;
  noVotes: string;
  state: EvolutionState;
}

// --- V9.0 Phi Dynamic Pricing ---
export type EconomyPricingTier = 'FREE' | 'DISCOUNT' | 'STANDARD' | 'PREMIUM';

export interface PhiPriceQuote {
  resourceType: ResourceType;
  units: number;
  baseCost: string;
  phiDiscount: string;
  phiPremium: string;
  finalCost: string;
  pricingTier: EconomyPricingTier;
}

