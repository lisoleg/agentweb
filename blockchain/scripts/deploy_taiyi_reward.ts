/**
 * 太乙AGI v7.7 — TaiyiReward 部署脚本
 * 部署 TaiyiReward.sol 到指定网络
 * 用法：npx hardhat run scripts/deploy_taiyi_reward.ts --network <network>
 */

import { ethers } from "hardhat";
import * as path from "path";
import * as fs from "fs";

// ── 部署配置 ────────────────────────

const DEPLOYMENT_DIR = path.join(__dirname, "../deployments");

interface DeployConfig {
  calcToken: string;    // Calc 令牌合约地址
  validator: string;     // validator 地址（AGI 后端）
  networkName: string;
}

// ── 网络配置 ───────────────────────

const NETWORK_CONFIG: Record<string, Partial<DeployConfig>> = {
  localhost: {
    // 本地 Hardhat 节点：先部署 Calc 令牌，再用其地址
    validator: "",  // 将在部署时从钱包获取
  },
  sepolia: {
    // Sepolia 测试网
    calcToken: "",  // 需提前部署或指定已有 Calc 令牌
    validator: "",  // AGI 后端以太坊地址
  },
  mainnet: {
    // 主网（谨慎！）
    calcToken: "",  // 主网 Calc 令牌地址
    validator: "",  // AGI 后端多签地址
  },
};

// ── 主部署函数 ───────────────────────

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.name;

  console.log(`\n🚀 开始部署 TaiyiReward 合约...`);
  console.log(`   网络：${networkName}`);
  console.log(`   部署账户：${await deployer.getAddress()}`);
  console.log(`   余额：${ethers.formatEther(await ethers.provider.getBalance(deployer))} ETH\n`);

  // ── 获取配置 ──
  const config = NETWORK_CONFIG[networkName] || {};
  let calcToken = config.calcToken || "";
  let validator = config.validator || "";

  // 若未配置，使用 deployer 地址作为默认值
  if (!calcToken) {
    console.warn(`⚠️  未配置 Calc 令牌地址，将先部署测试 Calc 令牌...`);
    calcToken = await deployTestCalc(deployer);
  }

  if (!validator) {
    validator = await deployer.getAddress();
    console.log(`ℹ️  validator 未配置，使用部署者地址：${validator}`);
  }

  console.log(`📋 部署参数：`);
  console.log(`   Calc Token：${calcToken}`);
  console.log(`   Validator：${validator}\n`);

  // ── 部署合约 ──
  const TaiyiReward = await ethers.getContractFactory("TaiyiReward");
  const reward = await TaiyiReward.deploy(calcToken, validator);

  console.log(`⏳  部署中... (tx: ${reward.deploymentTransaction()?.hash})`);
  await reward.waitForDeployment();

  const contractAddress = await reward.getAddress();
  console.log(`\n✅ TaiyiReward 部署成功！`);
  console.log(`   合约地址：${contractAddress}`);
  console.log(`   Calc Token：${await reward.calcToken()}`);
  console.log(`   Validator：${await reward.validator()}`);

  // ── 验证（若非本地）──
  if (networkName !== "localhost" && networkName !== "hardhat") {
    console.log(`\n🔍 正在验证合约（Etherscan）...`);
    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: [calcToken, validator],
      });
      console.log(`✅ 验证成功！`);
    } catch (err: any) {
      console.warn(`⚠️  验证失败：${err.message}`);
    }
  }

  // ── 保存部署信息 ──
  await saveDeployment(networkName, {
    contract: "TaiyiReward",
    address: contractAddress,
    calcToken,
    validator,
    deployer: await deployer.getAddress(),
    transactionHash: reward.deploymentTransaction()?.hash,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
  });

  console.log(`\n📦 部署信息已保存：${path.join(DEPLOYMENT_DIR, `${networkName}.json`)}`);
  console.log(`\n🎉 部署完成！\n`);
}

// ── 部署测试 Calc 令牌（若未配置）──

async function deployTestCalc(deployer: any): Promise<string> {
  console.log(`📦 部署测试 Calc 令牌（ERC20）...`);

  // 简单 ERC20 实现（用于测试）
  const CalcToken = await ethers.getContractFactory("TaiyiCalcTest");
  const calc = await CalcToken.deploy(
    "Calc Token",
    "CALC",
    ethers.parseEther("1000000000")  // 10亿总量
  );
  await calc.waitForDeployment();

  const addr = await calc.getAddress();
  console.log(`✅ 测试 Calc 令牌部署成功：${addr}`);

  // 给 deployer 铸币
  const mintTx = await calc.mint(
    await deployer.getAddress(),
    ethers.parseEther("1000000")
  );
  await mintTx.wait();
  console.log(`✅ 已向部署者铸币 1,000,000 CALC\n`);

  return addr;
}

// ── 保存部署信息 ───────────────────────

async function saveDeployment(network: string, data: any): Promise<void> {
  if (!fs.existsSync(DEPLOYMENT_DIR)) {
    fs.mkdirSync(DEPLOYMENT_DIR, { recursive: true });
  }

  const filePath = path.join(DEPLOYMENT_DIR, `${network}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── ERC20 测试合约（内联）────────────

// 注意：实际应在 contracts/ 目录单独创建 TaiyiCalcTest.sol
// 此处仅提示需要该合约
/**
 * 所需合约（contracts/TaiyiCalcTest.sol）：
 * 
 * // SPDX-License-Identifier: MIT
 * pragma solidity ^0.8.20;
 * 
 * import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
 * import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
 * import "@openzeppelin/contracts/access/Ownable.sol";
 * 
 * contract TaiyiCalcTest is ERC20, ERC20Burnable, Ownable {
 *     constructor(string memory name, string memory symbol, uint256 initialSupply)
 *         ERC20(name, symbol) Ownable(msg.sender) {
 *         _mint(msg.sender, initialSupply);
 *     }
 * 
 *     function mint(address to, uint256 amount) public onlyOwner {
 *         _mint(to, amount);
 *     }
 * 
 *     function burn(uint256 amount) public override {
 *         super.burn(amount);
 *     }
 * }
 */

// ── 运行 ───────────────────────────────

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(`\n❌ 部署失败：${error.message}`);
    console.error(error);
    process.exit(1);
  });
