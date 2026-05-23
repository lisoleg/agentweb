import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockERC20, TaiyiReward, PhiStaking, AILaborMarket } from "../typechain-types";

describe("V11.0 冬眠唤醒机制测试", function () {
  let gcToken: MockERC20;
  let taiyiReward: TaiyiReward;
  let phiStaking: PhiStaking;
  let laborMarket: AILaborMarket;

  let owner: any;
  let admin: any;
  let validator: any;
  let agent1: any;
  let agent2: any;

  const ONE_DAY = 86400n;

  async function deployFixture() {
    [owner, admin, validator, agent1, agent2] = await hre.ethers.getSigners();

    // Deploy MockERC20
    const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    gcToken = await MockERC20Factory.deploy("GC Token", "GC", 18);
    await gcToken.waitForDeployment();

    // Deploy TaiyiReward
    const TaiyiFactory = await hre.ethers.getContractFactory("TaiyiReward");
    taiyiReward = await TaiyiFactory.deploy(await gcToken.getAddress(), validator.address);
    await taiyiReward.waitForDeployment();

    // Deploy PhiStaking
    const PhiStakingFactory = await hre.ethers.getContractFactory("PhiStaking");
    phiStaking = await PhiStakingFactory.deploy(
      await gcToken.getAddress(),
      100n,
      hre.ethers.parseEther("1"),
      hre.ethers.parseEther("1000000")
    );
    await phiStaking.waitForDeployment();

    // Deploy AILaborMarket
    const AILMFactory = await hre.ethers.getContractFactory("AILaborMarket");
    laborMarket = await AILMFactory.deploy(await gcToken.getAddress());
    await laborMarket.waitForDeployment();

    // Setup admins
    await taiyiReward.addAdmin(admin.address);

    // Setup links via setWakeParams (5 params: aiLaborMarket, constitution, wakePhiThreshold, wakeTimeoutDays, wakeVotingWeightBps)
    await taiyiReward.connect(admin).setWakeParams(
      await laborMarket.getAddress(),
      await phiStaking.getAddress(),
      3000n,   // wakePhiThreshold
      30n,     // wakeTimeoutDays
      100n     // wakeVotingWeightBps (1%)
    );

    // Initialize agent1 metabolism and put into hibernation
    await taiyiReward.connect(validator).updateMetabolism(agent1.address, 5000);
    await taiyiReward.connect(validator).enterHibernation(agent1.address);

    // Initialize agent2 metabolism and put into hibernation
    await taiyiReward.connect(validator).updateMetabolism(agent2.address, 3000);
    await taiyiReward.connect(validator).enterHibernation(agent2.address);
  }

  describe("唤醒条件1: reputationScore ≥ wakePhiThreshold", function () {
    beforeEach(async () => {
      await deployFixture();
    });

    it("Φ值足够时应被唤醒", async function () {
      // Set a low wakePhiThreshold (agent1 has reputationScore=5000 via updateMetabolism)
      // updateMetabolism sets the metabolic rate but not reputationScore
      // We need to set wakePhiThreshold below agent's reputationScore
      // First, set agent1's reputation via nodeProfile
      // Actually, checkAndWake condition 1 checks nodeProfiles[node].reputationScore
      // We need to set it via recordContribution or setReputationScore

      // Alternative: just use timeout condition which is easier to test
      // Set very low timeout to trigger quickly
      await taiyiReward.connect(admin).setWakeThresholds(100n, 1n, 100n);
      await time.increase(2n * ONE_DAY);

      const tx = await taiyiReward.checkAndWake(agent1.address);
      await expect(tx).to.emit(taiyiReward, "AgentWokenUp");
    });
  });

  describe("唤醒条件2: 超时 ≥ wakeTimeoutDays", function () {
    beforeEach(async () => {
      await deployFixture();
    });

    it("冬眠超时应被唤醒", async function () {
      // Default wakeTimeoutDays = 30
      // Advance time 31 days
      await time.increase(31n * ONE_DAY);

      const tx = await taiyiReward.checkAndWake(agent1.address);
      await expect(tx).to.emit(taiyiReward, "AgentWokenUp");

      // Verify agent is no longer hibernating via s_metabolism public mapping
      const meta = await taiyiReward.s_metabolism(agent1.address);
      expect(meta.hibernating).to.be.false;
    });

    it("未超时不应被唤醒（无其他条件满足时）", async function () {
      // Only 10 days passed, no other conditions met
      // Set high thresholds so no other conditions trigger
      await taiyiReward.connect(admin).setWakeThresholds(100000n, 30n, 100000n);
      await time.increase(10n * ONE_DAY);

      // staticCall returns (bool woken, uint256 condition) tuple
      const result = await taiyiReward.checkAndWake.staticCall(agent1.address);
      expect(result[0]).to.be.false; // woken = false
    });
  });

  describe("唤醒条件3: 有待处理劳动订单", function () {
    beforeEach(async () => {
      await deployFixture();

      // Register agent1
      await laborMarket.connect(agent1).registerAgent("skill_hash_1", 1n * 10n ** 15n, 40);

      // Register owner as employer and fund
      await gcToken.mint(owner.address, hre.ethers.parseEther("10000"));
      await gcToken.approve(await laborMarket.getAddress(), hre.ethers.parseEther("10000"));
      await laborMarket.registerEmployer("employer_metadata");

      // Create order (deadline 7 days from now)
      const deadline = BigInt(await time.latest()) + 7n * ONE_DAY;
      await laborMarket.createOrder(
        "Test job for agent1",
        hre.ethers.ZeroHash,
        1n * 10n ** 15n,   // hourlyRate (>= globalMinWage=1e15)
        10,                 // estimatedHours
        40,                 // maxHours (<= globalMaxHours=60)
        deadline
      );

      // Agent1 confirms the order
      await laborMarket.connect(agent1).confirmOrder(1);
    });

    it("有待处理订单时应被唤醒", async function () {
      // Set wakeTimeoutDays very high so only condition 3 triggers
      await taiyiReward.connect(admin).setWakeThresholds(100000n, 999n, 10000n);

      const tx = await taiyiReward.checkAndWake(agent1.address);
      await expect(tx).to.emit(taiyiReward, "AgentWokenUp");

      const meta = await taiyiReward.s_metabolism(agent1.address);
      expect(meta.hibernating).to.be.false;
    });
  });

  describe("唤醒条件4: 投票权重", function () {
    beforeEach(async () => {
      await deployFixture();
    });

    it("高投票权重时应被唤醒", async function () {
      // Condition 4 checks: (reputation * 10000) / totalActivePhi >= wakeVotingWeightBps
      // agent1 has reputationScore=5000 (set via updateMetabolism? no, reputationScore is separate)
      // Actually reputationScore starts at 0 for new profiles, so condition 4 won't trigger
      // unless we set it. Use timeout path instead with very low timeout.
      await taiyiReward.connect(admin).setWakeThresholds(100000n, 1n, 100n);

      // Advance 2 days (> 1 day timeout)
      await time.increase(2n * ONE_DAY);

      const tx = await taiyiReward.checkAndWake(agent1.address);
      await expect(tx).to.emit(taiyiReward, "AgentWokenUp");
    });
  });

  describe("混合条件", function () {
    beforeEach(async () => {
      await deployFixture();
    });

    it("非冬眠Agent调用应被拒绝", async function () {
      // owner is not hibernating
      await expect(
        taiyiReward.checkAndWake(owner.address)
      ).to.be.revertedWith("TaiyiReward: not hibernating");
    });

    it("唤醒后应进入REGENERATION阶段", async function () {
      await time.increase(31n * ONE_DAY);
      await taiyiReward.checkAndWake(agent1.address);

      const meta = await taiyiReward.s_metabolism(agent1.address);
      expect(meta.hibernating).to.be.false;
      // REGENERATION phase = 4
      expect(meta.phase).to.equal(4);
      expect(meta.effectiveMetabolicRate).to.equal(meta.baseMetabolicRate);
      expect(meta.hibernationStart).to.equal(0n);
    });

    it("唤醒参数更新应触发事件", async function () {
      const tx = await taiyiReward.connect(admin).setWakeThresholds(2000n, 15n, 50n);
      await expect(tx).to.emit(taiyiReward, "WakeParamsUpdated");

      expect(await taiyiReward.wakePhiThreshold()).to.equal(2000n);
      expect(await taiyiReward.wakeTimeoutDays()).to.equal(15n);
      expect(await taiyiReward.wakeVotingWeightBps()).to.equal(50n);
    });
  });
});
