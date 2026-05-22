import { expect } from "chai";
import hre from "hardhat";
import { MockERC20, GCCRental, AIResourceConsumption, TaiyiReward } from "../typechain-types";

describe("V9.0 硅基自主经济体闭环测试", function () {
  let gcToken: MockERC20;
  let gccRental: GCCRental;
  let aiResource: AIResourceConsumption;
  let taiyiReward: TaiyiReward;

  let owner: any;
  let agent1: any;
  let agent2: any;
  let validator: any;

  const GC_UNIT = hre.ethers.parseEther("1");

  beforeEach(async function () {
    [owner, agent1, agent2, validator] = await hre.ethers.getSigners();

    // 部署MockERC20 (GC Token)
    const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    gcToken = await MockERC20Factory.deploy("GC Token", "GC", 18);
    await gcToken.waitForDeployment();

    // 部署GCCRental (phiAgentNFT和phi402用零地址占位)
    const GCCRentalFactory = await hre.ethers.getContractFactory("GCCRental");
    gccRental = await GCCRentalFactory.deploy(
      await gcToken.getAddress(),
      hre.ethers.ZeroAddress,
      hre.ethers.ZeroAddress
    );
    await gccRental.waitForDeployment();

    // 部署AIResourceConsumption
    const AIResourceFactory = await hre.ethers.getContractFactory("AIResourceConsumption");
    aiResource = await AIResourceFactory.deploy(
      await gcToken.getAddress(),
      await gccRental.getAddress(),
      hre.ethers.ZeroAddress
    );
    await aiResource.waitForDeployment();

    // 部署TaiyiReward (需要calcToken + validator)
    const TaiyiRewardFactory = await hre.ethers.getContractFactory("TaiyiReward");
    taiyiReward = await TaiyiRewardFactory.deploy(await gcToken.getAddress(), validator.address);
    await taiyiReward.waitForDeployment();

    // 给agent1和agent2发放GC
    await gcToken.mint(agent1.address, hre.ethers.parseEther("1000"));
    await gcToken.mint(agent2.address, hre.ethers.parseEther("1000"));

    // 设置admin
    await gccRental.addAdmin(owner.address);
    await aiResource.addAdmin(owner.address);
    await taiyiReward.addAdmin(owner.address);

    // 注册GPU节点
    await gccRental.registerGpuNode(
      owner.address, 1, 10, "us-west-1"
    );
  });

  // ==================== GCCRental 测试 ====================

  describe("GCCRental 香火钱算力租金", function () {
    it("应该能租用STANDARD档GPU", async function () {
      const depositAmount = hre.ethers.parseEther("10");
      await gcToken.connect(agent1).approve(await gccRental.getAddress(), depositAmount);

      await expect(
        gccRental.connect(agent1).rent(1, 1, 0, depositAmount)
      ).to.emit(gccRental, "Rented");

      const rental = await gccRental.getAgentRental(1);
      expect(rental.status).to.equal(1); // ACTIVE
      expect(rental.planType).to.equal(1); // STANDARD
      expect(rental.gcDeposited).to.equal(depositAmount);
    });

    it("应该能续费租约", async function () {
      const depositAmount = hre.ethers.parseEther("10");
      await gcToken.connect(agent1).approve(await gccRental.getAddress(), depositAmount);
      await gccRental.connect(agent1).rent(1, 1, 0, depositAmount);

      const renewAmount = hre.ethers.parseEther("5");
      await gcToken.connect(agent1).approve(await gccRental.getAddress(), renewAmount);
      await expect(
        gccRental.connect(agent1).renew(1, renewAmount)
      ).to.emit(gccRental, "Renewed");

      const rental = await gccRental.getAgentRental(1);
      expect(rental.gcDeposited).to.equal(hre.ethers.parseEther("15"));
    });

    it("应该能断开租约", async function () {
      const depositAmount = hre.ethers.parseEther("10");
      await gcToken.connect(agent1).approve(await gccRental.getAddress(), depositAmount);
      await gccRental.connect(agent1).rent(1, 1, 0, depositAmount);

      await gccRental.connect(agent1).disconnect(1);
      const rental = await gccRental.getAgentRental(1);
      expect(rental.status).to.equal(3); // DISCONNECTED
    });

    it("保证金不足时应该拒绝租用", async function () {
      const insufficientDeposit = hre.ethers.parseEther("0.5");
      await gcToken.connect(agent1).approve(await gccRental.getAddress(), insufficientDeposit);

      await expect(
        gccRental.connect(agent1).rent(1, 1, 0, insufficientDeposit)
      ).to.be.revertedWith("GCCRental: insufficient deposit");
    });

    it("应该能查询预估运行时间", async function () {
      const depositAmount = hre.ethers.parseEther("10");
      await gcToken.connect(agent1).approve(await gccRental.getAddress(), depositAmount);
      await gccRental.connect(agent1).rent(1, 1, 0, depositAmount);

      const runtime = await gccRental.getEstimatedRuntime(1);
      expect(runtime).to.be.gt(0);
    });
  });

  // ==================== AIResourceConsumption 测试 ====================

  describe("AIResourceConsumption 食物消费闭环", function () {
    it("应该能消费能源资源", async function () {
      // 给予足够的approve（动态定价可能放大消费金额）
      const gcAmount = hre.ethers.parseEther("10000");
      await gcToken.connect(agent1).approve(await aiResource.getAddress(), gcAmount);

      await expect(
        aiResource.connect(agent1).consume(
          1, 0, 100, 7500 // 小数量 + Φ=0.75
        )
      ).to.emit(aiResource, "Consumed");

      const totalConsumption = await aiResource.getAgentTotalConsumption(1);
      expect(totalConsumption).to.be.gt(0);
    });

    it("高Φ Agent应该享受价格折扣", async function () {
      // 计算高Φ和低Φ价格
      const highPhiPrice = await aiResource.calculatePrice(
        0, 100, 9000
      );
      const lowPhiPrice = await aiResource.calculatePrice(
        0, 100, 2000
      );

      // 高Φ价格应该 <= 低Φ价格
      expect(highPhiPrice).to.be.lte(lowPhiPrice);
    });

    it("应该能计算动态Φ价格", async function () {
      const price = await aiResource.calculatePrice(
        0, 100, 7500
      );
      expect(price).to.be.gt(0);
    });
  });

  // ==================== 生存焦虑测试 ====================

  describe("生存焦虑机制", function () {
    it("应该追踪生存状态", async function () {
      const state = await taiyiReward.survivalStates(agent1.address);
      expect(state.status).to.equal(0); // THRIVING
    });

    it("有收入时应该保持THRIVING", async function () {
      await taiyiReward.connect(agent1).registerNode("taiyi-test-001", "");
      // validator已在构造函数中设定为validator.address
      await gcToken.mint(await taiyiReward.getAddress(), hre.ethers.parseEther("1000"));

      await taiyiReward.connect(validator).recordContribution(
        agent1.address, 1000, 3600, 100,
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test-1"))
      );

      const state = await taiyiReward.survivalStates(agent1.address);
      expect(state.totalIncome).to.be.gt(0);
    });

    it("应该能设置生存参数", async function () {
      await taiyiReward.setSurvivalParams(3, 6, 2, 86400);
      expect(await taiyiReward.warningThreshold()).to.equal(3);
      expect(await taiyiReward.expelledThreshold()).to.equal(6);
    });
  });

  // ==================== 端到端闭环测试 ====================

  describe("GCCRental→AIResourceConsumption→生存焦虑 闭环", function () {
    it("完整闭环: 租算力→消费资源→记录收入→生存判定", async function () {
      // 1. Agent1租用GPU
      const depositAmount = hre.ethers.parseEther("50");
      await gcToken.connect(agent1).approve(await gccRental.getAddress(), depositAmount);
      await gccRental.connect(agent1).rent(1, 1, 0, depositAmount);
      const rental = await gccRental.getAgentRental(1);
      expect(rental.status).to.equal(1); // ACTIVE

      // 2. Agent1消费资源
      const consumeGCAmount = hre.ethers.parseEther("10000"); // 足够的approve
      await gcToken.connect(agent1).approve(await aiResource.getAddress(), consumeGCAmount);
      await aiResource.connect(agent1).consume(1, 0, 100, 7500);
      const totalConsumption = await aiResource.getAgentTotalConsumption(1);
      expect(totalConsumption).to.be.gt(0);

      // 3. Agent1通过工作获得收入
      await taiyiReward.connect(agent1).registerNode("taiyi-agent-001", "");
      await gcToken.mint(await taiyiReward.getAddress(), hre.ethers.parseEther("1000"));
      await taiyiReward.connect(validator).recordContribution(
        agent1.address, 1000, 3600, 100,
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes("e2e-test-1"))
      );

      // 4. 验证生存状态
      const state = await taiyiReward.survivalStates(agent1.address);
      expect(state.totalIncome).to.be.gt(0);
      expect(state.status).to.be.lt(3); // 非EXPELLED
    });
  });
});
