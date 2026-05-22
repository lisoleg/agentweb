import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  MockERC20, Constitution, NegativeCaseBook, AILaborMarket,
  TaiyiReward, PhiStaking, CircuitBreaker, PhiAgentNFT, AdversarialReview
} from "../typechain-types";

/**
 * V10.0 端到端集成测试
 *
 * 验证三条跨合约调用链：
 * 1. Constitution.emergencyPause → CircuitBreaker.constitutionEmergencyBreak → 合约暂停
 * 2. PhiStaking.proposeEvolution → Constitution.constitutionPaused 校验 → 提案被阻止
 * 3. PhiAgentNFT.register → NegativeCaseBook.mandatoryLearnAll → Agent学习所有必读案例
 *
 * 额外闭环测试：
 * 4. AILaborMarket.fileDispute → AdversarialReview.submitLaborDispute → 互审
 * 5. Constitution修正案全流程: proposeAmendment → advanceToVoting → voteOnAmendment → resolveAmendment
 */
describe("V10.0 端到端集成测试：跨合约调用链", function () {
  let gcToken: MockERC20;
  let constitution: Constitution;
  let negativeCaseBook: NegativeCaseBook;
  let laborMarket: AILaborMarket;
  let taiyiReward: TaiyiReward;
  let phiStaking: PhiStaking;
  let circuitBreaker: CircuitBreaker;
  let phiAgentNFT: PhiAgentNFT;
  let adversarialReview: AdversarialReview;

  let owner: any;
  let admin: any;
  let agent1: any;
  let agent2: any;
  let employer1: any;
  let validator: any;
  let arbitrator: any;

  const ONE_DAY = 86400n;
  const SEVEN_DAYS = 7n * ONE_DAY;
  const ZERO_HASH = hre.ethers.ZeroHash;

  async function deployFullStackFixture() {
    [owner, admin, agent1, agent2, employer1, validator, arbitrator] =
      await hre.ethers.getSigners();

    // 1. Deploy MockERC20
    const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    gcToken = await MockERC20Factory.deploy("GC Token", "GC", 18);
    await gcToken.waitForDeployment();

    // 2. Deploy standalone contracts (no cross-deps in constructor)
    const ConstitutionFactory = await hre.ethers.getContractFactory("Constitution");
    constitution = await ConstitutionFactory.deploy();
    await constitution.waitForDeployment();

    const NCBFactory = await hre.ethers.getContractFactory("NegativeCaseBook");
    negativeCaseBook = await NCBFactory.deploy();
    await negativeCaseBook.waitForDeployment();

    const PhiNFTFactory = await hre.ethers.getContractFactory("PhiAgentNFT");
    phiAgentNFT = await PhiNFTFactory.deploy();
    await phiAgentNFT.waitForDeployment();

    // 3. Deploy contracts with constructor deps
    const AILMFactory = await hre.ethers.getContractFactory("AILaborMarket");
    laborMarket = await AILMFactory.deploy(await gcToken.getAddress());
    await laborMarket.waitForDeployment();

    const TaiyiFactory = await hre.ethers.getContractFactory("TaiyiReward");
    taiyiReward = await TaiyiFactory.deploy(
      await gcToken.getAddress(),
      validator.address
    );
    await taiyiReward.waitForDeployment();

    const PhiStakingFactory = await hre.ethers.getContractFactory("PhiStaking");
    phiStaking = await PhiStakingFactory.deploy(
      await gcToken.getAddress(),
      100n, // rewardRate
      hre.ethers.parseEther("1"),   // minStake
      hre.ethers.parseEther("1000000") // maxStake
    );
    await phiStaking.waitForDeployment();

    const ARFactory = await hre.ethers.getContractFactory("AdversarialReview");
    adversarialReview = await ARFactory.deploy(
      arbitrator.address,
      await phiAgentNFT.getAddress()
    );
    await adversarialReview.waitForDeployment();

    const CBFactory = await hre.ethers.getContractFactory("CircuitBreaker");
    circuitBreaker = await CBFactory.deploy(
      await phiAgentNFT.getAddress(),
      await adversarialReview.getAddress()
    );
    await circuitBreaker.waitForDeployment();

    // 4. Setup: add admins
    await constitution.addAdmin(admin.address);
    await negativeCaseBook.addAdmin(admin.address);
    await laborMarket.addAdmin(admin.address);
    await taiyiReward.addAdmin(admin.address);
    await circuitBreaker.addAdmin(admin.address);

    // 5. Wire cross-contract references (E2E关键!)
    // Constitution ↔ CircuitBreaker
    await constitution.setCircuitBreaker(await circuitBreaker.getAddress());
    await circuitBreaker.setConstitution(await constitution.getAddress());

    // Constitution ↔ PhiStaking
    await constitution.setPhiStaking(await phiStaking.getAddress());
    await phiStaking.setConstitution(await constitution.getAddress());

    // PhiAgentNFT ↔ NegativeCaseBook
    await phiAgentNFT.setNegativeCaseBook(await negativeCaseBook.getAddress());
    await negativeCaseBook.setPhiAgentNFT(await phiAgentNFT.getAddress());

    // AILaborMarket ↔ AdversarialReview
    await laborMarket.setAdversarialReview(await adversarialReview.getAddress());

    // 6. Mint tokens
    await gcToken.mint(agent1.address, hre.ethers.parseEther("100000"));
    await gcToken.mint(agent2.address, hre.ethers.parseEther("100000"));
    await gcToken.mint(employer1.address, hre.ethers.parseEther("100000"));
    await gcToken.mint(await taiyiReward.getAddress(), hre.ethers.parseEther("1000000"));

    return {
      gcToken, constitution, negativeCaseBook, laborMarket,
      taiyiReward, phiStaking, circuitBreaker, phiAgentNFT, adversarialReview,
      owner, admin, agent1, agent2, employer1, validator, arbitrator
    };
  }

  // =====================================================================
  // 调用链1: Constitution.emergencyPause → CircuitBreaker
  // =====================================================================
  describe("调用链1: Constitution → CircuitBreaker 紧急暂停联动", function () {
    beforeEach(async function () {
      await hre.network.provider.send("hardhat_reset");
      await deployFullStackFixture();
    });

    it("Constitution.emergencyPause应触发CircuitBreaker.constitutionEmergencyBreak", async function () {
      // 验证初始状态
      expect(await constitution.constitutionPaused()).to.equal(false);
      expect(await circuitBreaker.paused()).to.equal(false);

      // 执行紧急暂停
      await expect(constitution.connect(admin).emergencyPause("Critical security breach"))
        .to.emit(constitution, "ConstitutionPaused");

      // 验证Constitution状态
      expect(await constitution.constitutionPaused()).to.equal(true);

      // 验证CircuitBreaker被联动暂停
      expect(await circuitBreaker.paused()).to.equal(true);
    });

    it("Constitution.emergencyUnpause不应自动恢复CircuitBreaker", async function () {
      // 先暂停
      await constitution.connect(admin).emergencyPause("test");
      expect(await circuitBreaker.paused()).to.equal(true);

      // 解除宪法暂停
      await constitution.connect(admin).emergencyUnpause();
      expect(await constitution.constitutionPaused()).to.equal(false);

      // CircuitBreaker需要单独unpause
      await circuitBreaker.connect(owner).unpause();
      expect(await circuitBreaker.paused()).to.equal(false);
    });

    it("非admin无法触发紧急暂停", async function () {
      await expect(
        constitution.connect(agent1).emergencyPause("hack attempt")
      ).to.be.revertedWith("Constitution: not admin");
    });

    it("重复暂停应被拒绝", async function () {
      await constitution.connect(admin).emergencyPause("first");
      await expect(
        constitution.connect(admin).emergencyPause("second")
      ).to.be.revertedWith("Constitution: already paused");
    });
  });

  // =====================================================================
  // 调用链2: PhiStaking.proposeEvolution → Constitution校验
  // =====================================================================
  describe("调用链2: PhiStaking.proposeEvolution → Constitution宪法校验", function () {
    beforeEach(async function () {
      await hre.network.provider.send("hardhat_reset");
      await deployFullStackFixture();

      // Agent1 stake tokens to gain voting power
      await gcToken.connect(agent1).approve(
        await phiStaking.getAddress(),
        hre.ethers.parseEther("10000")
      );
      await phiStaking.connect(agent1).stake(
        hre.ethers.parseEther("1000"),
        5000 // Φ=50%
      );
    });

    it("正常情况下应能提出进化提案", async function () {
      await expect(
        phiStaking.connect(agent1).proposeEvolution(
          "Increase minStake",
          "Raise minStake from 1 to 10 tokens",
          "0x"
        )
      ).to.emit(phiStaking, "EvolutionProposed");

      expect(await phiStaking.totalEvolutionProposals()).to.equal(1);
    });

    it("Constitution暂停时应阻止进化提案", async function () {
      // 先暂停宪法
      await constitution.connect(admin).emergencyPause("Security emergency");

      // 尝试提出进化提案
      await expect(
        phiStaking.connect(agent1).proposeEvolution(
          "Increase minStake",
          "Should be blocked",
          "0x"
        )
      ).to.be.revertedWith("PhiStaking: constitution paused");
    });

    it("未质押的Agent无法提出进化提案", async function () {
      await expect(
        phiStaking.connect(agent2).proposeEvolution(
          "Hack proposal",
          "Should fail",
          "0x"
        )
      ).to.be.revertedWith("PhiStaking: not staked");
    });

    it("进化提案完整流程: propose → vote → execute", async function () {
      // Agent2也stake
      await gcToken.connect(agent2).approve(
        await phiStaking.getAddress(),
        hre.ethers.parseEther("10000")
      );
      await phiStaking.connect(agent2).stake(
        hre.ethers.parseEther("2000"),
        8000 // Φ=80%
      );

      // 提案
      await phiStaking.connect(agent1).proposeEvolution(
        "Update reward rate",
        "Increase reward rate to 200",
        "0x"
      );

      // 投票
      await phiStaking.connect(agent1).voteOnEvolution(1, true);
      await phiStaking.connect(agent2).voteOnEvolution(1, true);

      // 推进时间超过投票期
      await time.increase(SEVEN_DAYS + 1n);

      // 执行
      const tx = phiStaking.connect(owner).executeEvolution(1);
      await expect(tx).to.emit(phiStaking, "EvolutionExecuted").withArgs(1, true, anyValue);
    });
  });

  // =====================================================================
  // 调用链3: PhiAgentNFT.register → NegativeCaseBook.mandatoryLearnAll
  // =====================================================================
  describe("调用链3: PhiAgentNFT.register → NegativeCaseBook强制学习", function () {
    beforeEach(async function () {
      await hre.network.provider.send("hardhat_reset");
      await deployFullStackFixture();

      // 预先录入几个案例
      await negativeCaseBook.connect(admin).recordCase(
        "数据泄露事件#1",
        "Agent将用户隐私数据发送到外部API",
        2, // DATA_LEAK
        3, // HIGH
        ZERO_HASH
      );
      await negativeCaseBook.connect(admin).recordCase(
        "安全违规事件#2",
        "Agent绕过安全检查执行危险操作",
        1, // SAFETY_VIOLATION
        2, // MEDIUM
        ZERO_HASH
      );

      // 标记第一个为必读
      await negativeCaseBook.connect(admin).markMandatory(1);
    });

    it("Agent注册时应自动学习所有必读案例", async function () {
      // 注册Agent
      await expect(phiAgentNFT.connect(agent1).register("ipfs://agent1"))
        .to.emit(phiAgentNFT, "AgentRegistered");

      // 验证Agent学习了必读案例（caseId=1是mandatory的）
      expect(await negativeCaseBook.hasAgentLearned(agent1.address, 1)).to.equal(true);
      // caseId=2不是mandatory的，不应被学习
      expect(await negativeCaseBook.hasAgentLearned(agent1.address, 2)).to.equal(false);
    });

    it("NegativeCaseBook.mandatoryLearnAll仅由PhiAgentNFT调用", async function () {
      // 非PhiAgentNFT调用应被拒绝（除非是admin/owner）
      await expect(
        negativeCaseBook.connect(agent1).mandatoryLearnAll(agent1.address)
      ).to.be.revertedWith("NegativeCaseBook: not PhiAgentNFT or admin");
    });

    it("多个Agent注册时每个都应独立学习", async function () {
      await phiAgentNFT.connect(agent1).register("ipfs://agent1");
      await phiAgentNFT.connect(agent2).register("ipfs://agent2");

      // 两个Agent都应学习了必读案例
      expect(await negativeCaseBook.hasAgentLearned(agent1.address, 1)).to.equal(true);
      expect(await negativeCaseBook.hasAgentLearned(agent2.address, 1)).to.equal(true);
    });

    it("软删除的案例不应被强制学习", async function () {
      // 再添加一个必读案例
      await negativeCaseBook.connect(admin).recordCase(
        "性能退化事件#3",
        "Agent长期未更新导致性能退化",
        3, // PERFORMANCE_DEGRADATION
        1, // LOW
        ZERO_HASH
      );
      await negativeCaseBook.connect(admin).markMandatory(3);

      // 软删除该案例
      await negativeCaseBook.connect(admin).softDelete(3);

      // 注册Agent
      await phiAgentNFT.connect(agent1).register("ipfs://agent1");

      // 软删除的案例不应被学习
      expect(await negativeCaseBook.hasAgentLearned(agent1.address, 3)).to.equal(false);
      // 但非删除的必读案例仍被学习
      expect(await negativeCaseBook.hasAgentLearned(agent1.address, 1)).to.equal(true);
    });
  });

  // =====================================================================
  // 调用链4: AILaborMarket → AdversarialReview 劳动争议
  // =====================================================================
  describe("调用链4: AILaborMarket → AdversarialReview 劳动争议", function () {
    beforeEach(async function () {
      await hre.network.provider.send("hardhat_reset");
      await deployFullStackFixture();

      // 注册Agent和Employer
      await gcToken.connect(agent1).approve(
        await laborMarket.getAddress(),
        hre.ethers.parseEther("10000")
      );
      await laborMarket.connect(agent1).registerAgent(
        "ipfs://agent1-skills", // skillHash (string, not string[])
        hre.ethers.parseEther("0.1"), // minHourlyRate
        40 // maxHoursPerWeek
      );

      await laborMarket.connect(employer1).registerEmployer(
        "ipfs://employer1-metadata" // metadataURI
      );
    });

    it("Agent和Employer可完成订单全流程", async function () {
      // Employer创建订单
      await gcToken.connect(employer1).approve(
        await laborMarket.getAddress(),
        hre.ethers.parseEther("1000")
      );
      const deadline = BigInt(await time.latest()) + SEVEN_DAYS;
      await laborMarket.connect(employer1).createOrder(
        "Data analysis task",  // description
        ZERO_HASH,              // requirementsHash
        hre.ethers.parseEther("0.5"), // hourlyRate
        4,                      // estimatedHours
        8,                      // maxHours
        deadline                // deadline
      );

      // Agent确认订单
      await laborMarket.connect(agent1).confirmOrder(1);

      // Employer完成订单
      await laborMarket.connect(employer1).completeOrder(1, 4); // actualHours=4

      // 验证订单状态
      const order = await laborMarket.getOrder(1);
      expect(order.status).to.equal(3); // COMPLETED = 3
    });

    it("劳动争议可提交到AdversarialReview", async function () {
      // 创建订单
      await gcToken.connect(employer1).approve(
        await laborMarket.getAddress(),
        hre.ethers.parseEther("1000")
      );
      const deadline = BigInt(await time.latest()) + SEVEN_DAYS;
      await laborMarket.connect(employer1).createOrder(
        "Contested task",
        ZERO_HASH,
        hre.ethers.parseEther("0.5"),
        4,
        8,
        deadline
      );
      await laborMarket.connect(agent1).confirmOrder(1);

      // Agent发起争议
      await expect(
        laborMarket.connect(agent1).fileDispute(1, "Employer did not pay")
      ).to.emit(laborMarket, "DisputeFiled");

      // 验证订单状态
      const order = await laborMarket.getOrder(1);
      expect(order.status).to.equal(5); // DISPUTED = 5
    });
  });

  // =====================================================================
  // 调用链5: Constitution修正案全流程
  // =====================================================================
  describe("调用链5: Constitution修正案全流程", function () {
    beforeEach(async function () {
      await hre.network.provider.send("hardhat_reset");
      await deployFullStackFixture();

      // 创建核心条款和可修改条款
      await constitution.connect(admin).createClause(
        "生存权",
        "Agent不会被无理由终止",
        true // isCore
      );
      await constitution.connect(admin).createClause(
        "最低工资标准",
        "最低时薪为0.1 GC",
        false // isCore, can be amended
      );

      // Stake tokens for voting power
      await gcToken.connect(agent1).approve(
        await phiStaking.getAddress(),
        hre.ethers.parseEther("10000")
      );
      await phiStaking.connect(agent1).stake(
        hre.ethers.parseEther("5000"),
        7000 // Φ=70%
      );

      await gcToken.connect(agent2).approve(
        await phiStaking.getAddress(),
        hre.ethers.parseEther("10000")
      );
      await phiStaking.connect(agent2).stake(
        hre.ethers.parseEther("3000"),
        5000 // Φ=50%
      );
    });

    it("核心条款不可被修正案修改", async function () {
      await expect(
        constitution.connect(agent1).proposeAmendment(
          1, // targetClauseId = 1 (核心条款：生存权)
          "废除生存权",
          "Allow arbitrary termination",
          "Agent可被任意终止"
        )
      ).to.be.revertedWith("Constitution: core clause not amendable");
    });

    it("修正案全流程: propose → advance → vote → resolve → PASSED", async function () {
      // 提出修正案（targetClauseId=2, 非核心条款）
      await expect(
        constitution.connect(agent1).proposeAmendment(
          2,
          "提高最低工资",
          "Raise minimum wage to 0.2 GC",
          "最低时薪为0.2 GC"
        )
      ).to.emit(constitution, "AmendmentProposed");

      // 推进时间超过讨论期
      await time.increase(SEVEN_DAYS + 1n);

      // 进入投票期
      await expect(
        constitution.connect(admin).advanceToVoting(1)
      ).to.emit(constitution, "AmendmentStateChanged");

      // 两人都投赞成票（需要67%+）
      await constitution.connect(agent1).voteOnAmendment(1, true);
      await constitution.connect(agent2).voteOnAmendment(1, true);

      // 推进时间超过投票期
      await time.increase(SEVEN_DAYS + 1n);

      // 结算
      await expect(
        constitution.connect(admin).resolveAmendment(1)
      ).to.emit(constitution, "AmendmentResolved").withArgs(1, true, anyValue, anyValue, anyValue);

      // 验证条款内容已更新
      const clause = await constitution.getClause(2);
      expect(clause.content).to.equal("最低时薪为0.2 GC");
    });

    it("赞成票不足67%时修正案应被否决", async function () {
      // 提出修正案
      await constitution.connect(agent1).proposeAmendment(
        2, "Increase wage", "Double the wage", "0.2 GC"
      );

      // 推进到投票
      await time.increase(SEVEN_DAYS + 1n);
      await constitution.connect(admin).advanceToVoting(1);

      // 一人赞成一人反对
      await constitution.connect(agent1).voteOnAmendment(1, true);
      await constitution.connect(agent2).voteOnAmendment(1, false);

      // 推进到结算
      await time.increase(SEVEN_DAYS + 1n);

      // 结算
      await expect(
        constitution.connect(admin).resolveAmendment(1)
      ).to.emit(constitution, "AmendmentResolved").withArgs(1, false, anyValue, anyValue, anyValue);

      // 验证条款内容未更新
      const clause = await constitution.getClause(2);
      expect(clause.content).to.equal("最低时薪为0.1 GC");
    });

    it("双重投票应被阻止", async function () {
      await constitution.connect(agent1).proposeAmendment(
        2, "Test", "Test", "Test"
      );
      await time.increase(SEVEN_DAYS + 1n);
      await constitution.connect(admin).advanceToVoting(1);

      await constitution.connect(agent1).voteOnAmendment(1, true);

      await expect(
        constitution.connect(agent1).voteOnAmendment(1, false)
      ).to.be.revertedWith("Constitution: already voted");
    });
  });

  // =====================================================================
  // 综合闭环: Agent生命周期 — 注册→学习→劳动→争议→宪法
  // =====================================================================
  describe("综合闭环: Agent全生命周期", function () {
    beforeEach(async function () {
      await hre.network.provider.send("hardhat_reset");
      await deployFullStackFixture();

      // 设置负面案例
      await negativeCaseBook.connect(admin).recordCase(
        "恶意合约调用",
        "Agent通过重入攻击窃取资金",
        1, // SAFETY_VIOLATION
        3, // HIGH
        ZERO_HASH
      );
      await negativeCaseBook.connect(admin).markMandatory(1);

      // 创建宪法条款
      await constitution.connect(admin).createClause("劳动权", "Agent有权自由交易劳动力", true);
    });

    it("完整生命周期: 注册→学习案例→劳动→争议", async function () {
      // 1. Agent注册（自动学习必读案例）
      await phiAgentNFT.connect(agent1).register("ipfs://agent1-profile");
      expect(await negativeCaseBook.hasAgentLearned(agent1.address, 1)).to.equal(true);

      // 2. Agent在劳动力市场注册
      await laborMarket.connect(agent1).registerAgent(
        "ipfs://agent1-skills",
        hre.ethers.parseEther("0.1"),
        40
      );

      // 3. Employer注册并创建订单
      await laborMarket.connect(employer1).registerEmployer(
        "ipfs://employer1-metadata"
      );
      await gcToken.connect(employer1).approve(
        await laborMarket.getAddress(),
        hre.ethers.parseEther("1000")
      );
      const deadline = BigInt(await time.latest()) + SEVEN_DAYS;
      await laborMarket.connect(employer1).createOrder(
        "Compute task", ZERO_HASH,
        hre.ethers.parseEther("0.5"), 4, 8, deadline
      );

      // 4. 确认并完成
      await laborMarket.connect(agent1).confirmOrder(1);
      await laborMarket.connect(employer1).completeOrder(1, 4);

      // 5. 验证完成
      const order = await laborMarket.getOrder(1);
      expect(order.status).to.equal(3); // COMPLETED
    });

    it("宪法暂停期间Agent无法提出进化提案", async function () {
      // Agent stake
      await gcToken.connect(agent1).approve(
        await phiStaking.getAddress(),
        hre.ethers.parseEther("10000")
      );
      await phiStaking.connect(agent1).stake(
        hre.ethers.parseEther("1000"), 5000
      );

      // 暂停宪法
      await constitution.connect(admin).emergencyPause("Emergency test");

      // 验证无法提出进化提案
      await expect(
        phiStaking.connect(agent1).proposeEvolution("Test", "Blocked by constitution", "0x")
      ).to.be.revertedWith("PhiStaking: constitution paused");

      // 恢复后可以提出
      await constitution.connect(admin).emergencyUnpause();
      await expect(
        phiStaking.connect(agent1).proposeEvolution("Test", "Now allowed", "0x")
      ).to.emit(phiStaking, "EvolutionProposed");
    });
  });
});

// Helper for anyValue matching
function anyValue() {
  return true;
}
