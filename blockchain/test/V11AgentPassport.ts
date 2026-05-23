import { expect } from "chai";
import hre from "hardhat";
import { AgentPassport } from "../typechain-types";

describe("V11.0 AgentPassport Agent通行证测试", function () {
  let passport: AgentPassport;

  let owner: any;
  let admin: any;
  let agent1: any;
  let agent2: any;
  let nonAdmin: any;

  async function deployFixture() {
    [owner, admin, agent1, agent2, nonAdmin] = await hre.ethers.getSigners();

    const PassportFactory = await hre.ethers.getContractFactory("AgentPassport");
    passport = await PassportFactory.deploy(
      hre.ethers.ZeroAddress, // negativeCaseBook
      hre.ethers.ZeroAddress, // phiStaking
      hre.ethers.ZeroAddress  // constitutionCourt
    );
    await passport.waitForDeployment();

    await passport.addAdmin(admin.address);
  }

  describe("签发通行证", function () {
    beforeEach(async () => {
      await deployFixture();
    });

    it("管理员应能签发通行证", async function () {
      const tx = await passport.connect(admin).issuePassport(agent1.address, 7500);
      await expect(tx).to.emit(passport, "PassportIssued");

      const p = await passport.getPassport(agent1.address);
      expect(p.phiValue).to.equal(7500);
      expect(p.creditScore).to.equal(5000);
      expect(p.active).to.be.true;
    });

    it("重复签发应被拒绝", async function () {
      await passport.connect(admin).issuePassport(agent1.address, 5000);
      await expect(
        passport.connect(admin).issuePassport(agent1.address, 5000)
      ).to.be.revertedWith("AgentPassport: already issued");
    });

    it("非管理员签发应被拒绝", async function () {
      await expect(
        passport.connect(nonAdmin).issuePassport(agent1.address, 5000)
      ).to.be.reverted;
    });

    it("PhiValue超过10000应被拒绝", async function () {
      await expect(
        passport.connect(admin).issuePassport(agent1.address, 10001)
      ).to.be.revertedWith("AgentPassport: phiValue exceeds max");
    });
  });

  describe("更新Φ值", function () {
    beforeEach(async () => {
      await deployFixture();
      await passport.connect(admin).issuePassport(agent1.address, 5000);
    });

    it("管理员应能更新Φ值", async function () {
      const tx = await passport.connect(admin).updatePhiValue(agent1.address, 8000);
      await expect(tx).to.emit(passport, "PhiValueUpdated");

      const p = await passport.getPassport(agent1.address);
      expect(p.phiValue).to.equal(8000);
    });
  });

  describe("信用分计算", function () {
    beforeEach(async () => {
      await deployFixture();
      await passport.connect(admin).issuePassport(agent1.address, 5000);
    });

    it("初始信用分应为5000", async function () {
      const p = await passport.getPassport(agent1.address);
      expect(p.creditScore).to.equal(5000);
    });

    it("creditScore = 5000 + totalCaseCount*100 - lostCaseCount*200", async function () {
      // 增加败诉案件: total=1, lost=1 → 5000+100-200=4900
      await passport.connect(admin).incrementLostCases(agent1.address);
      const p = await passport.getPassport(agent1.address);
      expect(p.creditScore).to.equal(4900);
    });

    it("多次败诉信用分应持续降低但不低于0", async function () {
      // 27次败诉: 5000 + 27*100 - 27*200 = 5000 + 2700 - 5400 = 2300
      for (let i = 0; i < 27; i++) {
        await passport.connect(admin).incrementLostCases(agent1.address);
      }
      const p = await passport.getPassport(agent1.address);
      // total=27, lost=27 → 5000 + 27*100 - 27*200 = 5000 - 2700 = 2300
      expect(p.creditScore).to.equal(2300);
    });

    it("纯计算函数应返回正确结果", async function () {
      const score = await passport.calculateCreditScore(5, 2);
      // 5000 + 5*100 - 2*200 = 5000 + 500 - 400 = 5100
      expect(score).to.equal(5100);
    });
  });

  describe("撤销通行证", function () {
    beforeEach(async () => {
      await deployFixture();
      await passport.connect(admin).issuePassport(agent1.address, 5000);
    });

    it("管理员应能撤销通行证", async function () {
      const tx = await passport.connect(admin).revokePassport(agent1.address);
      await expect(tx).to.emit(passport, "PassportRevoked");

      const p = await passport.getPassport(agent1.address);
      expect(p.active).to.be.false;
    });
  });

  describe("更新案件Merkle根", function () {
    beforeEach(async () => {
      await deployFixture();
      await passport.connect(admin).issuePassport(agent1.address, 5000);
    });

    it("管理员应能更新Merkle根", async function () {
      const newRoot = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test_merkle"));
      const tx = await passport.connect(admin).updateCaseMerkleRoot(agent1.address, newRoot);
      await expect(tx).to.emit(passport, "CaseMerkleRootUpdated");

      const root = await passport.getPassportMerkleRoot(agent1.address);
      expect(root).to.equal(newRoot);
    });
  });
});
