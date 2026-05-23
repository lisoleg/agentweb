/**
 * Σ-Cloud V12.0 — 部署脚本
 * 部署 RelayRegistry + CreditRating + ReputationStaking 到指定网络
 * 用法: npx hardhat run scripts/deploy_v12.ts --network <network>
 */

import { ethers } from "hardhat";
import * as path from "path";
import * as fs from "fs";

const DEPLOYMENT_DIR = path.join(__dirname, "../deployments");

interface V12DeploymentData {
  version: string;
  network: string;
  deployer: string;
  blockNumber: number;
  timestamp: string;
  contracts: {
    relayRegistry: string;
    creditRating: string;
    reputationStaking: string;
  };
  dependencies: {
    calcToken: string;
    constitutionCourt: string;
    phiStaking: string;
    laborMarket: string;
  };
}

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.name;

  console.log(`\n🚀 Σ-Cloud V12.0 部署开始...`);
  console.log(`   网络：${networkName}`);
  console.log(`   部署账户：${await deployer.getAddress()}`);
  console.log(`   余额：${ethers.formatEther(await ethers.provider.getBalance(deployer))} ETH\n`);

  // ── 1. 部署依赖（测试令牌）──
  console.log(`📦 Step 1: 部署依赖合约...`);

  // CalcToken
  const CalcToken = await ethers.getContractFactory("TaiyiCalcTest");
  const calcToken = await CalcToken.deploy(
    "Calc Token V12",
    "CALC",
    ethers.parseEther("1000000000")
  );
  await calcToken.waitForDeployment();
  const calcTokenAddr = await calcToken.getAddress();
  console.log(`   ✅ CalcToken: ${calcTokenAddr}`);

  // 铸币给deployer
  const mintTx = await calcToken.mint(
    await deployer.getAddress(),
    ethers.parseEther("1000000")
  );
  await mintTx.wait();
  console.log(`   ✅ 已铸币 1,000,000 CALC`);

  // ── 2. 部署 PhiStaking ──
  console.log(`\n📦 Step 2: 部署 PhiStaking...`);
  const PhiStaking = await ethers.getContractFactory("PhiStaking");
  const phiStaking = await PhiStaking.deploy(calcTokenAddr);
  await phiStaking.waitForDeployment();
  const phiStakingAddr = await phiStaking.getAddress();
  console.log(`   ✅ PhiStaking: ${phiStakingAddr}`);

  // ── 3. 部署 AILaborMarket ──
  console.log(`\n📦 Step 3: 部署 AILaborMarket...`);
  const AILaborMarket = await ethers.getContractFactory("AILaborMarket");
  const laborMarket = await AILaborMarket.deploy(calcTokenAddr);
  await laborMarket.waitForDeployment();
  const laborMarketAddr = await laborMarket.getAddress();
  console.log(`   ✅ AILaborMarket: ${laborMarketAddr}`);

  // ── 4. 部署 ConstitutionCourt ──
  console.log(`\n📦 Step 4: 部署 ConstitutionCourt (V12增强版)...`);
  const ConstitutionCourt = await ethers.getContractFactory("ConstitutionCourt");
  const court = await ConstitutionCourt.deploy();
  await court.waitForDeployment();
  const courtAddr = await court.getAddress();
  console.log(`   ✅ ConstitutionCourt: ${courtAddr}`);

  // ── 5. 部署 RelayRegistry ──
  console.log(`\n📦 Step 5: 部署 RelayRegistry...`);
  const RelayRegistry = await ethers.getContractFactory("RelayRegistry");
  const relay = await RelayRegistry.deploy(calcTokenAddr);
  await relay.waitForDeployment();
  const relayAddr = await relay.getAddress();
  console.log(`   ✅ RelayRegistry: ${relayAddr}`);

  // ── 6. 部署 CreditRating ──
  console.log(`\n📦 Step 6: 部署 CreditRating...`);
  const CreditRating = await ethers.getContractFactory("CreditRating");
  const credit = await CreditRating.deploy(
    phiStakingAddr,
    courtAddr,
    laborMarketAddr,
    relayAddr
  );
  await credit.waitForDeployment();
  const creditAddr = await credit.getAddress();
  console.log(`   ✅ CreditRating: ${creditAddr}`);

  // ── 7. 部署 ReputationStaking ──
  console.log(`\n📦 Step 7: 部署 ReputationStaking...`);
  const ReputationStaking = await ethers.getContractFactory("ReputationStaking");
  const staking = await ReputationStaking.deploy(creditAddr, calcTokenAddr);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log(`   ✅ ReputationStaking: ${stakingAddr}`);

  // ── 8. 交叉配置 ──
  console.log(`\n📦 Step 8: 交叉配置合约引用...`);

  // RelayRegistry设置CreditRating引用
  const setCreditTx = await relay.setCreditRating(creditAddr);
  await setCreditTx.wait();
  console.log(`   ✅ RelayRegistry → CreditRating 引用已设置`);

  // CreditRating设置RelayRegistry引用
  const setRelayTx = await credit.setRelayRegistry(relayAddr);
  await setRelayTx.wait();
  console.log(`   ✅ CreditRating → RelayRegistry 引用已设置`);

  // ── 验证部署 ──
  console.log(`\n🔍 验证部署...`);

  // 注册一个测试中继器
  const approveTx = await calcToken.approve(relayAddr, ethers.parseEther("10000"));
  await approveTx.wait();

  const registerTx = await relay.registerRelay(
    ethers.parseEther("1000"),  // stake
    100,                        // computeCapacity
    [1, 137, 56],              // supportedChains (ETH, Polygon, BSC)
    100                         // feeRate (1%)
  );
  await registerTx.wait();
  console.log(`   ✅ 测试中继器注册成功`);

  // 查询信用评级
  const rating = await credit.getCreditRating(await deployer.getAddress());
  console.log(`   ✅ 部署者信用评级: score=${rating.totalScore}, grade=${rating.grade}`);

  // ── 保存部署信息 ──
  const deployData: V12DeploymentData = {
    version: "V12.0.0",
    network: networkName,
    deployer: await deployer.getAddress(),
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    contracts: {
      relayRegistry: relayAddr,
      creditRating: creditAddr,
      reputationStaking: stakingAddr,
    },
    dependencies: {
      calcToken: calcTokenAddr,
      constitutionCourt: courtAddr,
      phiStaking: phiStakingAddr,
      laborMarket: laborMarketAddr,
    },
  };

  await saveDeployment(networkName, deployData);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ✅ Σ-Cloud V12.0 部署完成！`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  RelayRegistry:      ${relayAddr}`);
  console.log(`  CreditRating:       ${creditAddr}`);
  console.log(`  ReputationStaking:  ${stakingAddr}`);
  console.log(`  CalcToken:          ${calcTokenAddr}`);
  console.log(`  PhiStaking:         ${phiStakingAddr}`);
  console.log(`  ConstitutionCourt:  ${courtAddr}`);
  console.log(`  AILaborMarket:      ${laborMarketAddr}`);
  console.log(`${"═".repeat(60)}\n`);
}

async function saveDeployment(network: string, data: V12DeploymentData): Promise<void> {
  if (!fs.existsSync(DEPLOYMENT_DIR)) {
    fs.mkdirSync(DEPLOYMENT_DIR, { recursive: true });
  }

  const filePath = path.join(DEPLOYMENT_DIR, `v12_${network}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`\n📦 部署信息已保存：${filePath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(`\n❌ 部署失败：${error.message}`);
    console.error(error);
    process.exit(1);
  });
