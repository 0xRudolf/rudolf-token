import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Rudolf__factory, Rudolf } from "../typechain";

// Start test block
let rudolfFactory: Rudolf__factory;
let rudolf: Rudolf;
let owner: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let user3: SignerWithAddress;
let initialState: number;
describe("Rudolf Owner",  () => {
  before(async () => {
    rudolfFactory = await ethers.getContractFactory("Rudolf");
    [owner, user1, user2, user3] = await ethers.getSigners();
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
    it("Ownership is given to deployer address", async () => {
      expect(await rudolf.owner()).to.equal(owner.address);
    });

    it("Initial supply is sent to deployer address", async () => {
      const ownerBalance = await rudolf.balanceOf(owner.address);
      expect(await rudolf.totalSupply()).to.equal(ownerBalance);
    });
  });

  describe("renounceOwnership()", () => {
    it("Owner can renounce ownership", async () => {
      await rudolf.renounceOwnership();
      expect(await rudolf.owner()).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Non-owner accounts can't call renounceOwnership", async () => {
      await expect(rudolf.connect(user1).renounceOwnership()).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("transferOwnership()", () => {
    it("Owner can transfer ownership", async () => {
      await rudolf.transferOwnership(user1.address);
      expect(await rudolf.owner()).to.equal(user1.address);
    });

    it("New owner can call ownerOnly methods", async () => {
      await rudolf.transferOwnership(user1.address);
      await rudolf.connect(user1).renounceOwnership();
      expect(await rudolf.owner()).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Old owner can't call ownerOnly methods anymore", async () => {
      await rudolf.transferOwnership(user1.address);
      await expect(rudolf.renounceOwnership()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Non-owner accounts can't call transferOwnership", async () => {
      await expect(rudolf.connect(user1).transferOwnership(user1.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });
});
