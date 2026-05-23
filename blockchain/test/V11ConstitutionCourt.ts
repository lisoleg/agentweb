import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockERC20, ConstitutionCourt, Constitution, PhiStaking } from "../typechain-types";

describe("V11.0 ConstitutionCourt 宪法法院测试", function () {
  let gcToken: MockERC20;
  let court: ConstitutionCourt;
  let constitution: Constitution;
  let phiStaking: PhiStaking;

  let owner: any;
  let admin: any;
  let voter1: any;
  let voter2: any;
  let voter3: any;
  let filer: any;
  let nonAdmin: any;

  const ONE_DAY = 86400n;
  const ZERO_HASH = hre.ethers.ZeroHash;

  async function deployFixture() {
    [owner, admin, voter1, voter2, voter3, filer, nonAdmin] = await hre.ethers.getSigners();

    // Deploy MockERC20
    const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    gcToken = await MockERC20Factory.deploy("GC Token", "GC", 18);
    await gcToken.waitForDeployment();

    // Deploy PhiStaking
    const PhiStakingFactory = await hre.ethers.getContractFactory("PhiStaking");
    phiStaking = await PhiStakingFactory.deploy(
      await gcToken.getAddress(),
      100n,
      hre.ethers.parseEther("1"),
      hre.ethers.parseEther("1000000")
    );
    await phiStaking.waitForDeployment();

    // Deploy Constitution
    const ConstitutionFactory = await hre.ethers.getContractFactory("Constitution");
    constitution = await ConstitutionFactory.deploy();
    await constitution.waitForDeployment();

    // Deploy ConstitutionCourt
    const CourtFactory = await hre.ethers.getContractFactory("ConstitutionCourt");
    court = await CourtFactory.deploy(
      await constitution.getAddress(),
      await phiStaking.getAddress()
    );
    await court.waitForDeployment();

    // Setup: mint tokens and stake for voters
    const stakeAmount = hre.ethers.parseEther("1000");
    for (const voter of [voter1, voter2, voter3]) {
      await gcToken.mint(voter.address, hre.ethers.parseEther("10000"));
      await gcToken.connect(voter).approve(await phiStaking.getAddress(), hre.ethers.parseEther("10000"));
      await phiStaking.connect(voter).stake(stakeAmount, 5000);
    }

    // Setup admins
    await court.addAdmin(admin.address);
    await constitution.addAdmin(admin.address);
    await constitution.setPhiStaking(await phiStaking.getAddress());
  }

  describe("提交普通案件", function () {
    beforeEach(async () => {
      await deployFixture();
    });

    it("应成功提交普通宪法审查案件", async function () {
      const tx = await court.connect(filer).submitConstitutionalCase(
        1,
        "修正案违反核心条款",
        ZERO_HASH
      );
      await expect(tx)
        .to.emit(court, "CaseSubmitted")
        .withArgs(1, 1, filer.address, false, (v: any) => v > 0n);

      const caseInfo = await court.getCase(1);
      expect(caseInfo.state).to.equal(1); // VOTING
      expect(caseInfo.isEmergency).to.be.false;
      expect(caseInfo.filer).to.equal(filer.address);
    });

    it("提交案件后应立即进入VOTING状态", async function () {
      await court.connect(filer).submitConstitutionalCase(1, "test reason", ZERO_HASH);

      const caseInfo = await court.getCase(1);
      expect(caseInfo.state).to.equal(1); // VOTING
      expect(caseInfo.votingEnd - caseInfo.votingStart).to.equal(14n * ONE_DAY);
    });

    it("空原因应被拒绝", async function () {
      await expect(
        court.connect(filer).submitConstitutionalCase(1, "", ZERO_HASH)
      ).to.be.revertedWith("ConstitutionCourt: empty reason");
    });
  });

  describe("紧急案件", function () {
    beforeEach(async () => {
      await deployFixture();
    });

    it("紧急案件提交后应为PENDING状态", async function () {
      const tx = await court.connect(filer).submitEmergencyCase(
        1,
        "紧急修正案审查",
        ZERO_HASH
      );
      await expect(tx).to.emit(court, "CaseSubmitted");

      const caseInfo = await court.getCase(1);
      expect(caseInfo.state).to.equal(0); // PENDING
      expect(caseInfo.isEmergency).to.be.true;
    });

    it("仅owner可批准紧急案件", async function () {
      await court.connect(filer).submitEmergencyCase(1, "urgent", ZERO_HASH);

      await expect(
        court.connect(nonAdmin).approveEmergencyCase(1)
      ).to.be.reverted;

      const tx = await court.approveEmergencyCase(1);
      await expect(tx).to.emit(court, "EmergencyCaseApproved");

      const caseInfo = await court.getCase(1);
      expect(caseInfo.state).to.equal(1); // VOTING
      expect(caseInfo.emergencyApproved).to.be.true;
      expect(caseInfo.votingEnd - caseInfo.votingStart).to.equal(3n * ONE_DAY);
    });
  });

  describe("投票", function () {
    beforeEach(async () => {
      await deployFixture();
      await court.connect(filer).submitConstitutionalCase(1, "test reason", ZERO_HASH);
    });

    it("有投票权的用户应能投票", async function () {
      const tx = await court.connect(voter1).voteOnCase(1, true);
      await expect(tx).to.emit(court, "VoteCast");

      const caseInfo = await court.getCase(1);
      expect(caseInfo.totalVoters).to.equal(1);
      expect(caseInfo.yesVotes).to.be.gt(0);
    });

    it("重复投票应被拒绝", async function () {
      await court.connect(voter1).voteOnCase(1, true);
      await expect(
        court.connect(voter1).voteOnCase(1, false)
      ).to.be.revertedWith("ConstitutionCourt: already voted");
    });

    it("投票期结束后投票应被拒绝", async function () {
      await time.increase(14n * ONE_DAY + 1n);
      await expect(
        court.connect(voter1).voteOnCase(1, true)
      ).to.be.revertedWith("ConstitutionCourt: voting period ended");
    });
  });

  describe("判决", function () {
    beforeEach(async () => {
      await deployFixture();
      await court.connect(filer).submitConstitutionalCase(1, "test reason", ZERO_HASH);
    });

    it("67%赞成应UPHOLD", async function () {
      // 3 voters with equal power: 3 yes, 0 no → 100% → UPHOLD
      // (2/3 = 6667 bps < 6700 threshold, so need 3/3 to guarantee UPHOLD)
      await court.connect(voter1).voteOnCase(1, true);
      await court.connect(voter2).voteOnCase(1, true);
      await court.connect(voter3).voteOnCase(1, true);

      await time.increase(14n * ONE_DAY + 1n);
      const tx = await court.renderJudgment(1);
      await expect(tx).to.emit(court, "JudgmentRendered");

      const caseInfo = await court.getCase(1);
      expect(caseInfo.judgment).to.equal(1); // UPHOLD
      expect(caseInfo.state).to.equal(2); // RESOLVED
    });

    it("少于33%赞成应OVERTURN", async function () {
      await court.connect(voter1).voteOnCase(1, false);
      await court.connect(voter2).voteOnCase(1, false);
      await court.connect(voter3).voteOnCase(1, false);

      await time.increase(14n * ONE_DAY + 1n);
      await court.renderJudgment(1);

      const caseInfo = await court.getCase(1);
      expect(caseInfo.judgment).to.equal(2); // OVERTURN
    });

    it("33%-67%之间应REMAND", async function () {
      await court.connect(voter1).voteOnCase(1, false);
      await court.connect(voter2).voteOnCase(1, false);
      await court.connect(voter3).voteOnCase(1, true);

      await time.increase(14n * ONE_DAY + 1n);
      await court.renderJudgment(1);

      const caseInfo = await court.getCase(1);
      expect(caseInfo.judgment).to.equal(3); // REMAND
    });

    it("无投票应DISMISSED", async function () {
      await time.increase(14n * ONE_DAY + 1n);
      await court.renderJudgment(1);

      const caseInfo = await court.getCase(1);
      expect(caseInfo.state).to.equal(3); // DISMISSED
    });
  });
});
