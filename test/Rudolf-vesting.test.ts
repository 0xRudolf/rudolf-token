import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Rudolf__factory, Rudolf } from "../typechain";
//we are using ethers BigNumber for test because native bigint support is not completely supported in mocha v7 (used by hardhat)
import { BigNumber } from "@ethersproject/bignumber";

// Start test block
let rudolfFactory: Rudolf__factory;
let rudolf: Rudolf;
let owner: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let user3: SignerWithAddress;
let initialState: number;
const decimals = 18;
const withDecimals = (n: number | BigNumber): BigNumber => BigNumber.from(n).mul(BigNumber.from(10).pow(decimals));
const withoutDecimals = (n: BigNumber): number => parseFloat(ethers.utils.formatUnits(n, decimals));
const supply: BigNumber = withDecimals(4200000000);
const xmasAirDropAmount: BigNumber = withDecimals(1200000000);
const xmas2021 = 1640390400;
const monthInSeconds = 2628000;
const yearInSeconds = 365 * 24 * 3600;
describe("Rudolf Vesting", () => {
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

  describe("getVestedXmasAirdropAmountForAccount()", () => {
    it("Nothing is vested before a XmasAirdrop", async () => {
      const vestedAmounts: {
        releaseTime: BigNumber;
        amount: BigNumber;
      }[] = await rudolf.getVestedXmasAirdropAmountForAccount(user1.address);
      expect(vestedAmounts.length).to.equal(0);
    });
  });

  describe("XmasAirdrop", () => {
    context("When an XmasAirdrop occurred", () => {
      let ownerBalanceBeforeXmas: BigNumber, user1BalanceBeforeXmas: BigNumber, user2BalanceBeforeXmas: BigNumber;
      let ownerExpectedAirdrop: BigNumber, user1ExpectedAirdrop: BigNumber, user2ExpectedAirdrop: BigNumber;
      beforeEach(async () => {
        await rudolf.transfer(user1.address, withDecimals(1000000000)); // 1B
        await rudolf.transfer(user2.address, withDecimals(100000000)); // 0.1B

        ownerBalanceBeforeXmas = await rudolf.balanceOf(owner.address);
        user1BalanceBeforeXmas = await rudolf.balanceOf(user1.address);
        user2BalanceBeforeXmas = await rudolf.balanceOf(user2.address);

        ownerExpectedAirdrop = xmasAirDropAmount.mul(ownerBalanceBeforeXmas).div(supply);
        user1ExpectedAirdrop = xmasAirDropAmount.mul(user1BalanceBeforeXmas).div(supply);
        user2ExpectedAirdrop = xmasAirDropAmount.mul(user2BalanceBeforeXmas).div(supply);

        await ethers.provider.send("evm_mine", [xmas2021]);
        await rudolf.transfer(user3.address, 1);
      });

      it("Accounts have 1/12th of their XmasAirdrop directly claimable", async () => {
        const ownerAirdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address);
        expect(ownerAirdrop).to.equal(ownerExpectedAirdrop.div(12));

        const user1Airdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address);
        expect(user1Airdrop).to.equal(user1ExpectedAirdrop.div(12));

        const user2Airdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address);
        expect(user2Airdrop).to.equal(user2ExpectedAirdrop.div(12));
      });

      it("XmasAirdrop total claimable is equal to 1/12th XmasAirdrop emission", async () => {
        let total = await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address);
        total = total.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address));
        total = total.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address));
        expect(withoutDecimals(total)).to.equal(withoutDecimals(xmasAirDropAmount.div(12)));
      });

      it("Accounts can claim their airdrop", async () => {
        const ownerBalance = await rudolf.balanceOf(owner.address);
        await rudolf.claimXmasAirdrop();
        expect(await rudolf.balanceOf(owner.address)).to.equal(ownerBalance.add(ownerExpectedAirdrop.div(12)));

        const user1Balance = await rudolf.balanceOf(user1.address);
        await rudolf.connect(user1).claimXmasAirdrop();
        expect(await rudolf.balanceOf(user1.address)).to.equal(user1Balance.add(user1ExpectedAirdrop.div(12)));

        const user2Balance = await rudolf.balanceOf(user2.address);
        await rudolf.connect(user2).claimXmasAirdrop();
        expect(await rudolf.balanceOf(user2.address)).to.equal(user2Balance.add(user2ExpectedAirdrop.div(12)));
      });

      it("User can only claim 1/12th of the airdrop yet", async () => {
        const user1Balance = await rudolf.balanceOf(user1.address);
        await rudolf.connect(user1).claimXmasAirdrop();
        await expect(rudolf.connect(user1).claimXmasAirdrop()).to.be.revertedWith("RUDOLF: nothing to claim");
        await expect(rudolf.connect(user1).claimXmasAirdrop()).to.be.revertedWith("RUDOLF: nothing to claim");
        expect(await rudolf.balanceOf(user1.address)).to.equal(user1Balance.add(user1ExpectedAirdrop.div(12)));
      });

      it("Total supply is increased up to 1/12th total XmasAirdrop emission", async () => {
        await rudolf.claimXmasAirdrop();
        await rudolf.connect(user1).claimXmasAirdrop();
        await rudolf.connect(user2).claimXmasAirdrop();
        expect(withoutDecimals(await rudolf.totalSupply())).to.equal(
          withoutDecimals(supply.add(xmasAirDropAmount.div(12)))
        );
      });

      it("Users have 11 more monthly vested airdrop", async () => {
        let vestedAmounts: { releaseTime: BigNumber; amount: BigNumber }[];
        vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(owner.address);
        expect(vestedAmounts.length).to.equal(11);
        vestedAmounts.forEach((v, i) => {
          expect(v.amount).to.equal(ownerExpectedAirdrop.div(12));
          expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + (i + 1) * monthInSeconds));
        });

        vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user1.address);
        expect(vestedAmounts.length).to.equal(11);
        vestedAmounts.forEach((v, i) => {
          expect(v.amount).to.equal(user1ExpectedAirdrop.div(12));
          expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + (i + 1) * monthInSeconds));
        });

        vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user2.address);
        expect(vestedAmounts.length).to.equal(11);
        vestedAmounts.forEach((v, i) => {
          expect(v.amount).to.equal(user2ExpectedAirdrop.div(12));
          expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + (i + 1) * monthInSeconds));
        });
      });

      it("Total claimable + total vested is equal to XmasAirdrop emission", async () => {
        let totalVested = BigNumber.from(0);
        let vestedAmounts: { releaseTime: BigNumber; amount: BigNumber }[];
        vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(owner.address);
        vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));
        vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user1.address);
        vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));
        vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user2.address);
        vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));

        let totalClaimable = BigNumber.from(0);
        totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address));
        totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address));
        totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address));

        expect(withoutDecimals(totalClaimable.add(totalVested))).to.equal(withoutDecimals(xmasAirDropAmount));
      });

      context("1 month later", () => {
        beforeEach(async () => {
          await ethers.provider.send("evm_mine", [xmas2021 + monthInSeconds * 1.1]);
          await rudolf.transfer(user3.address, 1);
        });

        it("Accounts have 2/12th of their XmasAirdrop directly claimable", async () => {
          const ownerAirdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address);
          expect(ownerAirdrop).to.equal(ownerExpectedAirdrop.div(6));

          const user1Airdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address);
          expect(user1Airdrop).to.equal(user1ExpectedAirdrop.div(6));

          const user2Airdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address);
          expect(user2Airdrop).to.equal(user2ExpectedAirdrop.div(6));
        });

        it("XmasAirdrop total claimable is equal to 2/12th XmasAirdrop emission", async () => {
          let total = await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address);
          total = total.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address));
          total = total.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address));
          expect(withoutDecimals(total)).to.equal(withoutDecimals(xmasAirDropAmount.div(6)));
        });

        it("Accounts can claim their airdrop", async () => {
          const ownerBalance = await rudolf.balanceOf(owner.address);
          await rudolf.claimXmasAirdrop();
          expect(await rudolf.balanceOf(owner.address)).to.equal(ownerBalance.add(ownerExpectedAirdrop.div(6)));

          const user1Balance = await rudolf.balanceOf(user1.address);
          await rudolf.connect(user1).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user1.address)).to.equal(user1Balance.add(user1ExpectedAirdrop.div(6)));

          const user2Balance = await rudolf.balanceOf(user2.address);
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user2.address)).to.equal(user2Balance.add(user2ExpectedAirdrop.div(6)));
        });

        it("User can only claim 2/12th of the airdrop yet", async () => {
          const user1Balance = await rudolf.balanceOf(user1.address);
          await rudolf.connect(user1).claimXmasAirdrop();
          await expect(rudolf.connect(user1).claimXmasAirdrop()).to.be.revertedWith("RUDOLF: nothing to claim");
          await expect(rudolf.connect(user1).claimXmasAirdrop()).to.be.revertedWith("RUDOLF: nothing to claim");
          expect(await rudolf.balanceOf(user1.address)).to.equal(user1Balance.add(user1ExpectedAirdrop.div(6)));
        });

        it("Total supply is increased up to 2/12th total XmasAirdrop emission", async () => {
          await rudolf.claimXmasAirdrop();
          await rudolf.connect(user1).claimXmasAirdrop();
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(withoutDecimals(await rudolf.totalSupply())).to.equal(
            withoutDecimals(supply.add(xmasAirDropAmount.div(6)))
          );
        });

        it("Users have 10 more monthly vested airdrop", async () => {
          let vestedAmounts: { releaseTime: BigNumber; amount: BigNumber }[];
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(owner.address);
          expect(vestedAmounts.length).to.equal(10);
          vestedAmounts.forEach((v, i) => {
            expect(v.amount).to.equal(ownerExpectedAirdrop.div(12));
            expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + (i + 2) * monthInSeconds));
          });

          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user1.address);
          expect(vestedAmounts.length).to.equal(10);
          vestedAmounts.forEach((v, i) => {
            expect(v.amount).to.equal(user1ExpectedAirdrop.div(12));
            expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + (i + 2) * monthInSeconds));
          });

          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user2.address);
          expect(vestedAmounts.length).to.equal(10);
          vestedAmounts.forEach((v, i) => {
            expect(v.amount).to.equal(user2ExpectedAirdrop.div(12));
            expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + (i + 2) * monthInSeconds));
          });
        });

        it("Total claimable + total vested is equal to XmasAirdrop emission", async () => {
          let totalVested = BigNumber.from(0);
          let vestedAmounts: { releaseTime: BigNumber; amount: BigNumber }[];
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(owner.address);
          vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user1.address);
          vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user2.address);
          vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));

          let totalClaimable = BigNumber.from(0);
          totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address));
          totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address));
          totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address));

          expect(withoutDecimals(totalClaimable.add(totalVested))).to.equal(withoutDecimals(xmasAirDropAmount));
        });
      });

      context("5 month later", () => {
        beforeEach(async () => {
          await ethers.provider.send("evm_mine", [xmas2021 + monthInSeconds * 5]);
          await rudolf.transfer(user3.address, 1);
        });

        it("Accounts have half of their XmasAirdrop directly claimable", async () => {
          const ownerAirdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address);
          expect(ownerAirdrop).to.equal(ownerExpectedAirdrop.div(2));

          const user1Airdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address);
          expect(user1Airdrop).to.equal(user1ExpectedAirdrop.div(2));

          const user2Airdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address);
          expect(user2Airdrop).to.equal(user2ExpectedAirdrop.div(2));
        });

        it("XmasAirdrop total claimable is equal to 1/2 XmasAirdrop emission", async () => {
          let total = await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address);
          total = total.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address));
          total = total.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address));
          expect(withoutDecimals(total)).to.equal(withoutDecimals(xmasAirDropAmount.div(2)));
        });

        it("Accounts can claim their airdrop", async () => {
          const ownerBalance = await rudolf.balanceOf(owner.address);
          await rudolf.claimXmasAirdrop();
          expect(await rudolf.balanceOf(owner.address)).to.equal(ownerBalance.add(ownerExpectedAirdrop.div(2)));

          const user1Balance = await rudolf.balanceOf(user1.address);
          await rudolf.connect(user1).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user1.address)).to.equal(user1Balance.add(user1ExpectedAirdrop.div(2)));

          const user2Balance = await rudolf.balanceOf(user2.address);
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user2.address)).to.equal(user2Balance.add(user2ExpectedAirdrop.div(2)));
        });

        it("User can only claim 1/2 of the airdrop yet", async () => {
          const user1Balance = await rudolf.balanceOf(user1.address);
          await rudolf.connect(user1).claimXmasAirdrop();
          await expect(rudolf.connect(user1).claimXmasAirdrop()).to.be.revertedWith("RUDOLF: nothing to claim");
          await expect(rudolf.connect(user1).claimXmasAirdrop()).to.be.revertedWith("RUDOLF: nothing to claim");
          expect(await rudolf.balanceOf(user1.address)).to.equal(user1Balance.add(user1ExpectedAirdrop.div(2)));
        });

        it("Total supply is increased up to 1/2 total XmasAirdrop emission", async () => {
          await rudolf.claimXmasAirdrop();
          await rudolf.connect(user1).claimXmasAirdrop();
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(withoutDecimals(await rudolf.totalSupply())).to.equal(
            withoutDecimals(supply.add(xmasAirDropAmount.div(2)))
          );
        });

        it("Users have 6 more monthly vested airdrop", async () => {
          let vestedAmounts: { releaseTime: BigNumber; amount: BigNumber }[];
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(owner.address);
          expect(vestedAmounts.length).to.equal(6);
          vestedAmounts.forEach((v, i) => {
            expect(v.amount).to.equal(ownerExpectedAirdrop.div(12));
            expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + (i + 6) * monthInSeconds));
          });

          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user1.address);
          expect(vestedAmounts.length).to.equal(6);
          vestedAmounts.forEach((v, i) => {
            expect(v.amount).to.equal(user1ExpectedAirdrop.div(12));
            expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + (i + 6) * monthInSeconds));
          });

          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user2.address);
          expect(vestedAmounts.length).to.equal(6);
          vestedAmounts.forEach((v, i) => {
            expect(v.amount).to.equal(user2ExpectedAirdrop.div(12));
            expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + (i + 6) * monthInSeconds));
          });
        });

        it("Total claimable + total vested is equal to XmasAirdrop emission", async () => {
          let totalVested = BigNumber.from(0);
          let vestedAmounts: { releaseTime: BigNumber; amount: BigNumber }[];
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(owner.address);
          vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user1.address);
          vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user2.address);
          vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));

          let totalClaimable = BigNumber.from(0);
          totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address));
          totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address));
          totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address));

          expect(withoutDecimals(totalClaimable.add(totalVested))).to.equal(withoutDecimals(xmasAirDropAmount));
        });
      });

      context("10 month later", () => {
        beforeEach(async () => {
          await ethers.provider.send("evm_mine", [xmas2021 + monthInSeconds * 10.2]);
          await rudolf.transfer(user3.address, 1);
        });

        it("Accounts have 11/12th of their XmasAirdrop directly claimable", async () => {
          const ownerAirdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address);
          expect(ownerAirdrop).to.equal(ownerExpectedAirdrop.mul(11).div(12));

          const user1Airdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address);
          expect(user1Airdrop).to.equal(user1ExpectedAirdrop.mul(11).div(12));

          const user2Airdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address);
          expect(user2Airdrop).to.equal(user2ExpectedAirdrop.mul(11).div(12));
        });

        it("XmasAirdrop total claimable is equal to 11/12th of XmasAirdrop emission", async () => {
          let total = await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address);
          total = total.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address));
          total = total.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address));
          expect(withoutDecimals(total)).to.equal(withoutDecimals(xmasAirDropAmount.mul(11).div(12)));
        });

        it("Accounts can claim their airdrop", async () => {
          const ownerBalance = await rudolf.balanceOf(owner.address);
          await rudolf.claimXmasAirdrop();
          expect(await rudolf.balanceOf(owner.address)).to.equal(
            ownerBalance.add(ownerExpectedAirdrop.mul(11).div(12))
          );

          const user1Balance = await rudolf.balanceOf(user1.address);
          await rudolf.connect(user1).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user1.address)).to.equal(
            user1Balance.add(user1ExpectedAirdrop.mul(11).div(12))
          );

          const user2Balance = await rudolf.balanceOf(user2.address);
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user2.address)).to.equal(
            user2Balance.add(user2ExpectedAirdrop.mul(11).div(12))
          );
        });

        it("User can only claim 11/12th of the airdrop yet", async () => {
          const user1Balance = await rudolf.balanceOf(user1.address);
          await rudolf.connect(user1).claimXmasAirdrop();
          await expect(rudolf.connect(user1).claimXmasAirdrop()).to.be.revertedWith("RUDOLF: nothing to claim");
          await expect(rudolf.connect(user1).claimXmasAirdrop()).to.be.revertedWith("RUDOLF: nothing to claim");
          expect(await rudolf.balanceOf(user1.address)).to.equal(
            user1Balance.add(user1ExpectedAirdrop.mul(11).div(12))
          );
        });

        it("Total supply is increased up to 11/12th of total XmasAirdrop emission", async () => {
          await rudolf.claimXmasAirdrop();
          await rudolf.connect(user1).claimXmasAirdrop();
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(withoutDecimals(await rudolf.totalSupply())).to.equal(
            withoutDecimals(supply.add(xmasAirDropAmount.mul(11).div(12)))
          );
        });

        it("Users have 1 more monthly vested airdrop", async () => {
          let vestedAmounts: { releaseTime: BigNumber; amount: BigNumber }[];
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(owner.address);
          expect(vestedAmounts.length).to.equal(1);
          vestedAmounts.forEach((v, i) => {
            expect(v.amount).to.equal(ownerExpectedAirdrop.div(12));
            expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + (i + 11) * monthInSeconds));
          });

          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user1.address);
          expect(vestedAmounts.length).to.equal(1);
          vestedAmounts.forEach((v, i) => {
            expect(v.amount).to.equal(user1ExpectedAirdrop.div(12));
            expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + (i + 11) * monthInSeconds));
          });

          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user2.address);
          expect(vestedAmounts.length).to.equal(1);
          vestedAmounts.forEach((v, i) => {
            expect(v.amount).to.equal(user2ExpectedAirdrop.div(12));
            expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + (i + 11) * monthInSeconds));
          });
        });

        it("Total claimable + total vested is equal to XmasAirdrop emission", async () => {
          let totalVested = BigNumber.from(0);
          let vestedAmounts: { releaseTime: BigNumber; amount: BigNumber }[];
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(owner.address);
          vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user1.address);
          vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user2.address);
          vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));

          let totalClaimable = BigNumber.from(0);
          totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address));
          totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address));
          totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address));

          expect(withoutDecimals(totalClaimable.add(totalVested))).to.equal(withoutDecimals(xmasAirDropAmount));
        });
      });

      context("12 month later, before New Xmas Airdrop", () => {
        beforeEach(async () => {
          await ethers.provider.send("evm_mine", [xmas2021 + monthInSeconds * 12 - 3600]);
          await rudolf.transfer(user3.address, 1);
        });

        it("Accounts have all of their XmasAirdrop directly claimable", async () => {
          const ownerAirdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address);
          expect(ownerAirdrop).to.equal(ownerExpectedAirdrop);

          const user1Airdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address);
          expect(user1Airdrop).to.equal(user1ExpectedAirdrop);

          const user2Airdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address);
          expect(user2Airdrop).to.equal(user2ExpectedAirdrop);
        });

        it("XmasAirdrop total claimable is equal to XmasAirdrop emission", async () => {
          let total = await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address);
          total = total.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address));
          total = total.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address));
          expect(withoutDecimals(total)).to.equal(withoutDecimals(xmasAirDropAmount));
        });

        it("Accounts can claim their entire airdrop", async () => {
          const ownerBalance = await rudolf.balanceOf(owner.address);
          await rudolf.claimXmasAirdrop();
          expect(await rudolf.balanceOf(owner.address)).to.equal(ownerBalance.add(ownerExpectedAirdrop));

          const user1Balance = await rudolf.balanceOf(user1.address);
          await rudolf.connect(user1).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user1.address)).to.equal(user1Balance.add(user1ExpectedAirdrop));

          const user2Balance = await rudolf.balanceOf(user2.address);
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user2.address)).to.equal(user2Balance.add(user2ExpectedAirdrop));
        });

        it("Total supply is increased by total XmasAirdrop emission", async () => {
          await rudolf.claimXmasAirdrop();
          await rudolf.connect(user1).claimXmasAirdrop();
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(withoutDecimals(await rudolf.totalSupply())).to.equal(withoutDecimals(supply.add(xmasAirDropAmount)));
        });

        it("Users have no more monthly vested airdrop", async () => {
          let vestedAmounts: { releaseTime: BigNumber; amount: BigNumber }[];
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(owner.address);
          expect(vestedAmounts.length).to.equal(0);

          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user1.address);
          expect(vestedAmounts.length).to.equal(0);

          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user2.address);
          expect(vestedAmounts.length).to.equal(0);
        });
      });

      context("12 month later, after New Xmas Aidrop", () => {
        let ownerBalanceBefore2ndXmas: BigNumber,
          user1BalanceBefore2ndXmas: BigNumber,
          user2BalanceBefore2ndXmas: BigNumber;

        let ownerExpected2ndAirdrop: BigNumber, user1Expected2ndAirdrop: BigNumber, user2Expected2ndAirdrop: BigNumber;
        beforeEach(async () => {
          //retrieve the amount send to account 3 to reset owner balance
          await rudolf.connect(user3).transfer(owner.address, 1);

          await rudolf.transfer(user1.address, withDecimals(1500000000)); //1.5B
          await rudolf.transfer(user2.address, withDecimals(500000000)); //0.5B

          ownerBalanceBefore2ndXmas = await rudolf.balanceOf(owner.address);
          user1BalanceBefore2ndXmas = await rudolf.balanceOf(user1.address);
          user2BalanceBefore2ndXmas = await rudolf.balanceOf(user2.address);

          ownerExpected2ndAirdrop = xmasAirDropAmount.mul(ownerBalanceBefore2ndXmas).div(supply);
          user1Expected2ndAirdrop = xmasAirDropAmount.mul(user1BalanceBefore2ndXmas).div(supply);
          user2Expected2ndAirdrop = xmasAirDropAmount.mul(user2BalanceBefore2ndXmas).div(supply);

          //trigger next xmas airdrop
          await ethers.provider.send("evm_mine", [xmas2021 + yearInSeconds]);
          await rudolf.transfer(user3.address, 1);
        });

        it("Accounts have 1st Airdrop + 11/12th of 2nd Airdrop directly claimable", async () => {
          const ownerAirdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address);
          expect(ownerAirdrop).to.equal(ownerExpectedAirdrop.add(ownerExpected2ndAirdrop.div(12)));

          const user1Airdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address);
          expect(user1Airdrop).to.equal(user1ExpectedAirdrop.add(user1Expected2ndAirdrop.div(12)));

          const user2Airdrop = await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address);
          expect(user2Airdrop).to.equal(user2ExpectedAirdrop.add(user2Expected2ndAirdrop.div(12)));
        });

        it("XmasAirdrop total claimable is equal to 1 + 11/12th of XmasAirdrop emission", async () => {
          let total = await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address);
          total = total.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address));
          total = total.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address));
          expect(withoutDecimals(total)).to.equal(withoutDecimals(xmasAirDropAmount.mul(13).div(12)));
        });

        it("Accounts can claim their airdrop", async () => {
          const ownerBalance = await rudolf.balanceOf(owner.address);
          await rudolf.claimXmasAirdrop();
          expect(await rudolf.balanceOf(owner.address)).to.equal(
            ownerBalance.add(ownerExpectedAirdrop.add(ownerExpected2ndAirdrop.div(12)))
          );

          const user1Balance = await rudolf.balanceOf(user1.address);
          await rudolf.connect(user1).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user1.address)).to.equal(
            user1Balance.add(user1ExpectedAirdrop.add(user1Expected2ndAirdrop.div(12)))
          );

          const user2Balance = await rudolf.balanceOf(user2.address);
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user2.address)).to.equal(
            user2Balance.add(user2ExpectedAirdrop.add(user2Expected2ndAirdrop.div(12)))
          );
        });

        it("User can claim only once their total claimable airdrop", async () => {
          const user1Balance = await rudolf.balanceOf(user1.address);
          await rudolf.connect(user1).claimXmasAirdrop();
          await expect(rudolf.connect(user1).claimXmasAirdrop()).to.be.revertedWith("RUDOLF: nothing to claim");
          await expect(rudolf.connect(user1).claimXmasAirdrop()).to.be.revertedWith("RUDOLF: nothing to claim");
          expect(await rudolf.balanceOf(user1.address)).to.equal(
            user1Balance.add(user1ExpectedAirdrop.add(user1Expected2ndAirdrop.div(12)))
          );
        });

        it("Total supply is increased up to 1 + 11/12th of total XmasAirdrop emission", async () => {
          await rudolf.claimXmasAirdrop();
          await rudolf.connect(user1).claimXmasAirdrop();
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(withoutDecimals(await rudolf.totalSupply())).to.equal(
            withoutDecimals(supply.add(xmasAirDropAmount.mul(13).div(12)))
          );
        });

        it("Users have 11 more monthly vested airdrop", async () => {
          let vestedAmounts: { releaseTime: BigNumber; amount: BigNumber }[];
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(owner.address);
          expect(vestedAmounts.length).to.equal(11);
          vestedAmounts.forEach((v, i) => {
            expect(v.amount).to.equal(ownerExpected2ndAirdrop.div(12));
            expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + yearInSeconds + (i + 1) * monthInSeconds));
          });

          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user1.address);
          expect(vestedAmounts.length).to.equal(11);
          vestedAmounts.forEach((v, i) => {
            expect(v.amount).to.equal(user1Expected2ndAirdrop.div(12));
            expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + yearInSeconds + (i + 1) * monthInSeconds));
          });

          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user2.address);
          expect(vestedAmounts.length).to.equal(11);
          vestedAmounts.forEach((v, i) => {
            expect(v.amount).to.equal(user2Expected2ndAirdrop.div(12));
            expect(v.releaseTime).to.equal(BigNumber.from(xmas2021 + yearInSeconds + (i + 1) * monthInSeconds));
          });
        });

        it("Total claimable + total vested is equal to 2 XmasAirdrop emission", async () => {
          let totalVested = BigNumber.from(0);
          let vestedAmounts: { releaseTime: BigNumber; amount: BigNumber }[];
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(owner.address);
          vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user1.address);
          vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));
          vestedAmounts = await rudolf.getVestedXmasAirdropAmountForAccount(user2.address);
          vestedAmounts.forEach((v) => (totalVested = totalVested.add(v.amount)));

          let totalClaimable = BigNumber.from(0);
          totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(owner.address));
          totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user1.address));
          totalClaimable = totalClaimable.add(await rudolf.getClaimableXmasAirdropAmountForAccount(user2.address));

          expect(withoutDecimals(totalClaimable.add(totalVested))).to.equal(withoutDecimals(xmasAirDropAmount.mul(2)));
        });
      });
    });
  });
});
