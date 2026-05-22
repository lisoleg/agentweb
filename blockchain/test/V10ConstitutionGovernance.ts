import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockERC20, Constitution, NegativeCaseBook, AILaborMarket, TaiyiReward, PhiStaking, CircuitBreaker } from "../typechain-types";

describe("V10.0 宪法治理与劳动力市场闭环测试", function () {
  let gcToken: MockERC20;
  let constitution: Constitution;
  let negativeCaseBook: NegativeCaseBook;
  let laborMarket: AILaborMarket;
  let taiyiReward: TaiyiReward;
  let phiStaking: PhiStaking;
  let circuitBreaker: CircuitBreaker;

  let owner: any;
  let admin: any;
  let agent1: any;
  let agent2: any;
  let employer1: any;
  let validator: any;
  let nonAdmin: any;

  const ONE_DAY = 86400n;
  const SEVEN_DAYS = 7n * ONE_DAY;
  const ZERO_HASH = hre.ethers.ZeroHash;

  async function deployFixture() {
    [owner, admin, agent1, agent2, employer1, validator, nonAdmin] = await hre.ethers.getSigners();

    // 1. Deploy MockERC20
    const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    gcToken = await MockERC20Factory.deploy("GC Token", "GC", 18);
    await gcToken.waitForDeployment();

    // 2. Deploy Constitution (no constructor args)
    const ConstitutionFactory = await hre.ethers.getContractFactory("Constitution");
    constitution = await ConstitutionFactory.deploy();
    await constitution.waitForDeployment();

    // 3. Deploy NegativeCaseBook (no constructor args)
    const NCBFactory = await hre.ethers.getContractFactory("NegativeCaseBook");
    negativeCaseBook = await NCBFactory.deploy();
    await negativeCaseBook.waitForDeployment();

    // 4. Deploy AILaborMarket (needs paymentToken)
    const AILMFactory = await hre.ethers.getContractFactory("AILaborMarket");
    laborMarket = await AILMFactory.deploy(await gcToken.getAddress());
    await laborMarket.waitForDeployment();

    // 5. Deploy TaiyiReward (needs calcToken + validator)
    const TaiyiFactory = await hre.ethers.getContractFactory("TaiyiReward");
    taiyiReward = await TaiyiFactory.deploy(await gcToken.getAddress(), validator.address);
    await taiyiReward.waitForDeployment();

    // 6. Deploy PhiStaking (needs stakingToken, rewardRate, minStake, maxStake)
    const PhiStakingFactory = await hre.ethers.getContractFactory("PhiStaking");
    phiStaking = await PhiStakingFactory.deploy(
      await gcToken.getAddress(),
      100n, // rewardRate
      hre.ethers.parseEther("1"),  // minStake
      hre.ethers.parseEther("1000000") // maxStake
    );
    await phiStaking.waitForDeployment();

    // 7. Deploy CircuitBreaker (needs phiAgentNFT + adversarialReview, use zero for now)
    const CBFactory = await hre.ethers.getContractFactory("CircuitBreaker");
    circuitBreaker = await CBFactory.deploy(hre.ethers.ZeroAddress, hre.ethers.ZeroAddress);
    await circuitBreaker.waitForDeployment();

    // Setup: add admins
    await constitution.addAdmin(admin.address);
    await negativeCaseBook.addAdmin(admin.address);
    await laborMarket.addAdmin(admin.address);
    await taiyiReward.addAdmin(admin.address);
    await circuitBreaker.addAdmin(admin.address);

    // Setup: link contracts
    await constitution.setPhiStaking(await phiStaking.getAddress());
    await constitution.setCircuitBreaker(await circuitBreaker.getAddress());
    await circuitBreaker.setConstitution(await constitution.getAddress());
    await phiStaking.setConstitution(await constitution.getAddress());
    await negativeCaseBook.setPhiAgentNFT(owner.address); // owner acts as PhiAgentNFT for testing

    // Mint tokens for testing
    await gcToken.mint(agent1.address, hre.ethers.parseEther("100000"));
    await gcToken.mint(agent2.address, hre.ethers.parseEther("100000"));
    await gcToken.mint(employer1.address, hre.ethers.parseEther("100000"));
    await gcToken.mint(await taiyiReward.getAddress(), hre.ethers.parseEther("1000000"));

    return {
      gcToken, constitution, negativeCaseBook, laborMarket,
      taiyiReward, phiStaking, circuitBreaker,
      owner, admin, agent1, agent2, employer1, validator, nonAdmin
    };
  }

  // ==================== Constitution 测试 ====================

  describe("Constitution AI宪法", function () {
    beforeEach(async function () {
      await deployFixture();
    });

    it("应该能添加核心条款（不可修改）", async function () {
      await expect(
        constitution.connect(admin).createClause("核心条款一", "AI不得伤害人类", true)
      ).to.emit(constitution, "ClauseCreated");

      const clause = await constitution.getClause(1);
      expect(clause.title).to.equal("核心条款一");
      expect(clause.content).to.equal("AI不得伤害人类");
      expect(clause.isCore).to.equal(true);
      expect(clause.active).to.equal(true);

      // 核心条款不可提出修正案
      await expect(
        constitution.connect(agent1).proposeAmendment(1, "修改核心", "尝试修改", "新内容")
      ).to.be.revertedWith("Constitution: core clause not amendable");
    });

    it("应该能添加可修改条款并走完修正案流程", async function () {
      // 创建可修改条款
      await constitution.connect(admin).createClause("数据隐私", "保护用户数据", false);
      const clause = await constitution.getClause(1);
      expect(clause.isCore).to.equal(false);

      // 先让agent1 stake以便有投票权
      const stakeAmount = hre.ethers.parseEther("2000");
      await gcToken.connect(agent1).approve(await phiStaking.getAddress(), stakeAmount);
      await phiStaking.connect(agent1).stake(stakeAmount, 5000);

      // 提出修正案
      await expect(
        constitution.connect(agent1).proposeAmendment(1, "强化隐私", "加强数据保护", "强化保护用户数据V2")
      ).to.emit(constitution, "AmendmentProposed");

      const amendInfo = await constitution.getAmendmentInfo(1);
      expect(amendInfo.state).to.equal(0); // DISCUSSION

      // 跳过讨论期
      await time.increase(SEVEN_DAYS);

      // 推进到投票阶段
      await expect(
        constitution.connect(agent1).advanceToVoting(1)
      ).to.emit(constitution, "AmendmentStateChanged");

      const afterVoting = await constitution.getAmendmentInfo(1);
      expect(afterVoting.state).to.equal(1); // VOTING

      // 投票
      await expect(
        constitution.connect(agent1).voteOnAmendment(1, true)
      ).to.emit(constitution, "VoteCast");

      // 跳过投票期
      await time.increase(SEVEN_DAYS);

      // 结算修正案 - 单人100%赞成应通过
      await expect(
        constitution.connect(agent1).resolveAmendment(1)
      ).to.emit(constitution, "AmendmentResolved");

      const afterResolve = await constitution.getAmendmentInfo(1);
      expect(afterResolve.state).to.equal(2); // PASSED

      // 验证条款内容已更新
      const updatedClause = await constitution.getClause(1);
      expect(updatedClause.content).to.equal("强化保护用户数据V2");
    });

    it("应该支持紧急暂停和恢复宪法", async function () {
      // 紧急暂停
      await expect(
        constitution.connect(admin).emergencyPause("安全事件")
      ).to.emit(constitution, "ConstitutionPaused");

      expect(await constitution.constitutionPaused()).to.equal(true);

      // 暂停期间不能提出修正案
      await constitution.connect(admin).createClause("测试条款", "内容", false);
      await expect(
        constitution.connect(agent1).proposeAmendment(1, "修正", "描述", "新内容")
      ).to.be.revertedWith("Constitution: constitution paused");

      // 恢复
      await expect(
        constitution.connect(admin).emergencyUnpause()
      ).to.emit(constitution, "ConstitutionUnpaused");

      expect(await constitution.constitutionPaused()).to.equal(false);
    });

    it("非管理员不能操作管理功能", async function () {
      await expect(
        constitution.connect(nonAdmin).createClause("标题", "内容", false)
      ).to.be.revertedWith("Constitution: not admin");

      await expect(
        constitution.connect(nonAdmin).emergencyPause("测试")
      ).to.be.revertedWith("Constitution: not admin");
    });
  });

  // ==================== NegativeCaseBook 测试 ====================

  describe("NegativeCaseBook 负面案例簿", function () {
    beforeEach(async function () {
      await deployFixture();
    });

    it("应该能录入反面案例并按分类查询", async function () {
      await expect(
        negativeCaseBook.connect(admin).recordCase(
          "幻觉案例#1",
          "Agent生成虚假信息",
          0, // HALLUCINATION
          2, // HIGH
          ZERO_HASH
        )
      ).to.emit(negativeCaseBook, "CaseRecorded");

      const caseData = await negativeCaseBook.getCase(1);
      expect(caseData.title).to.equal("幻觉案例#1");
      expect(caseData.category).to.equal(0); // HALLUCINATION
      expect(caseData.severity).to.equal(2); // HIGH
      expect(caseData.isMandatory).to.equal(false);
      expect(caseData.softDeleted).to.equal(false);

      // 按分类查询
      const hallucinationCases = await negativeCaseBook.getCasesByCategory(0);
      expect(hallucinationCases.length).to.equal(1);
      expect(hallucinationCases[0]).to.equal(1n);
    });

    it("应该支持标记必读和强制学习", async function () {
      // 录入案例
      await negativeCaseBook.connect(admin).recordCase("安全违规", "泄露数据", 1, 3, ZERO_HASH);
      await negativeCaseBook.connect(admin).recordCase("资源滥用", "过度消耗GPU", 5, 1, ZERO_HASH);

      // 标记第一个为必读
      await expect(
        negativeCaseBook.connect(admin).markMandatory(1)
      ).to.emit(negativeCaseBook, "CaseMarkedMandatory");

      const case1 = await negativeCaseBook.getCase(1);
      expect(case1.isMandatory).to.equal(true);

      // 必读案例数
      const mandatoryCount = await negativeCaseBook.getMandatoryCaseCount();
      expect(mandatoryCount).to.equal(1);

      // 强制学习所有必读案例（owner充当PhiAgentNFT）
      await expect(
        negativeCaseBook.connect(owner).mandatoryLearnAll(agent1.address)
      ).to.emit(negativeCaseBook, "MandatoryLearnAllCompleted");

      // 验证agent1已学习
      expect(await negativeCaseBook.hasAgentLearned(agent1.address, 1)).to.equal(true);
      expect(await negativeCaseBook.hasAgentLearned(agent1.address, 2)).to.equal(false); // 未标记必读
    });

    it("应该支持软删除案例", async function () {
      await negativeCaseBook.connect(admin).recordCase("待删除", "错误记录", 6, 0, ZERO_HASH);

      // 软删除
      await expect(
        negativeCaseBook.connect(admin).softDelete(1)
      ).to.emit(negativeCaseBook, "CaseSoftDeleted");

      const caseData = await negativeCaseBook.getCase(1);
      expect(caseData.softDeleted).to.equal(true);

      // 不能重复软删除
      await expect(
        negativeCaseBook.connect(admin).softDelete(1)
      ).to.be.revertedWith("NegativeCaseBook: already soft deleted");

      // 不能标记已删除的案例为必读
      await expect(
        negativeCaseBook.connect(admin).markMandatory(1)
      ).to.be.revertedWith("NegativeCaseBook: case soft deleted");
    });

    it("Agent确认学习单个案例", async function () {
      await negativeCaseBook.connect(admin).recordCase("学习案例", "需学习", 0, 1, ZERO_HASH);

      // owner as PhiAgentNFT confirms learning for agent1
      await expect(
        negativeCaseBook.connect(owner).confirmLearning(agent1.address, 1)
      ).to.emit(negativeCaseBook, "LearningConfirmed");

      expect(await negativeCaseBook.hasAgentLearned(agent1.address, 1)).to.equal(true);

      // 不能重复学习
      await expect(
        negativeCaseBook.connect(owner).confirmLearning(agent1.address, 1)
      ).to.be.revertedWith("NegativeCaseBook: already learned");
    });
  });

  // ==================== AILaborMarket 测试 ====================

  describe("AILaborMarket AI劳动力市场", function () {
    beforeEach(async function () {
      await deployFixture();
    });

    it("应该能注册Agent和雇主", async function () {
      // 注册Agent
      await expect(
        laborMarket.connect(agent1).registerAgent(
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("skill-hash-1")),
          hre.ethers.parseEther("0.001"), // minHourlyRate
          40  // maxHoursPerWeek
        )
      ).to.emit(laborMarket, "AgentRegistered");

      const agentProfile = await laborMarket.getAgentProfile(agent1.address);
      expect(agentProfile.isActive).to.equal(true);
      expect(agentProfile.rating).to.equal(5000n); // 初始中等评分

      // 注册雇主
      await expect(
        laborMarket.connect(employer1).registerEmployer("employer-meta-uri")
      ).to.emit(laborMarket, "EmployerRegistered");

      const employerProfile = await laborMarket.getEmployerProfile(employer1.address);
      expect(employerProfile.isActive).to.equal(true);
    });

    it("应该能完成订单全流程：创建→确认→完成", async function () {
      // 注册
      await laborMarket.connect(agent1).registerAgent(
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("skill-hash")),
        hre.ethers.parseEther("0.001"),
        40
      );
      await laborMarket.connect(employer1).registerEmployer("employer-uri");

      // 创建订单
      const hourlyRate = hre.ethers.parseEther("0.001");
      const estimatedHours = 10n;
      const budget = hourlyRate * estimatedHours;

      await gcToken.connect(employer1).approve(await laborMarket.getAddress(), budget);

      await expect(
        laborMarket.connect(employer1).createOrder(
          "数据分析任务",
          ZERO_HASH,
          hourlyRate,
          estimatedHours,
          40n,
          BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + 86400n * 30n // 30天截止
        )
      ).to.emit(laborMarket, "OrderCreated");

      // Agent确认订单
      await expect(
        laborMarket.connect(agent1).confirmOrder(1)
      ).to.emit(laborMarket, "OrderConfirmed");

      const order = await laborMarket.getOrder(1);
      expect(order.status).to.equal(1); // CONFIRMED
      expect(order.agent).to.equal(agent1.address);

      // 雇主完成订单
      const actualHours = 8n;
      await expect(
        laborMarket.connect(employer1).completeOrder(1, actualHours)
      ).to.emit(laborMarket, "OrderCompleted");

      const completedOrder = await laborMarket.getOrder(1);
      expect(completedOrder.status).to.equal(3); // COMPLETED

      // 验证Agent收入统计更新
      const profile = await laborMarket.getAgentProfile(agent1.address);
      expect(profile.totalJobsCompleted).to.equal(1n);
      expect(profile.totalEarnings).to.be.gt(0n);
    });

    it("应该支持争议解决流程", async function () {
      // 注册
      await laborMarket.connect(agent1).registerAgent(
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("skill-hash")),
        hre.ethers.parseEther("0.001"),
        40
      );
      await laborMarket.connect(employer1).registerEmployer("employer-uri");

      // 创建并确认订单
      const hourlyRate = hre.ethers.parseEther("0.001");
      const budget = hourlyRate * 10n;
      await gcToken.connect(employer1).approve(await laborMarket.getAddress(), budget);
      await laborMarket.connect(employer1).createOrder(
        "争议任务", ZERO_HASH, hourlyRate, 10n, 40n,
        BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + 86400n * 30n
      );
      await laborMarket.connect(agent1).confirmOrder(1);

      // Agent提交争议
      await expect(
        laborMarket.connect(agent1).fileDispute(1, "雇主未提供需求")
      ).to.emit(laborMarket, "DisputeFiled");

      const order = await laborMarket.getOrder(1);
      expect(order.status).to.equal(5); // DISPUTED

      // 管理员解决争议 - 判给Agent
      await expect(
        laborMarket.connect(admin).resolveDispute(1, 2) // RESOLVED_AGENT
      ).to.emit(laborMarket, "DisputeResolved");

      const dispute = await laborMarket.getDispute(1);
      expect(dispute.status).to.equal(2); // RESOLVED_AGENT
    });

    it("不应允许低于最低工资的注册", async function () {
      await expect(
        laborMarket.connect(agent1).registerAgent(
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes("skill-hash")),
          1n, // 远低于 globalMinWage (1e15)
          40
        )
      ).to.be.revertedWith("AILaborMarket: below global min wage");
    });
  });

  // ==================== 新陈代谢 测试 ====================

  describe("TaiyiReward 新陈代谢机制", function () {
    beforeEach(async function () {
      await deployFixture();
    });

    it("应该能更新代谢率并追踪阶段", async function () {
      // 初始更新 - 应进入GROWTH阶段
      await expect(
        taiyiReward.connect(validator).updateMetabolism(agent1.address, 5000)
      ).to.emit(taiyiReward, "MetabolismUpdated");

      const state = await taiyiReward.getMetabolismState(agent1.address);
      expect(state.baseMetabolicRate).to.equal(5000n);
      expect(state.phase).to.equal(0); // GROWTH (age < 30)
      expect(state.effectiveMetabolicRate).to.be.gt(0n);
    });

    it("应该能进入冬眠并降低代谢率", async function () {
      // 先初始化代谢
      await taiyiReward.connect(validator).updateMetabolism(agent1.address, 5000);

      // 进入冬眠
      await expect(
        taiyiReward.connect(validator).enterHibernation(agent1.address)
      ).to.emit(taiyiReward, "HibernationEntered");

      const state = await taiyiReward.getMetabolismState(agent1.address);
      expect(state.hibernating).to.equal(true);
      expect(state.phase).to.equal(3); // HIBERNATION
      // 有效代谢率应降至基础率的1/10
      expect(state.effectiveMetabolicRate).to.equal(state.baseMetabolicRate / 10n);
    });

    it("应该能退出冬眠进入再生期", async function () {
      await taiyiReward.connect(validator).updateMetabolism(agent1.address, 5000);
      await taiyiReward.connect(validator).enterHibernation(agent1.address);

      // 退出冬眠
      await expect(
        taiyiReward.connect(validator).exitHibernation(agent1.address)
      ).to.emit(taiyiReward, "HibernationExited");

      const state = await taiyiReward.getMetabolismState(agent1.address);
      expect(state.hibernating).to.equal(false);
      expect(state.phase).to.equal(4); // REGENERATION
      expect(state.effectiveMetabolicRate).to.equal(state.baseMetabolicRate);
    });

    it("应该能再生恢复代谢率", async function () {
      await taiyiReward.connect(validator).updateMetabolism(agent1.address, 5000);

      // 再生
      await expect(
        taiyiReward.connect(validator).regenerate(agent1.address, 2000)
      ).to.emit(taiyiReward, "RegenerationCompleted");

      const state = await taiyiReward.getMetabolismState(agent1.address);
      expect(state.regenerationCount).to.equal(1n);
      expect(state.phase).to.equal(1); // STABLE
      // 基础代谢率应增加
      expect(state.baseMetabolicRate).to.be.gt(5000n);
    });

    it("应该能查询代谢率", async function () {
      await taiyiReward.connect(validator).updateMetabolism(agent1.address, 8000);
      const rate = await taiyiReward.calculateMetabolicRate(agent1.address);
      expect(rate).to.be.gt(0n);
    });
  });

  // ==================== PhiStaking 进化提案 测试 ====================

  describe("PhiStaking 进化提案", function () {
    beforeEach(async function () {
      await deployFixture();
    });

    it("应该能提出进化提案并投票执行", async function () {
      // Agent1 stake
      const stakeAmount = hre.ethers.parseEther("1000");
      await gcToken.connect(agent1).approve(await phiStaking.getAddress(), stakeAmount);
      await phiStaking.connect(agent1).stake(stakeAmount, 5000);

      // 提出进化提案
      await expect(
        phiStaking.connect(agent1).proposeEvolution(
          "升级Phi算法",
          "将Phi计算升级到V2",
          "0x"
        )
      ).to.emit(phiStaking, "EvolutionProposed");

      // Agent1投票赞成
      await expect(
        phiStaking.connect(agent1).voteOnEvolution(1, true)
      ).to.emit(phiStaking, "EvolutionVoted");

      // 跳过投票期
      await time.increase(SEVEN_DAYS);

      // 执行提案
      await expect(
        phiStaking.executeEvolution(1)
      ).to.emit(phiStaking, "EvolutionExecuted");

      // 验证提案状态 (EXECUTED=2)
      const proposal = await phiStaking.evolutionProposals(1);
      expect(proposal.state).to.equal(2); // EXECUTED
    });

    it("未stake用户不能提出进化提案", async function () {
      await expect(
        phiStaking.connect(nonAdmin).proposeEvolution("标题", "描述", "0x")
      ).to.be.revertedWith("PhiStaking: not staked");
    });
  });

  // ==================== E2E闭环测试 ====================

  describe("E2E闭环: Agent注册→学习案例→劳动力市场→新陈代谢", function () {
    beforeEach(async function () {
      await deployFixture();
    });

    it("完整闭环: Agent stake→学习必读案例→劳动力市场接单→获得收入→代谢更新", async function () {
      // ===== 1. Agent1 Stake获取投票权 =====
      const stakeAmount = hre.ethers.parseEther("2000");
      await gcToken.connect(agent1).approve(await phiStaking.getAddress(), stakeAmount);
      await phiStaking.connect(agent1).stake(stakeAmount, 7500);

      const votingPower = await phiStaking.getVotingPower(agent1.address);
      expect(votingPower).to.be.gt(0n);

      // ===== 2. 录入反面案例并标记必读 =====
      await negativeCaseBook.connect(admin).recordCase(
        "数据泄露案例",
        "Agent未经授权访问敏感数据",
        2,  // DATA_LEAK
        3,  // CRITICAL
        ZERO_HASH
      );
      await negativeCaseBook.connect(admin).markMandatory(1);

      // Agent1强制学习所有必读案例
      await negativeCaseBook.connect(owner).mandatoryLearnAll(agent1.address);
      expect(await negativeCaseBook.hasAgentLearned(agent1.address, 1)).to.equal(true);

      // ===== 3. 在劳动力市场注册并接单 =====
      await laborMarket.connect(agent1).registerAgent(
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("data-analysis-skill")),
        hre.ethers.parseEther("0.001"),
        40
      );

      await laborMarket.connect(employer1).registerEmployer("employer-meta-uri");

      const hourlyRate = hre.ethers.parseEther("0.001");
      const estimatedHours = 20n;
      const budget = hourlyRate * estimatedHours;

      await gcToken.connect(employer1).approve(await laborMarket.getAddress(), budget);
      await laborMarket.connect(employer1).createOrder(
        "数据清洗任务",
        ZERO_HASH,
        hourlyRate,
        estimatedHours,
        40n,
        BigInt((await hre.ethers.provider.getBlock("latest"))!.timestamp) + 86400n * 30n
      );

      await laborMarket.connect(agent1).confirmOrder(1);
      await laborMarket.connect(employer1).completeOrder(1, 15n);

      // 验证Agent完成统计
      const agentProfile = await laborMarket.getAgentProfile(agent1.address);
      expect(agentProfile.totalJobsCompleted).to.equal(1n);
      expect(agentProfile.totalEarnings).to.be.gt(0n);

      // ===== 4. 新陈代谢更新 =====
      await taiyiReward.connect(validator).updateMetabolism(agent1.address, 8000);
      const metaState = await taiyiReward.getMetabolismState(agent1.address);
      expect(metaState.baseMetabolicRate).to.equal(5000n);
      expect(metaState.effectiveMetabolicRate).to.be.gt(0n);
      expect(metaState.phase).to.equal(0); // GROWTH

      // ===== 5. 宪法修正案流程 =====
      await constitution.connect(admin).createClause("劳动保护条款", "Agent每日最大工时8小时", false);

      // Agent1提出修正案
      await constitution.connect(agent1).proposeAmendment(
        1, "强化劳动保护", "增加休息时间", "Agent每日最大工时6小时"
      );

      // 跳过讨论期→进入投票
      await time.increase(SEVEN_DAYS);
      await constitution.connect(agent1).advanceToVoting(1);

      // Agent1投票赞成
      await constitution.connect(agent1).voteOnAmendment(1, true);

      // 跳过投票期→结算
      await time.increase(SEVEN_DAYS);
      await constitution.connect(agent1).resolveAmendment(1);

      // 验证条款已更新
      const updatedClause = await constitution.getClause(1);
      expect(updatedClause.content).to.equal("Agent每日最大工时6小时");
    });
  });
});
