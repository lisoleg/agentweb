import { expect } from "chai";
import hre from "hardhat";
import { MockERC20, SigmaBridgeV2 } from "../typechain-types";

describe("V11.0 SigmaBridgeV2 跨链桥接V2测试", function () {
  let gcToken: MockERC20;
  let bridge: SigmaBridgeV2;

  let owner: any;
  let admin: any;
  let agent1: any;
  let agent2: any;

  const CHAIN_ID_SOURCE = 1n;
  const CHAIN_ID_TARGET = 42161n;

  async function deployFixture() {
    [owner, admin, agent1, agent2] = await hre.ethers.getSigners();

    // Deploy MockERC20
    const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    gcToken = await MockERC20Factory.deploy("GC Token", "GC", 18);
    await gcToken.waitForDeployment();

    // Deploy SigmaBridgeV2
    const BridgeFactory = await hre.ethers.getContractFactory("SigmaBridgeV2");
    bridge = await BridgeFactory.deploy(CHAIN_ID_SOURCE, hre.ethers.ZeroAddress);
    await bridge.waitForDeployment();

    await bridge.addAdmin(admin.address);

    // Mint tokens to agents
    await gcToken.mint(agent1.address, hre.ethers.parseEther("10000"));
    await gcToken.mint(agent2.address, hre.ethers.parseEther("10000"));
  }

  describe("锁定资产（lockWithPassport）", function () {
    beforeEach(async () => {
      await deployFixture();
    });

    it("应成功锁定资产并携带Passport数据", async function () {
      const amount = hre.ethers.parseEther("100");
      await gcToken.connect(agent1).approve(await bridge.getAddress(), amount);

      const passportData = {
        phiValue: 8000,
        creditScore: 6000,
        caseMerkleRoot: hre.ethers.ZeroHash,
        lostCaseCount: 2,
      };

      const tx = await bridge.connect(agent1).lockWithPassport(
        CHAIN_ID_TARGET,
        await gcToken.getAddress(),
        amount,
        passportData
      );

      await expect(tx).to.emit(bridge, "LockedWithPassport");

      // requestId is keccak256, check via event only (getMigrationRequest requires valid bytes32)
    });

    it("零数量应被拒绝", async function () {
      const passportData = {
        phiValue: 8000,
        creditScore: 6000,
        caseMerkleRoot: hre.ethers.ZeroHash,
        lostCaseCount: 0,
      };

      await expect(
        bridge.connect(agent1).lockWithPassport(
          CHAIN_ID_TARGET,
          await gcToken.getAddress(),
          0n,
          passportData
        )
      ).to.be.revertedWith("SigmaBridgeV2: zero amount");
    });

    it("无效phiValue应被拒绝", async function () {
      const amount = hre.ethers.parseEther("100");
      await gcToken.connect(agent1).approve(await bridge.getAddress(), amount);

      const passportData = {
        phiValue: 10001,
        creditScore: 6000,
        caseMerkleRoot: hre.ethers.ZeroHash,
        lostCaseCount: 0,
      };

      await expect(
        bridge.connect(agent1).lockWithPassport(
          CHAIN_ID_TARGET,
          await gcToken.getAddress(),
          amount,
          passportData
        )
      ).to.be.revertedWith("SigmaBridgeV2: invalid phiValue");
    });
  });

  describe("铸造（mintWithPassport）", function () {
    let requestId: string;

    beforeEach(async () => {
      await deployFixture();

      const amount = hre.ethers.parseEther("100");
      await gcToken.connect(agent1).approve(await bridge.getAddress(), amount);

      const passportData = {
        phiValue: 8000,
        creditScore: 6000,
        caseMerkleRoot: hre.ethers.ZeroHash,
        lostCaseCount: 2,
      };

      const tx = await bridge.connect(agent1).lockWithPassport(
        CHAIN_ID_TARGET,
        await gcToken.getAddress(),
        amount,
        passportData
      );

      const receipt = await tx.wait();
      const lockEvent = receipt?.logs.find(
        (log: any) => {
          try {
            const parsed = bridge.interface.parseLog(log);
            return parsed?.name === "LockedWithPassport";
          } catch { return false; }
        }
      );
      if (lockEvent) {
        const parsed = bridge.interface.parseLog(lockEvent);
        requestId = parsed?.args[0];
      }
    });

    it("应成功铸造并计算Φ衰减", async function () {
      const passportData = {
        phiValue: 8000,
        creditScore: 6000,
        caseMerkleRoot: hre.ethers.ZeroHash,
        lostCaseCount: 2,
      };

      const tx = await bridge.mintWithPassport(
        requestId,
        agent1.address,
        CHAIN_ID_SOURCE,
        hre.ethers.parseEther("100"),
        passportData
      );

      await expect(tx).to.emit(bridge, "MintedWithPassport");

      // Verify decayed phi: 8000 * 9500 / 10000 = 7600
      const decayedPhi = await bridge.calculateDecayedPhi(8000);
      expect(decayedPhi).to.equal(7600);
    });
  });

  describe("Φ衰减计算", function () {
    beforeEach(async () => {
      await deployFixture();
    });

    it("默认decayRate=9500, phi=10000 → 衰减为9500", async function () {
      const decayed = await bridge.calculateDecayedPhi(10000);
      expect(decayed).to.equal(9500);
    });

    it("phi=0 → 衰减为0", async function () {
      const decayed = await bridge.calculateDecayedPhi(0);
      expect(decayed).to.equal(0);
    });

    it("修改decayRate后衰减应正确计算", async function () {
      await bridge.connect(admin).setDecayRate(9000);
      const decayed = await bridge.calculateDecayedPhi(10000);
      expect(decayed).to.equal(9000);
    });

    it("无效decayRate应被拒绝", async function () {
      await expect(
        bridge.connect(admin).setDecayRate(0)
      ).to.be.revertedWith("SigmaBridgeV2: invalid rate");
    });
  });

  describe("标记迁徙完成（markMigrated）", function () {
    let requestId: string;

    beforeEach(async () => {
      await deployFixture();

      const amount = hre.ethers.parseEther("100");
      await gcToken.connect(agent1).approve(await bridge.getAddress(), amount);

      const passportData = {
        phiValue: 8000,
        creditScore: 6000,
        caseMerkleRoot: hre.ethers.ZeroHash,
        lostCaseCount: 0,
      };

      const tx = await bridge.connect(agent1).lockWithPassport(
        CHAIN_ID_TARGET,
        await gcToken.getAddress(),
        amount,
        passportData
      );

      const receipt = await tx.wait();
      const lockEvent = receipt?.logs.find((log: any) => {
        try {
          const parsed = bridge.interface.parseLog(log);
          return parsed?.name === "LockedWithPassport";
        } catch { return false; }
      });
      if (lockEvent) {
        const parsed = bridge.interface.parseLog(lockEvent);
        requestId = parsed?.args[0];
      }

      // Mint first
      await bridge.mintWithPassport(
        requestId,
        agent1.address,
        CHAIN_ID_SOURCE,
        amount,
        passportData
      );
    });

    it("管理员应能标记迁徙完成", async function () {
      const tx = await bridge.connect(admin).markMigrated(requestId);
      await expect(tx).to.emit(bridge, "MarkedMigrated");

      expect(await bridge.isAgentMigrated(agent1.address)).to.be.true;
    });

    it("非管理员标记应被拒绝", async function () {
      await expect(
        bridge.connect(agent1).markMigrated(requestId)
      ).to.be.reverted;
    });
  });
});
