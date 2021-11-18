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
describe("Rudolf", function () {
  before(async function () {
    rudolfFactory = await ethers.getContractFactory("Rudolf");
    [owner, user1, user2, user3] = await ethers.getSigners();
    initialState = await ethers.provider.send("evm_snapshot", []);
  });

  beforeEach(async function () {
    //always revert and recreate an initialState snapshot for next test
    await ethers.provider.send("evm_revert", [initialState]);
    rudolf = await rudolfFactory.deploy();
    await rudolf.deployed();
    initialState = await ethers.provider.send("evm_snapshot", []);
  });

  describe("constructor()", () => {
    it("Initial supply is sent to deployer address", async () => {
      const ownerBalance = await rudolf.balanceOf(owner.address);
      expect(await rudolf.totalSupply()).to.equal(ownerBalance);
    });
  });

  describe("decimals()", () => {
    it("Decimals value is set to 18", async () => {
      expect(await rudolf.decimals()).to.equal(decimals);
    });
  });

  describe("totalSupply()", () => {
    it("Initial supply is set to 4.2B $rudolf", async () => {
      expect(await rudolf.totalSupply()).to.equal(supply);
    });
  });

  describe("getLastXmasAirdropSnapshotId()", () => {
    it("Last XmasSnapshotId is 0", async () => {
      expect(await rudolf.getLastXmasAirdropSnapshotId()).to.equal(0);
    });
  });

  describe("getNumberOfXmasAirdropSnapshot()", () => {
    it("Number of XmasAirdrop is 0", async () => {
      expect(await rudolf.getNumberOfXmasAirdropSnapshot()).to.equal(0);
    });
  });

  describe("getNextXmasYear()", () => {
    it("Next Xmas year is 2021", async () => {
      expect(await rudolf.getNextXmasYear()).to.equal(2021);
    });
  });

  describe("getNextXmasAirdropTime()", () => {
    it("Next XmasAirdrop time is set", async () => {
      expect(await rudolf.getNextXmasAirdropTime()).to.equal(1640390400);
    });
  });

  describe("transfer()", () => {
    it("Balance of accounts are updated", async () => {
      const amount: BigNumber = BigNumber.from(1000);
      await rudolf.transfer(user1.address, amount);
      const ownerBalance = await rudolf.balanceOf(owner.address);
      expect(ownerBalance).to.equal(supply.sub(amount));
      const accountBalance = await rudolf.balanceOf(user1.address);
      expect(accountBalance).to.equal(amount);
    });

    it("An event is emitted", async () => {
      const amount: BigNumber = BigNumber.from(1000);
      await expect(rudolf.transfer(user1.address, amount))
        .to.emit(rudolf, "Transfer")
        .withArgs(owner.address, user1.address, amount);
    });

    it("Revert with error if amount is over account balance", async () => {
      await expect(rudolf.connect(user1).transfer(owner.address, 1)).to.be.revertedWith(
        "ERC20: transfer amount exceeds balance"
      );
    });
  });

  describe("balanceOf()", () => {
    it("Return 0 for empty account", async () => {
      const accountBalance = await rudolf.balanceOf(user1.address);
      expect(accountBalance).to.equal(0);
    });

    it("Return correct amount after multiple transfer", async () => {
      await rudolf.transfer(user1.address, 200);
      await rudolf.transfer(user1.address, 100);
      await rudolf.connect(user1).transfer(user2.address, 10);
      await rudolf.connect(user1).transfer(user2.address, 20);
      expect(await rudolf.balanceOf(user1.address)).to.equal(300 - 30);
      expect(await rudolf.balanceOf(user2.address)).to.equal(30);
    });
  });

  describe("getClaimableXmasAirdropAmoutForAccount()", () => {
    /* beforeEach(async () => {
      await rudolf.transfer(user1.address, 1000000000);
      await rudolf.transfer(user2.address, 1000000000);
    });*/

    it("Nothing is claimable before Xmas", async () => {
      const amount = await rudolf.getClaimableXmasAirdropAmoutForAccount(user1.address);
      expect(amount).to.equal(0);
    });
  });

  describe("claimXmasAirdrop()", () => {
    it("Revert with error when there is nothing to claim", async () => {
      await expect(rudolf.connect(user1).claimXmasAirdrop()).to.be.revertedWith("RUDOLF: nothing to claim");
    });
  });

  describe("XmasAirdrop", () => {
    context("When it's Xmas time", () => {
      beforeEach(async () => {
        await ethers.provider.send("evm_mine", [xmas2021]);
      });

      //it("Block time is updated to Y+1", async () => {
      it("Block time is updated to Xmas time", async () => {
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        expect(block.timestamp).to.be.equal(xmas2021);
      });

      it("Any new transfer trigger the XmasAirdrop event", async () => {
        await expect(rudolf.transfer(user1.address, 1))
          .to.emit(rudolf, "XmasAirdrop")
          .withArgs(2021, xmasAirDropAmount);
      });

      it("Any new transfer trigger the Snapshot events", async () => {
        await expect(rudolf.transfer(user1.address, 1)).to.emit(rudolf, "Snapshot").withArgs(1);
      });

      it("Following transfer does not emit new XmasAirdrop", async () => {
        await rudolf.transfer(user1.address, 1);
        await rudolf.transfer(user1.address, 1);
        await rudolf.transfer(user1.address, 1);
        await rudolf.transfer(user1.address, 1);
        expect(await rudolf.getNumberOfXmasAirdropSnapshot()).to.equal(1);
      });
    });

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

      it("Number of XmasAirdrop and SnapshotId are incremented", async () => {
        expect(await rudolf.getLastXmasAirdropSnapshotId()).to.equal(1);
        expect(await rudolf.getNumberOfXmasAirdropSnapshot()).to.equal(1);
      });

      it("Next XmasAirdrop is moved to next year", async () => {
        expect(await rudolf.getNextXmasYear()).to.equal(2022);
        expect(await rudolf.getNextXmasAirdropTime()).to.equal(xmas2021 + 365 * 24 * 3600);
      });

      it("Accounts have XmasAirdrop claimable amount calculated based on their Xmas balance", async () => {
        const ownerAirdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(owner.address);
        expect(ownerAirdrop).to.equal(ownerExpectedAirdrop);

        const user1Airdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(user1.address);
        expect(user1Airdrop).to.equal(user1ExpectedAirdrop);

        const user2Airdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(user2.address);
        expect(user2Airdrop).to.equal(user2ExpectedAirdrop);
      });

      it("XmasAirdrop total claimable is equal to XmasAirdrop emission", async () => {
        let total = await rudolf.getClaimableXmasAirdropAmoutForAccount(owner.address);
        total = total.add(await rudolf.getClaimableXmasAirdropAmoutForAccount(user1.address));
        total = total.add(await rudolf.getClaimableXmasAirdropAmoutForAccount(user2.address));
        expect(withoutDecimals(total)).to.equal(withoutDecimals(xmasAirDropAmount));
      });

      it("Accounts can claim their airdrop", async () => {
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

      it("Total supply is increase each time an account claim its airdrop", async () => {
        let claimedAmount = await rudolf.getClaimableXmasAirdropAmoutForAccount(owner.address);
        await rudolf.claimXmasAirdrop();
        expect(await rudolf.totalSupply()).to.equal(supply.add(claimedAmount));

        claimedAmount = claimedAmount.add(await rudolf.getClaimableXmasAirdropAmoutForAccount(user1.address));
        await rudolf.connect(user1).claimXmasAirdrop();
        expect(await rudolf.totalSupply()).to.equal(supply.add(claimedAmount));

        claimedAmount = claimedAmount.add(await rudolf.getClaimableXmasAirdropAmoutForAccount(user2.address));
        await rudolf.connect(user2).claimXmasAirdrop();
        expect(await rudolf.totalSupply()).to.equal(supply.add(claimedAmount));
      });

      it("Total supply is increased up to total XmasAirdrop emission", async () => {
        await rudolf.claimXmasAirdrop();
        await rudolf.connect(user1).claimXmasAirdrop();
        await rudolf.connect(user2).claimXmasAirdrop();
        expect(withoutDecimals(await rudolf.totalSupply())).to.equal(withoutDecimals(supply.add(xmasAirDropAmount)));
      });

      context("When 4 more successive XmasAirdrop occurred", () => {
        beforeEach(async () => {
          let nextTime = await rudolf.getNextXmasAirdropTime();
          await rudolf.connect(user3).transfer(owner.address, 1);
          await ethers.provider.send("evm_mine", [nextTime]);
          await rudolf.transfer(user3.address, 1);
          await rudolf.connect(user3).transfer(owner.address, 1);
          nextTime = await rudolf.getNextXmasAirdropTime();
          await ethers.provider.send("evm_mine", [nextTime]);
          await rudolf.transfer(user3.address, 1);
          await rudolf.connect(user3).transfer(owner.address, 1);
          nextTime = await rudolf.getNextXmasAirdropTime();
          await ethers.provider.send("evm_mine", [nextTime]);
          await rudolf.transfer(user3.address, 1);
          await rudolf.connect(user3).transfer(owner.address, 1);
          nextTime = await rudolf.getNextXmasAirdropTime();
          await ethers.provider.send("evm_mine", [nextTime]);
          await rudolf.transfer(user3.address, 1);
          await rudolf.connect(user3).transfer(owner.address, 1);
        });

        it("Number of XmasAirdrop and SnapshotId are incremented", async () => {
          expect(await rudolf.getLastXmasAirdropSnapshotId()).to.equal(5);
          expect(await rudolf.getNumberOfXmasAirdropSnapshot()).to.equal(5);
        });

        it("Next XmasAirdrop has moved to 2026", async () => {
          expect(await rudolf.getNextXmasYear()).to.equal(2026);
          expect(await rudolf.getNextXmasAirdropTime()).to.equal(
            xmas2021 +
              365 * 24 * 3600 + //2022
              365 * 24 * 3600 + //2023
              366 * 24 * 3600 + //2024 is a leap year
              365 * 24 * 3600 + //2025
              365 * 24 * 3600 //2026
          );
        });

        it("Accounts have 5 time XmasAirdrop claimable amount", async () => {
          const ownerAirdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(owner.address);
          expect(ownerAirdrop).to.equal(ownerExpectedAirdrop.mul(5));

          const user1Airdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(user1.address);
          expect(user1Airdrop).to.equal(user1ExpectedAirdrop.mul(5));

          const user2Airdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(user2.address);
          expect(user2Airdrop).to.equal(user2ExpectedAirdrop.mul(5));
        });

        it("XmasAirdrop total claimable is equal to 5 XmasAirdrop emission", async () => {
          let total = await rudolf.getClaimableXmasAirdropAmoutForAccount(user1.address);
          total = total.add(await rudolf.getClaimableXmasAirdropAmoutForAccount(user2.address));
          total = total.add(await rudolf.getClaimableXmasAirdropAmoutForAccount(owner.address));
          expect(withoutDecimals(total)).to.equal(withoutDecimals(xmasAirDropAmount.mul(5)));
        });

        it("Accounts can claim their airdrop", async () => {
          const ownerBalance = await rudolf.balanceOf(owner.address);
          await rudolf.claimXmasAirdrop();
          expect(await rudolf.balanceOf(owner.address)).to.equal(ownerBalance.add(ownerExpectedAirdrop.mul(5)));

          const user1Balance = await rudolf.balanceOf(user1.address);
          await rudolf.connect(user1).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user1.address)).to.equal(user1Balance.add(user1ExpectedAirdrop.mul(5)));

          const user2Balance = await rudolf.balanceOf(user2.address);
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user2.address)).to.equal(user2Balance.add(user2ExpectedAirdrop.mul(5)));
        });

        it("Total supply is increase each time an account claim its airdrop", async () => {
          let claimedAmount: BigNumber = BigNumber.from(0);
          claimedAmount = claimedAmount.add(await rudolf.getClaimableXmasAirdropAmoutForAccount(owner.address));
          await rudolf.claimXmasAirdrop();
          expect(await rudolf.totalSupply()).to.equal(supply.add(claimedAmount));

          claimedAmount = claimedAmount.add(await rudolf.getClaimableXmasAirdropAmoutForAccount(user1.address));
          await rudolf.connect(user1).claimXmasAirdrop();
          expect(await rudolf.totalSupply()).to.equal(supply.add(claimedAmount));

          claimedAmount = claimedAmount.add(await rudolf.getClaimableXmasAirdropAmoutForAccount(user2.address));
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(await rudolf.totalSupply()).to.equal(supply.add(claimedAmount));
        });

        it("Total supply is increased up to total 5 XmasAirdrop emission", async () => {
          await rudolf.claimXmasAirdrop();
          await rudolf.connect(user1).claimXmasAirdrop();
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(withoutDecimals(await rudolf.totalSupply())).to.equal(
            withoutDecimals(supply.add(xmasAirDropAmount.mul(5)))
          );
        });
      });

      context("When balances change before another XmasAirdrop", () => {
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

          const nextTime = await rudolf.getNextXmasAirdropTime();
          await ethers.provider.send("evm_mine", [nextTime]);
          await rudolf.transfer(user3.address, 1);
        });

        it("Claimable XmasAirdrop amount are calculated based on each Xmas balances", async () => {
          const user1Airdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(user1.address);
          expect(user1Airdrop).to.equal(user1ExpectedAirdrop.add(user1Expected2ndAirdrop));

          const user2Airdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(user2.address);
          expect(user2Airdrop).to.equal(user2ExpectedAirdrop.add(user2Expected2ndAirdrop));

          const ownerAirdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(owner.address);
          expect(ownerAirdrop).to.equal(ownerExpectedAirdrop.add(ownerExpected2ndAirdrop));
        });

        it("XmasAirdrop total claimable is equal to 2 XmasAirdrop emission", async () => {
          const user1Airdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(user1.address);
          const user2Airdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(user2.address);
          const ownerAirdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(owner.address);
          expect(withoutDecimals(user1Airdrop.add(user2Airdrop).add(ownerAirdrop))).to.equal(
            withoutDecimals(xmasAirDropAmount.mul(2))
          );
        });

        it("Accounts can claim their airdrop", async () => {
          const ownerBalance = await rudolf.balanceOf(owner.address);
          await rudolf.claimXmasAirdrop();
          expect(await rudolf.balanceOf(owner.address)).to.equal(
            ownerBalance.add(ownerExpectedAirdrop).add(ownerExpected2ndAirdrop)
          );

          const user1Balance = await rudolf.balanceOf(user1.address);
          await rudolf.connect(user1).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user1.address)).to.equal(
            user1Balance.add(user1ExpectedAirdrop).add(user1Expected2ndAirdrop)
          );

          const user2Balance = await rudolf.balanceOf(user2.address);
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user2.address)).to.equal(
            user2Balance.add(user2ExpectedAirdrop).add(user2Expected2ndAirdrop)
          );
        });

        it("Total supply is increased up to total 2 XmasAirdrop emission", async () => {
          await rudolf.claimXmasAirdrop();
          await rudolf.connect(user1).claimXmasAirdrop();
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(withoutDecimals(await rudolf.totalSupply())).to.equal(
            withoutDecimals(supply.add(xmasAirDropAmount.mul(2)))
          );
        });
      });

      context("When some users claim airdrop before another XmasAirdrop", () => {
        let ownerBalanceBefore2ndXmas: BigNumber,
          user1BalanceBefore2ndXmas: BigNumber,
          user2BalanceBefore2ndXmas: BigNumber;

        let ownerExpected2ndAirdrop: BigNumber, user1Expected2ndAirdrop: BigNumber, user2Expected2ndAirdrop: BigNumber;
        beforeEach(async () => {
          //retrieve the amount send to account 3 to reset owner balance
          await rudolf.connect(user3).transfer(owner.address, 1);

          await rudolf.claimXmasAirdrop();
          await rudolf.connect(user1).claimXmasAirdrop();

          ownerBalanceBefore2ndXmas = await rudolf.balanceOf(owner.address);
          user1BalanceBefore2ndXmas = await rudolf.balanceOf(user1.address);
          user2BalanceBefore2ndXmas = await rudolf.balanceOf(user2.address);

          const newSupply = await rudolf.totalSupply();
          ownerExpected2ndAirdrop = xmasAirDropAmount.mul(ownerBalanceBefore2ndXmas).div(newSupply);
          user1Expected2ndAirdrop = xmasAirDropAmount.mul(user1BalanceBefore2ndXmas).div(newSupply);
          user2Expected2ndAirdrop = xmasAirDropAmount.mul(user2BalanceBefore2ndXmas).div(newSupply);

          const nextTime = await rudolf.getNextXmasAirdropTime();
          await ethers.provider.send("evm_mine", [nextTime]);
          await rudolf.transfer(user3.address, 1);
        });

        it("Claimable XmasAirdrop amount are calculated based on each Xmas balances", async () => {
          const ownerAirdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(owner.address);
          expect(ownerAirdrop).to.equal(ownerExpected2ndAirdrop);

          const user1Airdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(user1.address);
          expect(user1Airdrop).to.equal(user1Expected2ndAirdrop);

          const user2Airdrop = await rudolf.getClaimableXmasAirdropAmoutForAccount(user2.address);
          expect(user2Airdrop).to.equal(user2ExpectedAirdrop.add(user2Expected2ndAirdrop));
        });

        it("Accounts can claim their 2nd airdrop", async () => {
          const ownerBalance = await rudolf.balanceOf(owner.address);
          await rudolf.claimXmasAirdrop();
          expect(await rudolf.balanceOf(owner.address)).to.equal(ownerBalance.add(ownerExpected2ndAirdrop));

          const user1Balance = await rudolf.balanceOf(user1.address);
          await rudolf.connect(user1).claimXmasAirdrop();
          expect(await rudolf.balanceOf(user1.address)).to.equal(user1Balance.add(user1Expected2ndAirdrop));
        });

        it("Total supply is increased up to total 2 XmasAirdrop emission", async () => {
          await rudolf.claimXmasAirdrop();
          await rudolf.connect(user1).claimXmasAirdrop();
          await rudolf.connect(user2).claimXmasAirdrop();
          expect(withoutDecimals(await rudolf.totalSupply())).to.equal(
            withoutDecimals(supply.add(xmasAirDropAmount.mul(2)))
          );
        });
      });
    });
  });
});
