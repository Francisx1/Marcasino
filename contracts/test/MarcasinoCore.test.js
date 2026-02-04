const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MarcasinoCore", function () {
  let marcasinoCore;
  let owner, admin, game1, game2, user;
  const HOUSE_EDGE = 500; // 5%

  beforeEach(async function () {
    [owner, admin, game1, game2, user] = await ethers.getSigners();

    const MarcasinoCore = await ethers.getContractFactory("MarcasinoCore");
    marcasinoCore = await MarcasinoCore.deploy(HOUSE_EDGE);
    await marcasinoCore.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct house edge", async function () {
      expect(await marcasinoCore.houseEdge()).to.equal(HOUSE_EDGE);
    });

    it("Should grant admin role to deployer", async function () {
      const ADMIN_ROLE = await marcasinoCore.ADMIN_ROLE();
      expect(await marcasinoCore.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should revert with invalid house edge", async function () {
      const MarcasinoCore = await ethers.getContractFactory("MarcasinoCore");
      await expect(MarcasinoCore.deploy(50)).to.be.reverted; // Too low
      await expect(MarcasinoCore.deploy(1500)).to.be.reverted; // Too high
    });
  });

  describe("Game Registration", function () {
    it("Should register a new game", async function () {
      await marcasinoCore.registerGame(game1.address, "TestGame");
      expect(await marcasinoCore.isRegisteredGame(game1.address)).to.be.true;
    });

    it("Should emit GameRegistered event", async function () {
      await expect(marcasinoCore.registerGame(game1.address, "TestGame"))
        .to.emit(marcasinoCore, "GameRegistered")
        .withArgs(game1.address, "TestGame");
    });

    it("Should revert if non-admin tries to register game", async function () {
      await expect(
        marcasinoCore.connect(user).registerGame(game1.address, "TestGame")
      ).to.be.reverted;
    });

    it("Should revert if game already registered", async function () {
      await marcasinoCore.registerGame(game1.address, "TestGame");
      await expect(
        marcasinoCore.registerGame(game1.address, "TestGame")
      ).to.be.revertedWithCustomError(marcasinoCore, "GameAlreadyRegistered");
    });
  });

  describe("House Edge Management", function () {
    it("Should update house edge", async function () {
      const newEdge = 300; // 3%
      await marcasinoCore.setHouseEdge(newEdge);
      expect(await marcasinoCore.houseEdge()).to.equal(newEdge);
    });

    it("Should emit HouseEdgeUpdated event", async function () {
      const newEdge = 300;
      await expect(marcasinoCore.setHouseEdge(newEdge))
        .to.emit(marcasinoCore, "HouseEdgeUpdated")
        .withArgs(HOUSE_EDGE, newEdge);
    });

    it("Should revert with invalid house edge", async function () {
      await expect(
        marcasinoCore.setHouseEdge(50)
      ).to.be.revertedWithCustomError(marcasinoCore, "InvalidHouseEdge");
    });
  });

  describe("Pause Functionality", function () {
    it("Should pause the platform", async function () {
      await marcasinoCore.emergencyPause();
      expect(await marcasinoCore.isOperational()).to.be.false;
    });

    it("Should unpause the platform", async function () {
      await marcasinoCore.emergencyPause();
      await marcasinoCore.unpause();
      expect(await marcasinoCore.isOperational()).to.be.true;
    });
  });

  describe("View Functions", function () {
    it("Should return correct game count", async function () {
      await marcasinoCore.registerGame(game1.address, "Game1");
      await marcasinoCore.registerGame(game2.address, "Game2");
      expect(await marcasinoCore.getGameCount()).to.equal(2);
    });

    it("Should return all registered games", async function () {
      await marcasinoCore.registerGame(game1.address, "Game1");
      await marcasinoCore.registerGame(game2.address, "Game2");
      
      const games = await marcasinoCore.getRegisteredGames();
      expect(games.length).to.equal(2);
      expect(games[0]).to.equal(game1.address);
      expect(games[1]).to.equal(game2.address);
    });
  });
});
