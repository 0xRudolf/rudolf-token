// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

//import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";

contract Rudolf is Ownable, ERC20, ERC20Snapshot, ERC20Pausable {
  uint256 private constant INITIAL_SUPPLY = 4.2 * 10**9;
  uint256 private constant XMAS_AIRDROP_EMMISSION = 1.2 * 10**9;
  uint32 private constant AVG_MONTH_IN_SECONDS = 2628000;
  uint32 private constant YEAR_IN_SECONDS = 31536000;
  uint32 private constant LEAP_YEAR_IN_SECONDS = 31622400;
  uint16 private _nextXmasYear = 2021;
  uint32 private _nextXmasTimestamp = 1640390400;
  uint32 private _lastXmasTimestamp = 0;
  uint8[] private _xmasSnapshotsIds;
  mapping(address => uint256) private _claimedXmasAirdrop;

  struct VestedAirdrop {
    uint256 releaseTime;
    uint256 amount;
  }

  event XmasAirdrop(uint16 year, uint256 emission);

  constructor() ERC20("Rudolf", "RUDOLF") {
    _mint(msg.sender, INITIAL_SUPPLY * 10**decimals());
  }

  function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override(ERC20, ERC20Snapshot, ERC20Pausable) {
    _checkXmasAirdrop();
    super._beforeTokenTransfer(from, to, amount);
  }

  function _checkXmasAirdrop() private {
    if (_isXmasAirdropTime()) {
      _generateXmasSnapshot();
    }
  }

  function _isXmasAirdropTime() private view returns (bool) {
    return block.timestamp > _nextXmasTimestamp;
  }

  function _generateXmasSnapshot() private {
    uint8 snapshotId = uint8(_snapshot());
    _xmasSnapshotsIds.push(snapshotId);
    emit XmasAirdrop(_nextXmasYear, XMAS_AIRDROP_EMMISSION * 10**decimals());
    _nextXmasYear = _nextXmasYear + 1;
    _lastXmasTimestamp = _nextXmasTimestamp;
    if (_isLeapYear(_nextXmasYear)) {
      _nextXmasTimestamp = _nextXmasTimestamp + LEAP_YEAR_IN_SECONDS;
    } else {
      _nextXmasTimestamp = _nextXmasTimestamp + YEAR_IN_SECONDS;
    }
  }

  function getLastXmasAirdropSnapshotId() public view returns (uint8) {
    return uint8(_getCurrentSnapshotId());
  }

  function getNumberOfXmasAirdropSnapshot() public view returns (uint8) {
    return uint8(_xmasSnapshotsIds.length);
  }

  function getNextXmasYear() public view returns (uint16) {
    return _nextXmasYear;
  }

  function getNextXmasAirdropTime() public view returns (uint32) {
    return _nextXmasTimestamp;
  }

  function _isLeapYear(uint16 year) private pure returns (bool) {
    if (year % 4 != 0) {
      return false;
    }
    if (year % 100 != 0) {
      return true;
    }
    if (year % 400 != 0) {
      return false;
    }
    return true;
  }

  function getClaimableXmasAirdropAmountForAccount(address account) public view returns (uint256) {
    uint256 claimableAmount = 0;
    uint256 nbSnapshots = _xmasSnapshotsIds.length;
    for (uint256 i = 0; i < nbSnapshots; i++) {
      uint8 snapshotId = _xmasSnapshotsIds[i];
      uint256 balance = balanceOfAt(account, snapshotId);
      if (balance > 0) {
        uint256 supply = totalSupplyAt(snapshotId);
        //XMAS_AIRDROP_EMMISSION is divided between all accounts proportionally to their snapshot holding
        uint256 yearAmount = (balance * XMAS_AIRDROP_EMMISSION * 10**decimals()) / supply;
        if (i == nbSnapshots - 1) {
          //Current year XmasAirdrop are released lienarly over 12 month
          uint256 elapsedTime = Math.min(block.timestamp, (_nextXmasTimestamp - 1)) - _lastXmasTimestamp;
          uint256 elapsedMonths = elapsedTime / AVG_MONTH_IN_SECONDS;
          yearAmount = (yearAmount * (elapsedMonths + 1)) / 12;
        }
        claimableAmount += yearAmount;
      }
    }
    return claimableAmount - _claimedXmasAirdrop[account];
  }

  function getVestedXmasAirdropAmountForAccount(address account) public view returns (VestedAirdrop[] memory) {
    VestedAirdrop[] memory vestedAirdrops;
    uint8 snapshotId = getLastXmasAirdropSnapshotId();
    if (snapshotId > 0) {
      uint256 balance = balanceOfAt(account, snapshotId);
      if (balance > 0) {
        uint256 supply = totalSupplyAt(snapshotId);
        uint256 yearAmount = (balance * XMAS_AIRDROP_EMMISSION * 10**decimals()) / supply;
        uint256 monthAmount = yearAmount / 12;
        uint256 elapsedTime = Math.min(block.timestamp, (_nextXmasTimestamp - 1)) - _lastXmasTimestamp;
        uint256 elapsedMonths = (elapsedTime / AVG_MONTH_IN_SECONDS) + 1;
        uint256 remainingMonths = 12 - elapsedMonths;
        vestedAirdrops = new VestedAirdrop[](remainingMonths);
        for (uint256 i = 0; i < remainingMonths; i++) {
          uint256 releaseTime = _lastXmasTimestamp + ((i + elapsedMonths) * AVG_MONTH_IN_SECONDS);
          vestedAirdrops[i] = VestedAirdrop(releaseTime, monthAmount);
        }
      }
    }

    return vestedAirdrops;
  }

  function claimXmasAirdrop() public whenNotPaused {
    _checkXmasAirdrop();
    uint256 amount = getClaimableXmasAirdropAmountForAccount(msg.sender);
    require(amount != 0, "RUDOLF: nothing to claim");
    _claimedXmasAirdrop[msg.sender] = amount;
    _mint(msg.sender, amount);
  }
}
