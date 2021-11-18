// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";

contract Rudolf is ERC20, ERC20Snapshot {
  uint256 private constant INITIAL_SUPPLY = 4.2 * 10**9;
  uint256 private constant XMAS_AIRDROP_EMMISSION = 1.2 * 10**9;
  uint32 private constant YEAR_IN_SECONDS = 31536000;
  uint32 private constant LEAP_YEAR_IN_SECONDS = 31622400;
  uint16 private _nextXmasYear = 2021;
  uint32 private _nextXmasTimestamp = 1640390400;
  uint8[] private _xmasSnapshotsIds;
  mapping(address => uint256) private _claimedXmasAirdrop;

  event XmasAirdrop(uint16 year, uint256 emission);

  constructor() ERC20("Rudolf", "RUDOLF") {
    _mint(msg.sender, INITIAL_SUPPLY * 10**decimals());
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override(ERC20, ERC20Snapshot) {
    if (_isXmasAirdropTime()) {
      _generateXmasSnapshot();
    }
    super._beforeTokenTransfer(from, to, amount);
  }

  function _isXmasAirdropTime() private view returns (bool) {
    return block.timestamp > _nextXmasTimestamp;
  }

  function _generateXmasSnapshot() private {
    uint8 snapshotId = uint8(_snapshot());
    _xmasSnapshotsIds.push(snapshotId);
    emit XmasAirdrop(_nextXmasYear, XMAS_AIRDROP_EMMISSION * 10**decimals());
    _nextXmasYear = _nextXmasYear + 1;
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

  function getClaimableXmasAirdropAmoutForAccount(address account) public view returns (uint256) {
    uint256 claimableAmount = 0;
    uint256 nbSnapshots = _xmasSnapshotsIds.length;
    for (uint256 i = 0; i < nbSnapshots; i++) {
      uint8 snapshotId = _xmasSnapshotsIds[i];
      uint256 balance = balanceOfAt(account, snapshotId);
      if (balance > 0) {
        uint256 supply = totalSupplyAt(snapshotId);
        //XMAS_AIRDROP_EMMISSION is divided between all accounts proportionally to their snapshot holding
        claimableAmount += (balance * XMAS_AIRDROP_EMMISSION * 10**decimals()) / supply;
      }

      //TODO if last snapshot id, calculate current year progress to determine current claimable amount
    }
    return claimableAmount - _claimedXmasAirdrop[account];
  }

  //TODO add getVestedeXmasAirdropAmoutForAccount(address account)
  //implement 12 month linear vesting for xmas airdrop
  //return array struct (timestamp, amount)

  function claimXmasAirdrop() public {
    uint256 amount = getClaimableXmasAirdropAmoutForAccount(msg.sender);
    require(amount != 0, "RUDOLF: nothing to claim");
    _claimedXmasAirdrop[msg.sender] = amount;
    //TODO add 12 month linear vesting
    _mint(msg.sender, amount);
  }
}
