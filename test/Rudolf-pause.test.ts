import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Rudolf__factory, Rudolf } from "../typechain";

// Start test block
let rudolfFactory: Rudolf__factory;
let rudolf: Rudolf;
let owner: SignerWithAddress;
let user1: SignerWithAddress;
let initialState: number;
describe("Rudolf Pause", () => {
  before(async () => {
    rudolfFactory = await ethers.getContractFactory("Rudolf");
    [owner, user1] = await ethers.getSigners();
    initialState = await ethers.provider.send("evm_snapshot", []);
  });

  beforeEach(async () => {
    rudolf = await rudolfFactory.deploy();
    await rudolf.deployed();
    initialState = await ethers.provider.send("evm_snapshot", []);
  });

  afterEach(async () => {
    //always revert to initialState snapshot for next test
    await ethers.provider.send("evm_revert", [initialState]);
  });

  describe("construct()", () => {
    it("Contract is not paused", async () => {
      expect(await rudolf.paused()).to.equal(false);
    });
  });

  describe("pause()", () => {
    it("Owner can pause token transfer", async () => {
      await rudolf.pause();
      expect(await rudolf.paused()).to.equal(true);
    });

    it("Non-owner accounts can't call pause method", async () => {
      await expect(rudolf.connect(user1).pause()).to.be.revertedWith("Ownable: caller is not the owner");
      expect(await rudolf.paused()).to.equal(false);
    });

    context("When owner has renounced ownership", () => {
      beforeEach(async () => {
        await rudolf.renounceOwnership();
      });

      it("Owner can't call pause method anymore", async () => {
        await expect(rudolf.connect(user1).pause()).to.be.revertedWith("Ownable: caller is not the owner");
        expect(await rudolf.paused()).to.equal(false);
      });
    });

    context("When contract is paused", () => {
      beforeEach(async () => {
        await rudolf.pause();
      });

      it("Transfer is not permitted", async () => {
        await expect(rudolf.transfer(user1.address, 1)).to.be.revertedWith(
          "ERC20Pausable: token transfer while paused"
        );
      });

      it("Xmas Airdrop is not claimable", async () => {
        await expect(rudolf.claimXmasAirdrop()).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("unpause()", () => {
    beforeEach(async () => {
      await rudolf.pause();
    });

    it("Owner can unpause token transfer", async () => {
      await rudolf.unpause();
      expect(await rudolf.paused()).to.equal(false);
    });

    it("Non-owner accounts can't call unpause method", async () => {
      await expect(rudolf.connect(user1).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
      expect(await rudolf.paused()).to.equal(true);
    });
  });
});
