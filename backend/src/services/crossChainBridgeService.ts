/**
 * Cross-Chain Bridge Service - 跨链桥接协议服务
 *
 * 实现资产在Ethereum、BSV、其他L1/L2之间的无缝转移。
 * 采用锁定-铸造（Lock-Mint）/ 销毁-解锁（Burn-Unlock）模式。
 *
 * 核心设计：
 * - Φ值加权验证者集合，2/3签名阈值
 * - 多链适配器：Ethereum、BSV、Arbitrum、Optimism、Polygon
 * - 与dualTrackRouter集成：EML/LEGACY双轨桥接
 * - 安全机制：超时退款、紧急暂停、每日限额
 */

import * as crypto from 'crypto';

// =============== Types ===============

export enum BridgeRequestState {
  Pending = 'Pending',
  Locked = 'Locked',
  Minted = 'Minted',
  BurnInitiated = 'BurnInitiated',
  Unlocked = 'Unlocked',
  Completed = 'Completed',
  Refunded = 'Refunded',
  Failed = 'Failed',
}

export enum ChainType {
  Ethereum = 'Ethereum',
  BSV = 'BSV',
  Arbitrum = 'Arbitrum',
  Optimism = 'Optimism',
  Polygon = 'Polygon',
  Custom = 'Custom',
}

export interface ChainConfig {
  chainId: number;
  name: string;
  type: ChainType;
  bridgeContract: string;
  active: boolean;
  dailyLimit: number;
  dailyUsed: number;
  lastResetTime: number;
  confirmations: number;  // 需要的区块确认数
  avgBlockTime: number;   // 平均出块时间（秒）
}

export interface ValidatorInfo {
  address: string;
  phiWeight: number;       // Φ值权重 (0-1)
  active: boolean;
  totalSigned: number;
  totalSlashed: number;
}

export interface BridgeRequest {
  requestId: string;
  sourceChainId: number;
  targetChainId: number;
  token: string;
  sender: string;
  recipient: string;
  amount: number;
  nonce: number;
  state: BridgeRequestState;
  createdAt: number;
  deadline: number;
  signatures: ValidatorSignature[];
  totalPhiWeight: number;
}

export interface ValidatorSignature {
  validatorAddress: string;
  phiWeight: number;
  signature: string;
  timestamp: number;
}

// =============== V11.0 Passport Bridge Types ===============

export interface PassportData {
  phiValue: number;
  creditScore: number;
  caseMerkleRoot: string;
  lostCaseCount: number;
}

export enum MigrationState {
  NONE = 'NONE',
  LOCKED = 'LOCKED',
  MINTED = 'MINTED',
  MIGRATED = 'MIGRATED',
}

export interface MigrationRequest {
  requestId: string;
  agent: string;
  sourceChainId: number;
  targetChainId: number;
  amount: number;
  passportData: PassportData;
  decayedPhi: number;
  state: MigrationState;
  createdAt: number;
  completedAt: number;
}

// =============== 链适配器 ===============

interface ChainAdapter {
  chainId: number;
  name: string;
  type: ChainType;

  // 监听源链锁定事件
  listenLockEvents(callback: (requestId: string, amount: number, recipient: string) => void): void;

  // 提交目标链铸造交易
  submitMintTransaction(requestId: string, recipient: string, amount: number): Promise<string>;

  // 提交源链销毁交易
  submitBurnTransaction(token: string, amount: number): Promise<string>;

  // 提交目标链解锁交易
  submitUnlockTransaction(requestId: string, recipient: string, amount: number): Promise<string>;

  // 查询交易状态
  getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'>;
}

/**
 * Ethereum适配器
 */
class EthereumAdapter implements ChainAdapter {
  chainId = 1;
  name = 'Ethereum';
  type = ChainType.Ethereum;

  async listenLockEvents(callback: (requestId: string, amount: number, recipient: string) => void): Promise<void> {
    // 实际实现：监听SigmaBridge合约的BridgeLocked事件
    console.log(`🔗 [Bridge] Ethereum: Listening for lock events...`);
  }

  async submitMintTransaction(requestId: string, recipient: string, amount: number): Promise<string> {
    console.log(`🔗 [Bridge] Ethereum: Mint ${amount} to ${recipient} for ${requestId}`);
    return `eth_mint_tx_${Date.now()}`;
  }

  async submitBurnTransaction(token: string, amount: number): Promise<string> {
    console.log(`🔗 [Bridge] Ethereum: Burn ${amount} ${token}`);
    return `eth_burn_tx_${Date.now()}`;
  }

  async submitUnlockTransaction(requestId: string, recipient: string, amount: number): Promise<string> {
    console.log(`🔗 [Bridge] Ethereum: Unlock ${amount} to ${recipient} for ${requestId}`);
    return `eth_unlock_tx_${Date.now()}`;
  }

  async getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    return 'confirmed';
  }
}

/**
 * BSV适配器
 */
class BSVAdapter implements ChainAdapter {
  chainId = 1; // BSV chain ID (简化)
  name = 'BSV';
  type = ChainType.BSV;

  async listenLockEvents(callback: (requestId: string, amount: number, recipient: string) => void): Promise<void> {
    console.log(`🔗 [Bridge] BSV: Listening for lock events...`);
  }

  async submitMintTransaction(requestId: string, recipient: string, amount: number): Promise<string> {
    console.log(`🔗 [Bridge] BSV: Mint ${amount} to ${recipient} for ${requestId}`);
    return `bsv_mint_tx_${Date.now()}`;
  }

  async submitBurnTransaction(token: string, amount: number): Promise<string> {
    console.log(`🔗 [Bridge] BSV: Burn ${amount} ${token}`);
    return `bsv_burn_tx_${Date.now()}`;
  }

  async submitUnlockTransaction(requestId: string, recipient: string, amount: number): Promise<string> {
    console.log(`🔗 [Bridge] BSV: Unlock ${amount} to ${recipient} for ${requestId}`);
    return `bsv_unlock_tx_${Date.now()}`;
  }

  async getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    return 'confirmed';
  }
}

/**
 * L2适配器（Arbitrum/Optimism/Polygon）
 */
class L2Adapter implements ChainAdapter {
  chainId: number;
  name: string;
  type: ChainType;

  constructor(chainId: number, name: string, type: ChainType) {
    this.chainId = chainId;
    this.name = name;
    this.type = type;
  }

  async listenLockEvents(callback: (requestId: string, amount: number, recipient: string) => void): Promise<void> {
    console.log(`🔗 [Bridge] ${this.name}: Listening for lock events...`);
  }

  async submitMintTransaction(requestId: string, recipient: string, amount: number): Promise<string> {
    console.log(`🔗 [Bridge] ${this.name}: Mint ${amount} to ${recipient} for ${requestId}`);
    return `l2_mint_tx_${Date.now()}`;
  }

  async submitBurnTransaction(token: string, amount: number): Promise<string> {
    console.log(`🔗 [Bridge] ${this.name}: Burn ${amount} ${token}`);
    return `l2_burn_tx_${Date.now()}`;
  }

  async submitUnlockTransaction(requestId: string, recipient: string, amount: number): Promise<string> {
    console.log(`🔗 [Bridge] ${this.name}: Unlock ${amount} to ${recipient} for ${requestId}`);
    return `l2_unlock_tx_${Date.now()}`;
  }

  async getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    return 'confirmed';
  }
}

// =============== Cross-Chain Bridge Service ===============

class CrossChainBridgeServiceClass {
  private chains: Map<number, ChainConfig> = new Map();
  private adapters: Map<number, ChainAdapter> = new Map();
  private validators: Map<string, ValidatorInfo> = new Map();
  private requests: Map<string, BridgeRequest> = new Map();
  private totalPhiWeight: number = 0;
  private nonce: number = 0;

  // V11.0: Migration requests with passport
  private migrationRequests: Map<string, MigrationRequest> = new Map();
  private migrationNonce: number = 0;
  private decayRate: number = 9500;  // 5% decay by default

  // 常量
  private readonly SIGNATURE_THRESHOLD = 2 / 3;  // 2/3签名阈值
  private readonly REQUEST_TIMEOUT = 3600 * 1000;  // 1小时超时

  constructor() {
    // 初始化预置链
    this._initDefaultChains();
  }

  private _initDefaultChains(): void {
    // Ethereum
    this.addChain({
      chainId: 1,
      name: 'Ethereum',
      type: ChainType.Ethereum,
      bridgeContract: '0x0000000000000000000000000000000000000001',
      active: true,
      dailyLimit: 1e22,  // 10000 ETH
      dailyUsed: 0,
      lastResetTime: Date.now(),
      confirmations: 12,
      avgBlockTime: 12,
    });
    this.adapters.set(1, new EthereumAdapter());

    // BSV
    this.addChain({
      chainId: 100,
      name: 'Bitcoin SV',
      type: ChainType.BSV,
      bridgeContract: '0x0000000000000000000000000000000000000064',
      active: true,
      dailyLimit: 1e15,   // 10000 BSV (sats)
      dailyUsed: 0,
      lastResetTime: Date.now(),
      confirmations: 6,
      avgBlockTime: 600,
    });
    this.adapters.set(100, new BSVAdapter());

    // Arbitrum
    this.addChain({
      chainId: 42161,
      name: 'Arbitrum One',
      type: ChainType.Arbitrum,
      bridgeContract: '0x0000000000000000000000000000000000A4B61',
      active: true,
      dailyLimit: 1e22,
      dailyUsed: 0,
      lastResetTime: Date.now(),
      confirmations: 1,
      avgBlockTime: 0.25,
    });
    this.adapters.set(42161, new L2Adapter(42161, 'Arbitrum One', ChainType.Arbitrum));

    // Optimism
    this.addChain({
      chainId: 10,
      name: 'Optimism',
      type: ChainType.Optimism,
      bridgeContract: '0x000000000000000000000000000000000000000A',
      active: true,
      dailyLimit: 1e22,
      dailyUsed: 0,
      lastResetTime: Date.now(),
      confirmations: 1,
      avgBlockTime: 2,
    });
    this.adapters.set(10, new L2Adapter(10, 'Optimism', ChainType.Optimism));

    // Polygon
    this.addChain({
      chainId: 137,
      name: 'Polygon',
      type: ChainType.Polygon,
      bridgeContract: '0x0000000000000000000000000000000000000089',
      active: true,
      dailyLimit: 1e25,  // 10000000 MATIC
      dailyUsed: 0,
      lastResetTime: Date.now(),
      confirmations: 128,
      avgBlockTime: 2,
    });
    this.adapters.set(137, new L2Adapter(137, 'Polygon', ChainType.Polygon));
  }

  /**
   * 添加链配置
   */
  addChain(config: ChainConfig): boolean {
    this.chains.set(config.chainId, config);
    console.log(`✅ [Bridge] Chain added: ${config.name} (ID: ${config.chainId})`);
    return true;
  }

  /**
   * 添加验证者
   */
  addValidator(address: string, phiWeight: number): boolean {
    if (this.validators.has(address)) {
      throw new Error(`Validator ${address} already exists`);
    }
    if (phiWeight <= 0 || phiWeight > 1) {
      throw new Error('Invalid phi weight (0-1)');
    }

    this.validators.set(address, {
      address,
      phiWeight,
      active: true,
      totalSigned: 0,
      totalSlashed: 0,
    });
    this.totalPhiWeight += phiWeight;

    console.log(`✅ [Bridge] Validator added: ${address} (Φ=${phiWeight.toFixed(4)})`);
    return true;
  }

  /**
   * 发起锁定（Lock-Mint模式）
   */
  async lock(params: {
    targetChainId: number;
    token: string;
    sender: string;
    recipient: string;
    amount: number;
  }): Promise<BridgeRequest> {
    const { targetChainId, token, sender, recipient, amount } = params;

    const targetChain = this.chains.get(targetChainId);
    if (!targetChain || !targetChain.active) {
      throw new Error(`Target chain ${targetChainId} not active`);
    }

    // 每日限额检查
    this._resetDailyIfNeeded(targetChain);
    if (targetChain.dailyUsed + amount > targetChain.dailyLimit) {
      throw new Error('Daily limit exceeded');
    }

    const requestId = `bridge_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    const request: BridgeRequest = {
      requestId,
      sourceChainId: 1, // 当前链
      targetChainId,
      token,
      sender,
      recipient,
      amount,
      nonce: this.nonce++,
      state: BridgeRequestState.Locked,
      createdAt: Date.now(),
      deadline: Date.now() + this.REQUEST_TIMEOUT,
      signatures: [],
      totalPhiWeight: 0,
    };

    this.requests.set(requestId, request);
    targetChain.dailyUsed += amount;

    console.log(`🔒 [Bridge] Locked: ${amount} ${token} from ${sender} → ${recipient} on ${targetChain.name}`);

    // 触发验证者签名收集
    this._collectSignatures(requestId);

    return request;
  }

  /**
   * 目标链铸造
   */
  async mint(requestId: string): Promise<BridgeRequest> {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Request not found');
    if (request.state !== BridgeRequestState.Locked) throw new Error('Invalid state for mint');

    // 检查验证者签名
    if (!this._isConfirmed(request)) {
      throw new Error('Insufficient validator signatures');
    }

    const adapter = this.adapters.get(request.targetChainId);
    if (!adapter) throw new Error(`No adapter for chain ${request.targetChainId}`);

    const txHash = await adapter.submitMintTransaction(
      requestId,
      request.recipient,
      request.amount
    );

    request.state = BridgeRequestState.Minted;

    console.log(`🪙 [Bridge] Minted: ${request.amount} to ${request.recipient} on chain ${request.targetChainId}`);

    return request;
  }

  /**
   * 发起销毁（Burn-Unlock模式）
   */
  async burn(params: {
    targetChainId: number;
    token: string;
    sender: string;
    recipient: string;
    amount: number;
  }): Promise<BridgeRequest> {
    const { targetChainId, token, sender, recipient, amount } = params;

    const targetChain = this.chains.get(targetChainId);
    if (!targetChain || !targetChain.active) {
      throw new Error(`Target chain ${targetChainId} not active`);
    }

    const requestId = `burn_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    const request: BridgeRequest = {
      requestId,
      sourceChainId: 1,
      targetChainId,
      token,
      sender,
      recipient,
      amount,
      nonce: this.nonce++,
      state: BridgeRequestState.BurnInitiated,
      createdAt: Date.now(),
      deadline: Date.now() + this.REQUEST_TIMEOUT,
      signatures: [],
      totalPhiWeight: 0,
    };

    this.requests.set(requestId, request);

    // 触发源链销毁
    const adapter = this.adapters.get(request.sourceChainId);
    if (adapter) {
      await adapter.submitBurnTransaction(token, amount);
    }

    console.log(`🔥 [Bridge] Burn initiated: ${amount} ${token} from ${sender} → ${recipient}`);

    return request;
  }

  /**
   * 目标链解锁
   */
  async unlock(requestId: string): Promise<BridgeRequest> {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Request not found');
    if (request.state !== BridgeRequestState.BurnInitiated) throw new Error('Invalid state for unlock');

    if (!this._isConfirmed(request)) {
      throw new Error('Insufficient validator signatures');
    }

    const adapter = this.adapters.get(request.targetChainId);
    if (!adapter) throw new Error(`No adapter for chain ${request.targetChainId}`);

    await adapter.submitUnlockTransaction(requestId, request.recipient, request.amount);

    request.state = BridgeRequestState.Unlocked;

    console.log(`🔓 [Bridge] Unlocked: ${request.amount} to ${request.recipient} on chain ${request.targetChainId}`);

    return request;
  }

  /**
   * 超时退款
   */
  refund(requestId: string, requester: string): BridgeRequest {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Request not found');
    if (request.state !== BridgeRequestState.Locked) throw new Error('Invalid state for refund');
    if (Date.now() <= request.deadline) throw new Error('Not expired yet');
    if (request.sender !== requester) throw new Error('Not authorized');

    request.state = BridgeRequestState.Refunded;

    // 归还每日限额
    const targetChain = this.chains.get(request.targetChainId);
    if (targetChain) {
      targetChain.dailyUsed -= request.amount;
    }

    console.log(`💰 [Bridge] Refunded: ${request.amount} to ${request.sender}`);

    return request;
  }

  // =============== Validator Signature Collection ===============

  /**
   * 验证者签名
   */
  signRequest(requestId: string, validatorAddress: string): boolean {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Request not found');

    const validator = this.validators.get(validatorAddress);
    if (!validator || !validator.active) throw new Error('Not an active validator');

    // 检查是否已签名
    if (request.signatures.some(s => s.validatorAddress === validatorAddress)) {
      throw new Error('Already signed');
    }

    const signature: ValidatorSignature = {
      validatorAddress,
      phiWeight: validator.phiWeight,
      signature: `sig_${validatorAddress}_${requestId}_${Date.now()}`,
      timestamp: Date.now(),
    };

    request.signatures.push(signature);
    request.totalPhiWeight += validator.phiWeight;
    validator.totalSigned++;

    console.log(`✍️ [Bridge] Validator ${validatorAddress} signed ${requestId} (Φ=${validator.phiWeight.toFixed(4)})`);

    return true;
  }

  /**
   * 检查是否达到2/3签名阈值
   */
  private _isConfirmed(request: BridgeRequest): boolean {
    if (this.totalPhiWeight === 0) return false;
    return request.totalPhiWeight >= this.totalPhiWeight * this.SIGNATURE_THRESHOLD;
  }

  /**
   * 自动收集验证者签名（模拟）
   */
  private _collectSignatures(requestId: string): void {
    // 实际实现：广播签名请求给验证者集合
    // 这里模拟自动签名流程
    console.log(`📢 [Bridge] Broadcasting signature request for ${requestId} to ${this.validators.size} validators`);
  }

  private _resetDailyIfNeeded(chain: ChainConfig): void {
    if (Date.now() >= chain.lastResetTime + 86400 * 1000) {
      chain.dailyUsed = 0;
      chain.lastResetTime = Date.now();
    }
  }

  // =============== Query Methods ===============

  getBridgeRequest(requestId: string): BridgeRequest | undefined {
    return this.requests.get(requestId);
  }

  getChain(chainId: number): ChainConfig | undefined {
    return this.chains.get(chainId);
  }

  getSupportedChains(): ChainConfig[] {
    return Array.from(this.chains.values());
  }

  getValidators(): ValidatorInfo[] {
    return Array.from(this.validators.values());
  }

  getActiveValidators(): ValidatorInfo[] {
    return Array.from(this.validators.values()).filter(v => v.active);
  }

  getTotalPhiWeight(): number {
    return this.totalPhiWeight;
  }

  isBridgeConfirmed(requestId: string): boolean {
    const request = this.requests.get(requestId);
    return request ? this._isConfirmed(request) : false;
  }

  // =============== V11.0 Passport Bridge Methods ===============

  /**
   * V11.0: 锁定资产并携带Passport数据
   */
  async lockWithPassport(params: {
    targetChainId: number;
    token: string;
    sender: string;
    amount: number;
    passportData: PassportData;
  }): Promise<MigrationRequest> {
    const { targetChainId, token, sender, amount, passportData } = params;

    const targetChain = this.chains.get(targetChainId);
    if (!targetChain || !targetChain.active) {
      throw new Error(`Target chain ${targetChainId} not active`);
    }
    if (passportData.phiValue > 10000) {
      throw new Error('Invalid phiValue (max 10000)');
    }
    if (passportData.creditScore > 10000) {
      throw new Error('Invalid creditScore (max 10000)');
    }

    // Check daily limit
    this._resetDailyIfNeeded(targetChain);
    if (targetChain.dailyUsed + amount > targetChain.dailyLimit) {
      throw new Error('Daily limit exceeded');
    }

    const requestId = `migration_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    const request: MigrationRequest = {
      requestId,
      agent: sender,
      sourceChainId: 1,
      targetChainId,
      amount,
      passportData,
      decayedPhi: 0,  // Will be calculated in mintWithPassport
      state: MigrationState.LOCKED,
      createdAt: Date.now(),
      completedAt: 0,
    };

    this.migrationRequests.set(requestId, request);
    targetChain.dailyUsed += amount;

    console.log(`🔒 [BridgeV2] Locked with passport: ${amount} from ${sender} → chain ${targetChainId}, phi=${passportData.phiValue}`);

    return request;
  }

  /**
   * V11.0: 在目标链铸造并应用Φ衰减
   */
  async mintWithPassport(requestId: string): Promise<MigrationRequest> {
    const request = this.migrationRequests.get(requestId);
    if (!request) throw new Error('Migration request not found');
    if (request.state !== MigrationState.LOCKED) throw new Error('Invalid state for mint');

    // Calculate Φ decay: targetPhi = sourcePhi * decayRate / 10000
    const decayedPhi = Math.floor((request.passportData.phiValue * this.decayRate) / 10000);
    request.decayedPhi = decayedPhi;
    request.state = MigrationState.MINTED;

    console.log(`🪙 [BridgeV2] Minted with passport: phi decayed ${request.passportData.phiValue} → ${decayedPhi} (rate=${this.decayRate})`);

    return request;
  }

  /**
   * V11.0: 标记迁徙完成
   */
  markMigrated(requestId: string): MigrationRequest {
    const request = this.migrationRequests.get(requestId);
    if (!request) throw new Error('Migration request not found');
    if (request.state !== MigrationState.MINTED) throw new Error('Not in MINTED state');

    request.state = MigrationState.MIGRATED;
    request.completedAt = Date.now();

    console.log(`✅ [BridgeV2] Migration completed for ${request.agent}`);

    return request;
  }

  /**
   * V11.0: 计算Φ衰减（纯计算）
   */
  calculateDecayedPhi(sourcePhi: number): number {
    return Math.floor((sourcePhi * this.decayRate) / 10000);
  }

  /**
   * V11.0: 设置衰减率
   */
  setDecayRate(rate: number): void {
    if (rate <= 0 || rate > 10000) throw new Error('Invalid decay rate');
    this.decayRate = rate;
  }

  /**
   * V11.0: 获取迁徙请求
   */
  getMigrationRequest(requestId: string): MigrationRequest | undefined {
    return this.migrationRequests.get(requestId);
  }
}

export const crossChainBridgeService = new CrossChainBridgeServiceClass();
