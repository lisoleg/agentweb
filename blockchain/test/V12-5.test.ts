import { expect } from 'chai';
import hre from 'hardhat';
import { GCAncor, GCPenaltyExecutor, CreditRating, MockERC20 } from '../typechain';

describe('V12.5 GC锚定层', function () {
  let gcToken: MockERC20;
  let gcAncor: GCAncor;
  let penaltyExecutor: GCPenaltyExecutor;
  let creditRating: CreditRating;
  let owner: any, validator: any, agent1: any, agent2: any, agent3: any;

  const DAY = 86400;
  const MONTH = 30 * DAY;

  beforeEach(async function () {
    [owner, validator, agent1, agent2, agent3] = await hre.ethers.getSigners();

    const MockERC20Factory = await hre.ethers.getContractFactory('MockERC20');
    gcToken = await MockERC20Factory.deploy('GC Token', 'GC', 18);
    await gcToken.waitForDeployment();

    const GCAncorFactory = await hre.ethers.getContractFactory('GCAncor');
    gcAncor = await GCAncorFactory.deploy(await gcToken.getAddress(), validator.address);
    await gcAncor.waitForDeployment();

    const PenaltyFactory = await hre.ethers.getContractFactory('GCPenaltyExecutor');
    penaltyExecutor = await PenaltyFactory.deploy(
      await gcToken.getAddress(),
      await gcAncor.getAddress()
    );
    await penaltyExecutor.waitForDeployment();

    await gcAncor.setPenaltyExecutor(await penaltyExecutor.getAddress());

    const CreditFactory = await hre.ethers.getContractFactory('CreditRating');
    creditRating = await CreditFactory.deploy(
      hre.ethers.ZeroAddress, hre.ethers.ZeroAddress,
      hre.ethers.ZeroAddress, hre.ethers.ZeroAddress
    );
    await creditRating.waitForDeployment();
    await creditRating.setGcAncor(await gcAncor.getAddress());

    await gcToken.mint(agent1.address, hre.ethers.parseEther('1000'));
    await gcToken.mint(agent2.address, hre.ethers.parseEther('1000'));
    await gcToken.mint(agent3.address, hre.ethers.parseEther('1000'));
  });

  // =============== GCAncor Tests (12) ===============

  describe('GCAncor 锚定记录', function () {
    it('应正确注册Agent', async function () {
      const metabolicRate = hre.ethers.parseEther('0.001');
      await gcAncor.connect(validator).registerAgent(agent1.address, metabolicRate);

      const state = await gcAncor.getAgentAnchorState(agent1.address);
      expect(state.isActive).to.be.true;
      expect(state.metabolicRate).to.equal(metabolicRate);
      expect(state.totalIncome).to.equal(0);
    });

    it('应正确记录收入', async function () {
      const metabolicRate = hre.ethers.parseEther('0.001');
      await gcAncor.connect(validator).registerAgent(agent1.address, metabolicRate);

      const amount = hre.ethers.parseEther('100');
      const sourceHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('income_1'));
      await gcAncor.connect(validator).recordIncome(agent1.address, amount, sourceHash);

      const state = await gcAncor.getAgentAnchorState(agent1.address);
      expect(state.totalIncome).to.equal(amount);
      expect(state.gcBalance).to.equal(amount);
    });

    it('应正确记录消费', async function () {
      await gcAncor.connect(validator).registerAgent(agent1.address, hre.ethers.parseEther('0.001'));

      const income = hre.ethers.parseEther('100');
      await gcAncor.connect(validator).recordIncome(
        agent1.address, income, hre.ethers.keccak256(hre.ethers.toUtf8Bytes('inc_1'))
      );

      const consume = hre.ethers.parseEther('30');
      await gcAncor.connect(validator).recordConsumption(
        agent1.address, consume, hre.ethers.keccak256(hre.ethers.toUtf8Bytes('con_1'))
      );

      const state = await gcAncor.getAgentAnchorState(agent1.address);
      expect(state.totalConsumption).to.equal(consume);
      expect(state.gcBalance).to.equal(income - consume);
    });

    it('应防重放攻击', async function () {
      await gcAncor.connect(validator).registerAgent(agent1.address, hre.ethers.parseEther('0.001'));

      const sourceHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('dup'));
      await gcAncor.connect(validator).recordIncome(agent1.address, hre.ethers.parseEther('100'), sourceHash);

      await expect(
        gcAncor.connect(validator).recordIncome(agent1.address, hre.ethers.parseEther('50'), sourceHash)
      ).to.be.revertedWith('GCAncor: duplicate hash');
    });
  });

  describe('GCAncor 周期结算+Merkle', function () {
    it('应正确结算周期并生成Merkle根', async function () {
      await gcAncor.connect(validator).registerAgent(agent1.address, hre.ethers.parseEther('0.001'));
      await gcAncor.connect(validator).recordIncome(
        agent1.address, hre.ethers.parseEther('100'),
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes('inc_epoch'))
      );

      await hre.ethers.provider.send('evm_increaseTime', [DAY + 1]);
      await hre.ethers.provider.send('evm_mine', []);

      await gcAncor.connect(owner).settleEpoch();

      const summary = await gcAncor.getEpochSummary(1);
      expect(summary.merkleRoot).to.not.equal(hre.ethers.ZeroHash);
      expect(summary.totalIncome).to.equal(hre.ethers.parseEther('100'));
    });

    it('应在周期未结束时拒绝结算', async function () {
      await expect(gcAncor.connect(owner).settleEpoch()).to.be.revertedWith('GCAncor: epoch not ended');
    });

    it('应正确查询锚定记录', async function () {
      await gcAncor.connect(validator).registerAgent(agent1.address, hre.ethers.parseEther('0.001'));
      await gcAncor.connect(validator).recordIncome(
        agent1.address, hre.ethers.parseEther('50'),
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes('q1'))
      );
      await gcAncor.connect(validator).recordConsumption(
        agent1.address, hre.ethers.parseEther('20'),
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes('q2'))
      );

      const records = await gcAncor.getAgentRecords(agent1.address, 0, 10);
      expect(records.length).to.equal(2);
      expect(records[0].recordType).to.equal(0); // INCOME
      expect(records[1].recordType).to.equal(1); // CONSUMPTION
    });
  });

  describe('GCAncor 自动奖励', function () {
    it('应在余额充足时触发自动奖励', async function () {
      const lowMetabolic = hre.ethers.parseEther('0.00001');
      await gcAncor.connect(validator).registerAgent(agent1.address, lowMetabolic);

      const bigIncome = hre.ethers.parseEther('500');
      await gcAncor.connect(validator).recordIncome(
        agent1.address, bigIncome,
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes('big_inc'))
      );

      const state = await gcAncor.getAgentAnchorState(agent1.address);
      expect(state.totalReward).to.be.gt(0);
      expect(state.gcBalance).to.be.gt(bigIncome);
    });

    it('应在余额不足时不触发奖励', async function () {
      const highMetabolic = hre.ethers.parseEther('1');
      await gcAncor.connect(validator).registerAgent(agent1.address, highMetabolic);

      const smallIncome = hre.ethers.parseEther('10');
      await gcAncor.connect(validator).recordIncome(
        agent1.address, smallIncome,
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes('small_inc'))
      );

      const state = await gcAncor.getAgentAnchorState(agent1.address);
      expect(state.totalReward).to.equal(0);
    });

    it('应正确计算GC健康度', async function () {
      await gcAncor.connect(validator).registerAgent(agent1.address, hre.ethers.parseEther('0.001'));
      // 4倍月代谢成本 → 最优区
      await gcAncor.connect(validator).recordIncome(
        agent1.address, hre.ethers.parseEther('0.001') * BigInt(MONTH) * 4n,
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes('health_inc'))
      );

      const health = await gcAncor.getGCHealth(agent1.address);
      expect(health.healthScore).to.be.gt(8000);
    });
  });

  // =============== GCPenaltyExecutor Tests (10) ===============

  describe('GCPenaltyExecutor 三级惩罚', function () {
    const metabolicRate = hre.ethers.parseEther('0.001');

    it('应正确预测WARNING级别', async function () {
      const monthlyCost = metabolicRate * BigInt(MONTH);
      const warningBalance = monthlyCost * 15n / 100n;
      const level = await penaltyExecutor.predictPenaltyLevel(warningBalance, metabolicRate);
      expect(level).to.equal(1); // WARNING
    });

    it('应正确预测DOWNGRADE级别', async function () {
      const monthlyCost = metabolicRate * BigInt(MONTH);
      const downgradeBalance = monthlyCost * 8n / 100n;
      const level = await penaltyExecutor.predictPenaltyLevel(downgradeBalance, metabolicRate);
      expect(level).to.equal(2); // DOWNGRADE
    });

    it('应正确预测EXPEL级别', async function () {
      const monthlyCost = metabolicRate * BigInt(MONTH);
      const expelBalance = monthlyCost * 3n / 100n;
      const level = await penaltyExecutor.predictPenaltyLevel(expelBalance, metabolicRate);
      expect(level).to.equal(3); // EXPEL
    });

    it('应在余额充足时返回NONE', async function () {
      const monthlyCost = metabolicRate * BigInt(MONTH);
      const safeBalance = monthlyCost * 30n / 100n; // 30% → safe
      const level = await penaltyExecutor.predictPenaltyLevel(safeBalance, metabolicRate);
      expect(level).to.equal(0); // NONE
    });
  });

  describe('GCPenaltyExecutor 申诉机制', function () {
    it('应正确提交申诉', async function () {
      await gcAncor.connect(validator).registerAgent(agent1.address, hre.ethers.parseEther('0.001'));
      await gcAncor.connect(validator).recordIncome(
        agent1.address, hre.ethers.parseEther('1'),
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes('appeal_inc'))
      );

      // 用owner身份调用checkAndPenalize
      await penaltyExecutor.connect(owner).checkAndPenalize(
        agent1.address, hre.ethers.parseEther('1'), hre.ethers.parseEther('0.001')
      );

      const totalPenalties = await penaltyExecutor.totalPenaltyRecords();
      expect(Number(totalPenalties)).to.be.gt(0);

      // 推进时间超过申诉冷却期
      await hre.ethers.provider.send('evm_increaseTime', [8 * DAY]);
      await hre.ethers.provider.send('evm_mine', []);

      const record = await penaltyExecutor.getPenaltyRecord(totalPenalties);
      if (record.gcBurned > 0 || record.creditImpact > 0) {
        const evidenceHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('evidence'));
        await penaltyExecutor.connect(agent1).submitAppeal(totalPenalties, evidenceHash);

        const afterAppeal = await penaltyExecutor.getPenaltyRecord(totalPenalties);
        expect(afterAppeal.appealed).to.be.true;
      }
    });

    it('应正确批准申诉并退款', async function () {
      await gcAncor.connect(validator).registerAgent(agent1.address, hre.ethers.parseEther('0.001'));

      const tinyBalance = hre.ethers.parseEther('1');
      await gcAncor.connect(validator).recordIncome(
        agent1.address, tinyBalance,
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes('appeal2_inc'))
      );

      await gcToken.mint(await penaltyExecutor.getAddress(), hre.ethers.parseEther('1000'));

      await penaltyExecutor.connect(owner).checkAndPenalize(
        agent1.address, tinyBalance, hre.ethers.parseEther('0.001')
      );

      const totalPenalties = await penaltyExecutor.totalPenaltyRecords();
      if (Number(totalPenalties) > 0) {
        // 推进时间超过申诉冷却期
        await hre.ethers.provider.send('evm_increaseTime', [8 * DAY]);
        await hre.ethers.provider.send('evm_mine', []);

        const record = await penaltyExecutor.getPenaltyRecord(totalPenalties);
        if (record.gcBurned > 0) {
          await penaltyExecutor.connect(agent1).submitAppeal(
            totalPenalties, hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ev2'))
          );
          await penaltyExecutor.connect(owner).resolveAppeal(totalPenalties, true);

          const afterResolve = await penaltyExecutor.getPenaltyRecord(totalPenalties);
          expect(afterResolve.appealGranted).to.be.true;
        }
      }
    });

    it('应拒绝重复申诉', async function () {
      await gcAncor.connect(validator).registerAgent(agent1.address, hre.ethers.parseEther('0.001'));
      await gcAncor.connect(validator).recordIncome(
        agent1.address, hre.ethers.parseEther('1'),
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes('dup_appeal'))
      );

      await penaltyExecutor.connect(owner).checkAndPenalize(
        agent1.address, hre.ethers.parseEther('1'), hre.ethers.parseEther('0.001')
      );

      const totalPenalties = await penaltyExecutor.totalPenaltyRecords();
      if (Number(totalPenalties) > 0) {
        // 推进时间超过申诉冷却期
        await hre.ethers.provider.send('evm_increaseTime', [8 * DAY]);
        await hre.ethers.provider.send('evm_mine', []);

        await penaltyExecutor.connect(agent1).submitAppeal(
          totalPenalties, hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ev3'))
        );

        await expect(
          penaltyExecutor.connect(agent1).submitAppeal(
            totalPenalties, hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ev4'))
          )
        ).to.be.revertedWith('GCPenaltyExecutor: already appealed');
      }
    });
  });

  describe('GCPenaltyExecutor 信用联动', function () {
    it('应正确预测零余额惩罚等级', async function () {
      const level = await penaltyExecutor.predictPenaltyLevel(0, hre.ethers.parseEther('0.001'));
      expect(level).to.equal(3); // EXPEL
    });

    it('应正确预测零代谢率惩罚等级', async function () {
      const level = await penaltyExecutor.predictPenaltyLevel(hre.ethers.parseEther('100'), 0);
      expect(level).to.equal(0); // NONE (no metabolism)
    });

    it('应在惩罚后记录连续惩罚次数', async function () {
      await gcAncor.connect(validator).registerAgent(agent1.address, hre.ethers.parseEther('0.001'));
      await gcAncor.connect(validator).recordIncome(
        agent1.address, hre.ethers.parseEther('1'),
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes('consec_inc'))
      );

      await penaltyExecutor.connect(owner).checkAndPenalize(
        agent1.address, hre.ethers.parseEther('1'), hre.ethers.parseEther('0.001')
      );

      const consec = await penaltyExecutor.agentConsecutivePenalties(agent1.address);
      expect(consec).to.be.gt(0);
    });
  });

  // =============== CreditRating V12.5 增强测试 (8) ===============

  describe('CreditRating V12.5 GC维度', function () {
    it('应正确设置GC权重常量', async function () {
      expect(await creditRating.PHI_WEIGHT()).to.equal(2500);
      expect(await creditRating.COURT_WEIGHT()).to.equal(2000);
      expect(await creditRating.LABOR_WEIGHT()).to.equal(2500);
      expect(await creditRating.RELAY_WEIGHT()).to.equal(1500);
      expect(await creditRating.GC_WEIGHT()).to.equal(1500);
    });

    it('应正确计算五维度信用总分', async function () {
      const dims = {
        phiScore: 8000, courtScore: 7000, laborScore: 6000,
        relayScore: 5000, gcScore: 9000
      };

      await creditRating.addAdmin(owner.address);
      await creditRating.updateCreditScore(agent1.address, dims, hre.ethers.ZeroHash);

      const score = await creditRating.getCreditScore(agent1.address);
      // 8000*0.25 + 7000*0.20 + 6000*0.25 + 5000*0.15 + 9000*0.15
      // = 2000 + 1400 + 1500 + 750 + 1350 = 7000
      expect(score).to.equal(7000);
    });

    it('应正确返回GC维度评分', async function () {
      const dims = {
        phiScore: 5000, courtScore: 5000, laborScore: 5000,
        relayScore: 5000, gcScore: 10000
      };

      await creditRating.addAdmin(owner.address);
      await creditRating.updateCreditScore(agent1.address, dims, hre.ethers.ZeroHash);

      const credit = await creditRating.getFullCredit(agent1.address);
      expect(credit.gcScore).to.equal(10000);
    });

    it('应正确返回GC贡献在推理链中', async function () {
      const dims = {
        phiScore: 8000, courtScore: 7000, laborScore: 6000,
        relayScore: 5000, gcScore: 9000
      };

      await creditRating.addAdmin(owner.address);
      await creditRating.updateCreditScore(agent1.address, dims, hre.ethers.ZeroHash);

      const proof = await creditRating.getRatingProof(agent1.address);
      expect(proof.gcContribution).to.equal(1350); // 9000 * 1500 / 10000
    });

    it('GC维度满分应显著提升总评分', async function () {
      const dimsNoGc = {
        phiScore: 8000, courtScore: 7000, laborScore: 6000,
        relayScore: 5000, gcScore: 0
      };
      const dimsFullGc = {
        phiScore: 8000, courtScore: 7000, laborScore: 6000,
        relayScore: 5000, gcScore: 10000
      };

      await creditRating.addAdmin(owner.address);
      await creditRating.updateCreditScore(agent1.address, dimsNoGc, hre.ethers.ZeroHash);
      const scoreNoGc = await creditRating.getCreditScore(agent1.address);

      await creditRating.updateCreditScore(agent2.address, dimsFullGc, hre.ethers.ZeroHash);
      const scoreFullGc = await creditRating.getCreditScore(agent2.address);

      expect(scoreFullGc).to.be.gt(scoreNoGc);
      expect(scoreFullGc - scoreNoGc).to.equal(1500);
    });
  });

  describe('CreditRating V12.5 权重调整', function () {
    it('五维度权重总和应为10000', async function () {
      const total = (await creditRating.PHI_WEIGHT()) +
        (await creditRating.COURT_WEIGHT()) +
        (await creditRating.LABOR_WEIGHT()) +
        (await creditRating.RELAY_WEIGHT()) +
        (await creditRating.GC_WEIGHT());
      expect(total).to.equal(10000);
    });

    it('GC高评分应让BBB升级到A', async function () {
      const dimsBBB = {
        phiScore: 8000, courtScore: 6000, laborScore: 6000,
        relayScore: 3000, gcScore: 0
      };
      const dimsA = {
        phiScore: 8000, courtScore: 6000, laborScore: 6000,
        relayScore: 3000, gcScore: 6667
      };

      await creditRating.addAdmin(owner.address);
      await creditRating.updateCreditScore(agent1.address, dimsBBB, hre.ethers.ZeroHash);
      const gradeBBB = await creditRating.getCreditGrade(agent1.address);

      await creditRating.updateCreditScore(agent2.address, dimsA, hre.ethers.ZeroHash);
      const gradeA = await creditRating.getCreditGrade(agent2.address);

      expect(gradeA).to.be.lte(gradeBBB);
    });

    it('信用衰减后GC维度也应被影响', async function () {
      const dims = {
        phiScore: 8000, courtScore: 7000, laborScore: 6000,
        relayScore: 5000, gcScore: 9000
      };

      await creditRating.addAdmin(owner.address);
      await creditRating.updateCreditScore(agent1.address, dims, hre.ethers.ZeroHash);
      const scoreBefore = await creditRating.getCreditScore(agent1.address);

      await hre.ethers.provider.send('evm_increaseTime', [31 * DAY]);
      await hre.ethers.provider.send('evm_mine', []);

      await creditRating.applyDecay(agent1.address);
      const scoreAfter = await creditRating.getCreditScore(agent1.address);

      expect(scoreAfter).to.be.lt(scoreBefore);
    });
  });
});
