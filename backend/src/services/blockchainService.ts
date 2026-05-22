/**
 * Blockchain Service - 链上合约交互层
 *
 * 提供 PhiStaking.getVotingPower() 等合约只读调用的统一接口。
 * 当前实现为模拟模式（无需实时链上连接），生产环境需切换为真实 ethers provider。
 *
 * 合约接口:
 * - PhiStaking.getVotingPower(address) → uint256
 * - PhiStaking.getStakeInfo(address) → (amount, phiValue, pendingReward, lastUpdateTime, lockEndTime, phiPhase)
 */

import logger from '../utils/logger';

// =============== Configuration ===============

interface BlockchainConfig {
  /** 合约部署地址（从环境变量读取，缺失时走模拟模式） */
  phiStakingAddress: string;
  /** RPC 端点 URL */
  rpcUrl: string;
  /** 是否启用链上真实调用（默认 false = 模拟模式） */
  liveMode: boolean;
  /** 模拟模式下的默认投票权 */
  defaultVotingPower: number;
}

const config: BlockchainConfig = {
  phiStakingAddress: process.env.PHI_STAKING_ADDRESS || '',
  rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
  liveMode: (process.env.BLOCKCHAIN_LIVE_MODE === 'true'),
  defaultVotingPower: 1.0,
};

// =============== PhiStaking ABI (minimal) ===============

const PHI_STAKING_ABI = [
  'function getVotingPower(address user) external view returns (uint256)',
  'function getStakeInfo(address user) external view returns (uint256 amount, uint256 phiValue, uint256 pendingReward, uint256 lastUpdateTime, uint256 lockEndTime, int256 phiPhase)',
];

// =============== Service ===============

class BlockchainServiceClass {
  private provider: any = null;
  private phiStakingContract: any = null;

  constructor() {
    if (config.liveMode && config.phiStakingAddress) {
      this.initLiveConnection();
    } else {
      logger.info('[Blockchain] Running in simulation mode (no live chain connection)');
    }
  }

  /**
   * 初始化链上连接
   */
  private initLiveConnection(): void {
    try {
      // 动态导入 ethers，避免在模拟模式下强制安装
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ethers } = require('ethers');
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
      this.phiStakingContract = new ethers.Contract(
        config.phiStakingAddress,
        PHI_STAKING_ABI,
        this.provider
      );
      logger.info(`[Blockchain] Live mode enabled, connected to ${config.rpcUrl}`);
    } catch (error: any) {
      logger.warn(`[Blockchain] Failed to init live connection: ${error.message}, falling back to simulation`);
      this.provider = null;
      this.phiStakingContract = null;
    }
  }

  /**
   * 获取用户投票权
   *
   * 链上调用 PhiStaking.getVotingPower(userAddress)
   * 公式: stakeAmount * (10000 + phiValue + phaseBoost) / 10000
   *
   * 模拟模式: 从数据库用户属性推算（stake * phiWeight）
   * 链上模式: 直接调用合约
   *
   * @param userAddress 用户钱包地址或用户ID
   * @returns 投票权（0-∞，实际受 maxStakeInfluence 限制）
   */
  async getVotingPower(userAddress: string): Promise<number> {
    // 链上模式
    if (this.phiStakingContract && config.liveMode) {
      try {
        const rawPower = await this.phiStakingContract.getVotingPower(userAddress);
        const power = Number(rawPower) / 1e18; // 假设 18 位小数
        logger.debug(`[Blockchain] On-chain voting power for ${userAddress}: ${power}`);
        return power;
      } catch (error: any) {
        logger.warn(`[Blockchain] On-chain query failed for ${userAddress}: ${error.message}, using fallback`);
      }
    }

    // 模拟模式: 基于用户数据库属性计算
    return this.simulateVotingPower(userAddress);
  }

  /**
   * 获取用户质押信息
   */
  async getStakeInfo(userAddress: string): Promise<{
    amount: number;
    phiValue: number;
    pendingReward: number;
    phiPhase: number;
  } | null> {
    if (this.phiStakingContract && config.liveMode) {
      try {
        const info = await this.phiStakingContract.getStakeInfo(userAddress);
        return {
          amount: Number(info.amount) / 1e18,
          phiValue: Number(info.phiValue),
          pendingReward: Number(info.pendingReward) / 1e18,
          phiPhase: Number(info.phiPhase),
        };
      } catch (error: any) {
        logger.warn(`[Blockchain] On-chain stakeInfo query failed: ${error.message}`);
        return null;
      }
    }

    // 模拟模式
    return {
      amount: 100,       // 默认质押 100 tokens
      phiValue: 5000,    // 中等Φ值
      pendingReward: 0,
      phiPhase: 0,
    };
  }

  /**
   * 模拟投票权计算
   *
   * 基于 PhiStaking.getVotingPower 公式的模拟版本:
   * votingPower = stakeAmount * (10000 + phiValue) / 10000
   *
   * 当前简化版: 基于 Prisma 用户表中的代理字段
   */
  private simulateVotingPower(userId: string): number {
    // 当前: 返回默认值
    // TODO: 可接入 Prisma User 表的 reputation/stake 字段
    // 未来: 从用户数据库记录中读取质押金额和Φ值
    logger.debug(`[Blockchain] Simulated voting power for ${userId}: ${config.defaultVotingPower}`);
    return config.defaultVotingPower;
  }

  /**
   * 检查是否处于链上模式
   */
  isLiveMode(): boolean {
    return config.liveMode && this.phiStakingContract !== null;
  }

  /**
   * 获取配置状态
   */
  getStatus(): { mode: string; rpcUrl: string; phiStakingAddress: string } {
    return {
      mode: this.isLiveMode() ? 'live' : 'simulation',
      rpcUrl: config.rpcUrl,
      phiStakingAddress: config.phiStakingAddress || '(not configured)',
    };
  }
}

export const blockchainService = new BlockchainServiceClass();
