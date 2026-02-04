const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TreasuryManager", function () {
  let treasuryManager;
  let owner, admin, game, player1, player2;
  const MIN_BET = ethers.parseEther("0.01");
  const MAX_BET = ethers.parseEther("1.0");

  beforeEach(async function () {
    [owner, admin, game, player1, player2] = await ethers.getSigners();

    const TreasuryManager = await ethers.getContractFactory("TreasuryManager");
    treasuryManager = await TreasuryManager.deploy(MIN_BET, MAX_BET);
    await treasuryManager.waitForDeployment();

    // Grant GAME_ROLE to game contract
    const GAME_ROLE = await treasuryManager.GAME_ROLE();
    await treasuryManager.grantRole(GAME_ROLE, game.address);

    // Fund treasury
    await owner.sendTransaction({
      to: await treasuryManager.getAddress(),
      value: ethers.parseEther("10.0"),
    });
  });

  describe("Deployment", function () {
    it("Should set correct bet limits", async function () {
      expect(await treasuryManager.minBetAmount()).to.equal(MIN_BET);
      expect(await treasuryManager.maxBetAmount()).to.equal(MAX_BET);
    });

    it("Should have correct balance", async function () {
      const balance = await ethers.provider.getBalance(await treasuryManager.getAddress());
      expect(balance).to.equal(ethers.parseEther("10.0"));
    });
  });

  describe("Deposits", function () {
    it("Should allow deposits", async function () {
      const depositAmount = ethers.parseEther("1.0");
      await treasuryManager.connect(player1).deposit({ value: depositAmount });
      
      expect(await treasuryManager.playerBalances(player1.address)).to.equal(depositAmount);
    });

    it("Should emit Deposited event", async function () {
      const depositAmount = ethers.parseEther("1.0");
      await expect(treasuryManager.connect(player1).deposit({ value: depositAmount }))
        .to.emit(treasuryManager, "Deposited")
        .withArgs(player1.address, depositAmount);
    });

    it("Should revert on zero deposit", async function () {
      await expect(
        treasuryManager.connect(player1).deposit({ value: 0 })
      ).to.be.revertedWithCustomError(treasuryManager, "InvalidAmount");
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      await treasuryManager.connect(player1).deposit({ value: ethers.parseEther("2.0") });
    });

    it("Should allow withdrawals", async function () {
      const withdrawAmount = ethers.parseEther("1.0");
      await treasuryManager.connect(player1).withdraw(withdrawAmount);
      
      expect(await treasuryManager.playerBalances(player1.address)).to.equal(ethers.parseEther("1.0"));
    });

    it("Should revert on insufficient balance", async function () {
      await expect(
        treasuryManager.connect(player1).withdraw(ethers.parseEther("3.0"))
      ).to.be.revertedWithCustomError(treasuryManager, "InsufficientBalance");
    });
  });

  describe("Bet Processing", function () {
    beforeEach(async function () {
      await treasuryManager.connect(player1).deposit({ value: ethers.parseEther("2.0") });
    });

    it("Should process valid bet", async function () {
      const betAmount = ethers.parseEther("0.5");
      await treasuryManager.connect(game).processBet(player1.address, betAmount);
      
      expect(await treasuryManager.playerBalances(player1.address)).to.equal(ethers.parseEther("1.5"));
      expect(await treasuryManager.totalBetsReceived()).to.equal(betAmount);
    });

    it("Should revert bet below minimum", async function () {
      const betAmount = ethers.parseEther("0.005");
      await expect(
        treasuryManager.connect(game).processBet(player1.address, betAmount)
      ).to.be.revertedWithCustomError(treasuryManager, "BetOutOfRange");
    });

    it("Should revert bet above maximum", async function () {
      const betAmount = ethers.parseEther("2.0");
      await expect(
        treasuryManager.connect(game).processBet(player1.address, betAmount)
      ).to.be.revertedWithCustomError(treasuryManager, "BetOutOfRange");
    });

    it("Should revert if not game role", async function () {
      await expect(
        treasuryManager.connect(player2).processBet(player1.address, ethers.parseEther("0.5"))
      ).to.be.reverted;
    });
  });

  describe("Payout Processing", function () {
    it("Should process payout", async function () {
      const payoutAmount = ethers.parseEther("1.0");
      const houseEdge = 500; // 5%
      
      await treasuryManager.connect(game).processPayout(player1.address, payoutAmount, houseEdge);
      
      const expectedPayout = (payoutAmount * BigInt(10000 - houseEdge)) / BigInt(10000);
      expect(await treasuryManager.playerBalances(player1.address)).to.equal(expectedPayout);
    });

    it("Should track house earnings", async function () {
      const payoutAmount = ethers.parseEther("1.0");
      const houseEdge = 500; // 5%
      
      await treasuryManager.connect(game).processPayout(player1.address, payoutAmount, houseEdge);
      
      const expectedHouseAmount = (payoutAmount * BigInt(houseEdge)) / BigInt(10000);
      expect(await treasuryManager.houseEarnings()).to.equal(expectedHouseAmount);
    });
  });

  describe("Statistics", function () {
    it("Should return correct treasury stats", async function () {
      const stats = await treasuryManager.getTreasuryStats();
      expect(stats.balance).to.equal(ethers.parseEther("10.0"));
      expect(stats.totalBets).to.equal(0);
      expect(stats.totalPayouts).to.equal(0);
      expect(stats.earnings).to.equal(0);
    });
  });
});
