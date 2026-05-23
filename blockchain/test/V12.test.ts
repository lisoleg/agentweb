/**
 * Σ-Cloud V12.0 Test Suite
 * 6G-Σ融合架构: 内生AI裁决引擎 + 通算一体中继 + 零知识信用证明
 * 
 * Coverage: RelayRegistry(12) + CreditRating(14) + ConstitutionCourt增强(6) + ReputationStaking(5) = 37
 */

import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// =============== RelayRegistry Tests ===============

describe("V12 RelayRegistry", function () {
  let relayRegistry: any;
  let creditRating: any;
  let court: any;
  let phiStaking: any;
  let owner: any, admin: any, relay1: any, relay2: any, relay3: any;
  let agent1: any, agent2: any, requester: any;

  const ZERO_HASH = hre.ethers.ZeroHash;

  async function deployFixture() {
    [owner, admin, relay1, relay2, relay3, agent1, agent2, requester] = await hre.ethers.getSigners();

    // Deploy MockERC20 as PhiStaking mock
    const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20Factory.deploy("PhiToken", "PHI", 18);
    await mockToken.waitForDeployment();

    // Deploy ConstitutionCourt (用owner地址作为constitution占位)
    const CourtFactory = await hre.ethers.getContractFactory("ConstitutionCourt");
    court = await CourtFactory.deploy(owner.address, await mockToken.getAddress());
    await court.waitForDeployment();

    // Deploy CreditRating
    const CreditRatingFactory = await hre.ethers.getContractFactory("CreditRating");
    creditRating = await CreditRatingFactory.deploy(
      await mockToken.getAddress(),
      await court.getAddress(),
      hre.ethers.ZeroAddress,
      hre.ethers.ZeroAddress
    );
    await creditRating.waitForDeployment();

    // Deploy RelayRegistry
    const RelayRegistryFactory = await hre.ethers.getContractFactory("RelayRegistry");
    relayRegistry = await RelayRegistryFactory.deploy();
    await relayRegistry.waitForDeployment();
    await relayRegistry.setCreditRating(await creditRating.getAddress());
  }

  beforeEach(async function () {
    await deployFixture();
  });

  it("should register a relay node", async function () {
    await expect(
      relayRegistry.connect(relay1).registerRelay([1, 137, 42161], 5000, 100, {
        value: hre.ethers.parseEther("1.0"),
      })
    ).to.emit(relayRegistry, "RelayRegistered");

    const node = await relayRegistry.getRelayNode(relay1.address);
    expect(node.computeCapacity).to.equal(5000);
    expect(node.reputationScore).to.equal(5000);
    expect(node.feeRate).to.equal(100);
    expect(node.isActive).to.be.true;
  });

  it("should reject registration with insufficient stake", async function () {
    await expect(
      relayRegistry.connect(relay1).registerRelay([1], 5000, 100, {
        value: hre.ethers.parseEther("0.5"),
      })
    ).to.be.revertedWith("RelayRegistry: insufficient stake");
  });

  it("should reject duplicate registration", async function () {
    await relayRegistry.connect(relay1).registerRelay([1], 5000, 100, {
      value: hre.ethers.parseEther("1.0"),
    });
    await expect(
      relayRegistry.connect(relay1).registerRelay([1], 6000, 200, {
        value: hre.ethers.parseEther("1.0"),
      })
    ).to.be.revertedWith("RelayRegistry: already registered");
  });

  it("should add stake to existing relay", async function () {
    await relayRegistry.connect(relay1).registerRelay([1], 5000, 100, {
      value: hre.ethers.parseEther("1.0"),
    });
    await expect(
      relayRegistry.connect(relay1).addStake({ value: hre.ethers.parseEther("0.5") })
    ).to.emit(relayRegistry, "RelayStakeAdded");

    const node = await relayRegistry.getRelayNode(relay1.address);
    expect(node.stakeAmount).to.equal(hre.ethers.parseEther("1.5"));
  });

  it("should submit and assign a relay task", async function () {
    await relayRegistry.connect(relay1).registerRelay([137], 5000, 100, {
      value: hre.ethers.parseEther("1.0"),
    });

    const tx = await relayRegistry.connect(requester).submitRelayTask(
      137,
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test-message")),
      0, 0,
      { value: hre.ethers.parseEther("0.01") }
    );

    await expect(tx).to.emit(relayRegistry, "TaskSubmitted");
    await expect(tx).to.emit(relayRegistry, "TaskAssigned");
  });

  it("should complete a relay task and update reputation", async function () {
    await relayRegistry.connect(relay1).registerRelay([137], 5000, 100, {
      value: hre.ethers.parseEther("1.0"),
    });

    await relayRegistry.connect(requester).submitRelayTask(
      137,
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test-message")),
      0, 0,
      { value: hre.ethers.parseEther("0.01") }
    );

    const tasks = await relayRegistry.queryFilter(relayRegistry.filters.TaskSubmitted());
    const taskId = tasks[0].args[0];

    await expect(
      relayRegistry.connect(relay1).completeRelayTask(taskId, hre.ethers.keccak256(hre.ethers.toUtf8Bytes("proof")))
    ).to.emit(relayRegistry, "TaskCompleted");

    const node = await relayRegistry.getRelayNode(relay1.address);
    expect(node.successCount).to.equal(1);
    expect(node.totalRelayed).to.equal(1);
    expect(node.reputationScore).to.equal(10000);
  });

  it("should report task failure and slash stake", async function () {
    await relayRegistry.connect(relay1).registerRelay([137], 5000, 100, {
      value: hre.ethers.parseEther("1.0"),
    });

    await relayRegistry.connect(requester).submitRelayTask(
      137, hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test")), 0, 0,
      { value: hre.ethers.parseEther("0.01") }
    );

    const tasks = await relayRegistry.queryFilter(relayRegistry.filters.TaskSubmitted());
    const taskId = tasks[0].args[0];

    await expect(
      relayRegistry.connect(requester).reportTaskFailure(taskId)
    ).to.emit(relayRegistry, "TaskFailed");

    const node = await relayRegistry.getRelayNode(relay1.address);
    expect(node.failCount).to.equal(1);
    expect(node.reputationScore).to.equal(4500);
  });

  it("should slash a relay by owner", async function () {
    await relayRegistry.connect(relay1).registerRelay([1], 5000, 100, {
      value: hre.ethers.parseEther("1.0"),
    });

    await expect(
      relayRegistry.connect(owner).slashRelay(relay1.address, hre.ethers.parseEther("0.1"))
    ).to.emit(relayRegistry, "RelaySlashed");

    const node = await relayRegistry.getRelayNode(relay1.address);
    expect(node.stakeAmount).to.equal(hre.ethers.parseEther("0.9"));
    expect(node.reputationScore).to.equal(3000);
  });

  it("should deregister a relay", async function () {
    await relayRegistry.connect(relay1).registerRelay([1], 5000, 100, {
      value: hre.ethers.parseEther("1.0"),
    });

    await expect(
      relayRegistry.connect(relay1).deregisterRelay()
    ).to.emit(relayRegistry, "RelayDeregistered");

    const node = await relayRegistry.getRelayNode(relay1.address);
    expect(node.isActive).to.be.false;
  });

  it("should return active relay count", async function () {
    await relayRegistry.connect(relay1).registerRelay([1], 5000, 100, {
      value: hre.ethers.parseEther("1.0"),
    });
    await relayRegistry.connect(relay2).registerRelay([1], 3000, 150, {
      value: hre.ethers.parseEther("1.0"),
    });

    const count = await relayRegistry.getActiveRelayCount();
    expect(count).to.equal(2);
  });

  it("should check chain support", async function () {
    await relayRegistry.connect(relay1).registerRelay([1, 137], 5000, 100, {
      value: hre.ethers.parseEther("1.0"),
    });

    expect(await relayRegistry.supportsChain(relay1.address, 1)).to.be.true;
    expect(await relayRegistry.supportsChain(relay1.address, 137)).to.be.true;
    expect(await relayRegistry.supportsChain(relay1.address, 999)).to.be.false;
  });

  it("should reject COMPUTE_RELAY if insufficient compute capacity", async function () {
    await relayRegistry.connect(relay1).registerRelay([137], 100, 100, {
      value: hre.ethers.parseEther("1.0"),
    });

    const tx = await relayRegistry.connect(requester).submitRelayTask(
      137, hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test")), 1, 500,
      { value: hre.ethers.parseEther("0.01") }
    );

    const receipt = await tx.wait();
    const assignedEvents = receipt?.logs.filter((log: any) => {
      try {
        const parsed = relayRegistry.interface.parseLog(log);
        return parsed?.name === "TaskAssigned";
      } catch { return false; }
    });
    expect(assignedEvents?.length || 0).to.equal(0);
  });
});

// =============== CreditRating Tests ===============

describe("V12 CreditRating", function () {
  let creditRating: any;
  let court: any;
  let mockToken: any;
  let owner: any, agent1: any, agent2: any;

  beforeEach(async function () {
    [owner, , , , , agent1, agent2] = await hre.ethers.getSigners();

    const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20Factory.deploy("PhiToken", "PHI", 18);
    await mockToken.waitForDeployment();

    const CourtFactory = await hre.ethers.getContractFactory("ConstitutionCourt");
    court = await CourtFactory.deploy(owner.address, await mockToken.getAddress());
    await court.waitForDeployment();

    const CreditRatingFactory = await hre.ethers.getContractFactory("CreditRating");
    creditRating = await CreditRatingFactory.deploy(
      await mockToken.getAddress(),
      await court.getAddress(),
      hre.ethers.ZeroAddress,
      hre.ethers.ZeroAddress
    );
    await creditRating.waitForDeployment();
  });

  it("should update credit score with weighted dimensions", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 8000, courtScore: 7000, laborScore: 6000, relayScore: 5000, gcScore: 5000 },
      hre.ethers.ZeroHash
    );

    const score = await creditRating.getCreditScore(agent1.address);
    expect(score).to.equal(6400);
  });

  it("should assign correct credit grade AAA", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 9500, courtScore: 9500, laborScore: 9500, relayScore: 9500, gcScore: 9500 },
      hre.ethers.ZeroHash
    );
    const grade = await creditRating.getCreditGrade(agent1.address);
    expect(grade).to.equal(0); // AAA
  });

  it("should assign correct credit grade BB", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 5000, courtScore: 5000, laborScore: 5000, relayScore: 5000, gcScore: 5000 },
      hre.ethers.ZeroHash
    );
    const grade = await creditRating.getCreditGrade(agent1.address);
    expect(grade).to.equal(4); // BB (score=5000)
  });

  it("should generate rating proof on update", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 7000, courtScore: 6000, laborScore: 8000, relayScore: 5000, gcScore: 5000 },
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("evidence"))
    );

    const proof = await creditRating.getRatingProof(agent1.address);
    expect(proof.evidenceRoot).to.equal(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("evidence")));
    expect(proof.phiContribution).to.equal(1750);
    expect(proof.courtContribution).to.equal(1200);
    expect(proof.laborContribution).to.equal(2000);
    expect(proof.relayContribution).to.equal(750);
  });

  it("should calculate fee multiplier AAA=7000 CCC=15000", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 9500, courtScore: 9500, laborScore: 9500, relayScore: 9500, gcScore: 9500 },
      hre.ethers.ZeroHash
    );
    expect(await creditRating.getFeeMultiplier(agent1.address)).to.equal(7000);

    await creditRating.updateCreditScore(
      agent2.address,
      { phiScore: 500, courtScore: 500, laborScore: 500, relayScore: 500, gcScore: 500 },
      hre.ethers.ZeroHash
    );
    expect(await creditRating.getFeeMultiplier(agent2.address)).to.equal(15000);
  });

  it("should allow emergency voting for BBB+ agents", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 7000, courtScore: 7000, laborScore: 7000, relayScore: 7000, gcScore: 7000 },
      hre.ethers.ZeroHash
    );
    expect(await creditRating.canVoteEmergency(agent1.address)).to.be.true;

    await creditRating.updateCreditScore(
      agent2.address,
      { phiScore: 5000, courtScore: 5000, laborScore: 5000, relayScore: 5000, gcScore: 5000 },
      hre.ethers.ZeroHash
    );
    expect(await creditRating.canVoteEmergency(agent2.address)).to.be.false;
  });

  it("should allow vouching for A+ agents", async function () {
    // Score=8000 → AA grade (≥8000) → can vouch
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 8000, courtScore: 8000, laborScore: 8000, relayScore: 8000, gcScore: 8000 },
      hre.ethers.ZeroHash
    );
    expect(await creditRating.canVouch(agent1.address)).to.be.true;

    // Score=7650 → A grade (7000-7999) → can vouch
    await creditRating.updateCreditScore(
      agent2.address,
      { phiScore: 9000, courtScore: 8000, laborScore: 7000, relayScore: 6000, gcScore: 6000 },
      hre.ethers.ZeroHash
    );
    expect(await creditRating.canVouch(agent2.address)).to.be.true;
  });

  it("should emit CreditUpdated event", async function () {
    await expect(
      creditRating.updateCreditScore(
        agent1.address,
        { phiScore: 8000, courtScore: 8000, laborScore: 8000, relayScore: 8000, gcScore: 8000 },
        hre.ethers.ZeroHash
      )
    ).to.emit(creditRating, "CreditUpdated");
  });

  it("should emit GradeChanged event when grade changes", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 8000, courtScore: 8000, laborScore: 8000, relayScore: 8000, gcScore: 8000 },
      hre.ethers.ZeroHash
    );

    await expect(
      creditRating.updateCreditScore(
        agent1.address,
        { phiScore: 3000, courtScore: 3000, laborScore: 3000, relayScore: 3000, gcScore: 3000 },
        hre.ethers.ZeroHash
      )
    ).to.emit(creditRating, "GradeChanged");
  });

  it("should reject score overflow", async function () {
    await expect(
      creditRating.updateCreditScore(
        agent1.address,
        { phiScore: 10001, courtScore: 5000, laborScore: 5000, relayScore: 5000, gcScore: 5000 },
        hre.ethers.ZeroHash
      )
    ).to.be.revertedWith("CreditRating: phiScore overflow");
  });

  it("should apply credit decay", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 8000, courtScore: 8000, laborScore: 8000, relayScore: 8000, gcScore: 8000 },
      hre.ethers.ZeroHash
    );

    const scoreBefore = await creditRating.getCreditScore(agent1.address);

    await time.increase(31 * 24 * 3600);

    await expect(
      creditRating.applyDecay(agent1.address)
    ).to.emit(creditRating, "DecayApplied");

    const scoreAfter = await creditRating.getCreditScore(agent1.address);
    expect(scoreAfter).to.be.lt(scoreBefore);
  });

  it("should reject decay if not enough time passed", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 8000, courtScore: 8000, laborScore: 8000, relayScore: 8000, gcScore: 8000 },
      hre.ethers.ZeroHash
    );

    await expect(
      creditRating.applyDecay(agent1.address)
    ).to.be.revertedWith("CreditRating: not yet decay time");
  });

  it("should return scoreToGrade correctly", async function () {
    expect(await creditRating.scoreToGrade(9500)).to.equal(0); // AAA
    expect(await creditRating.scoreToGrade(8500)).to.equal(1); // AA
    expect(await creditRating.scoreToGrade(7500)).to.equal(2); // A
    expect(await creditRating.scoreToGrade(6500)).to.equal(3); // BBB
    expect(await creditRating.scoreToGrade(5000)).to.equal(4); // BB
    expect(await creditRating.scoreToGrade(3000)).to.equal(5); // B
    expect(await creditRating.scoreToGrade(1000)).to.equal(6); // CCC
  });

  it("should return full credit info", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 9000, courtScore: 8000, laborScore: 7000, relayScore: 6000, gcScore: 6000 },
      hre.ethers.ZeroHash
    );

    const info = await creditRating.getFullCredit(agent1.address);
    expect(info.totalScore).to.equal(7400);
    expect(info.grade).to.equal(2); // A
    expect(info.phiScore).to.equal(9000);
  });
});

// =============== ConstitutionCourt Enhancement Tests ===============

describe("V12 ConstitutionCourt Enhancement", function () {
  let court: any;
  let phiStaking: any;
  let owner: any, agent1: any;

  beforeEach(async function () {
    [owner, , , , , agent1] = await hre.ethers.getSigners();

    const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20Factory.deploy("PhiToken", "PHI", 18);
    await mockToken.waitForDeployment();
    phiStaking = mockToken;

    const CourtFactory = await hre.ethers.getContractFactory("ConstitutionCourt");
    court = await CourtFactory.deploy(owner.address, await mockToken.getAddress());
    await court.waitForDeployment();
  });

  it("should attach analysis hash", async function () {
    await court.submitConstitutionalCase(1, "test reason", hre.ethers.ZeroHash);
    const analysisHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("analysis-report"));

    await court.attachAnalysis(1, analysisHash);
    expect(await court.caseAnalysisHashes(1)).to.equal(analysisHash);
  });

  it("should attach simulation hash", async function () {
    await court.submitConstitutionalCase(1, "test reason", hre.ethers.ZeroHash);
    const simHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("simulation-result"));

    await court.attachSimulation(1, simHash);
    expect(await court.caseSimulationHashes(1)).to.equal(simHash);
  });

  it("should return case metadata", async function () {
    await court.submitConstitutionalCase(1, "test reason", hre.ethers.ZeroHash);
    await court.attachAnalysis(1, hre.ethers.keccak256(hre.ethers.toUtf8Bytes("analysis")));

    const meta = await court.getCaseMetadata(1);
    expect(meta.analysisHash).to.equal(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("analysis")));
    expect(meta.simulationHash).to.equal(hre.ethers.ZeroHash);
    expect(meta.approvalRate).to.equal(0);
  });

  it("should reject attach for non-existent case", async function () {
    await expect(
      court.attachAnalysis(999, hre.ethers.ZeroHash)
    ).to.be.revertedWith("ConstitutionCourt: case not found");
  });

  it("should only allow admin to attach", async function () {
    await court.submitConstitutionalCase(1, "test reason", hre.ethers.ZeroHash);

    await expect(
      court.connect(agent1).attachAnalysis(1, hre.ethers.ZeroHash)
    ).to.be.revertedWith("ConstitutionCourt: not admin");
  });

  it("should calculate approval rate in metadata", async function () {
    await court.submitConstitutionalCase(1, "test reason", hre.ethers.ZeroHash);
    const meta = await court.getCaseMetadata(1);
    expect(meta.approvalRate).to.equal(0);
  });
});

// =============== ReputationStaking Tests ===============

describe("V12 ReputationStaking", function () {
  let reputationStaking: any;
  let creditRating: any;
  let court: any;
  let owner: any, agent1: any, agent2: any;

  beforeEach(async function () {
    [owner, , , , , agent1, agent2] = await hre.ethers.getSigners();

    const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20Factory.deploy("PhiToken", "PHI", 18);
    await mockToken.waitForDeployment();

    const CourtFactory = await hre.ethers.getContractFactory("ConstitutionCourt");
    court = await CourtFactory.deploy(owner.address, await mockToken.getAddress());
    await court.waitForDeployment();

    const CreditRatingFactory = await hre.ethers.getContractFactory("CreditRating");
    creditRating = await CreditRatingFactory.deploy(
      await mockToken.getAddress(),
      await court.getAddress(),
      hre.ethers.ZeroAddress,
      hre.ethers.ZeroAddress
    );
    await creditRating.waitForDeployment();

    const ReputationStakingFactory = await hre.ethers.getContractFactory("ReputationStaking");
    reputationStaking = await ReputationStakingFactory.deploy(await creditRating.getAddress());
    await reputationStaking.waitForDeployment();
  });

  it("should create a vouch", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 8000, courtScore: 8000, laborScore: 8000, relayScore: 8000, gcScore: 8000 },
      hre.ethers.ZeroHash
    );

    await expect(
      reputationStaking.connect(agent1).vouchFor(agent2.address, {
        value: hre.ethers.parseEther("0.5"),
      })
    ).to.emit(reputationStaking, "VouchCreated");

    expect(await reputationStaking.hasActiveVouch(agent2.address)).to.be.true;
  });

  it("should reject self-vouch", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 8000, courtScore: 8000, laborScore: 8000, relayScore: 8000, gcScore: 8000 },
      hre.ethers.ZeroHash
    );

    await expect(
      reputationStaking.connect(agent1).vouchFor(agent1.address, {
        value: hre.ethers.parseEther("0.5"),
      })
    ).to.be.revertedWith("ReputationStaking: cannot vouch for self");
  });

  it("should reject vouch from non-eligible agent", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 500, courtScore: 500, laborScore: 500, relayScore: 500, gcScore: 500 },
      hre.ethers.ZeroHash
    );

    await expect(
      reputationStaking.connect(agent1).vouchFor(agent2.address, {
        value: hre.ethers.parseEther("0.5"),
      })
    ).to.be.revertedWith("ReputationStaking: not eligible to vouch");
  });

  it("should slash vouch on violation", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 8000, courtScore: 8000, laborScore: 8000, relayScore: 8000, gcScore: 8000 },
      hre.ethers.ZeroHash
    );

    await reputationStaking.connect(agent1).vouchFor(agent2.address, {
      value: hre.ethers.parseEther("1.0"),
    });

    await expect(
      reputationStaking.connect(owner).slashVouch(agent1.address, agent2.address)
    ).to.emit(reputationStaking, "VouchSlashed");

    expect(await reputationStaking.hasActiveVouch(agent2.address)).to.be.false;
  });

  it("should release vouch after hold period", async function () {
    await creditRating.updateCreditScore(
      agent1.address,
      { phiScore: 8000, courtScore: 8000, laborScore: 8000, relayScore: 8000, gcScore: 8000 },
      hre.ethers.ZeroHash
    );

    await reputationStaking.connect(agent1).vouchFor(agent2.address, {
      value: hre.ethers.parseEther("1.0"),
    });

    await time.increase(31 * 24 * 3600);

    await expect(
      reputationStaking.connect(agent1).releaseVouch(agent2.address)
    ).to.emit(reputationStaking, "VouchReleased");

    expect(await reputationStaking.hasActiveVouch(agent2.address)).to.be.false;
  });
});
