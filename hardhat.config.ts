import fs from "fs";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import { HardhatUserConfig } from "hardhat/config";

let accountTestnet;
const accountTestnetPath = "./secrets/accounts.testnet.json";
if (fs.existsSync(accountTestnetPath)) accountTestnet = require(accountTestnetPath);

let accountMainnet;
const accountMainnetPath = "./secrets/accounts.mainnet.json";
if (fs.existsSync(accountMainnetPath)) accountMainnet = require(accountMainnetPath);

let etherscan;
const etherscanScanPath = "./secrets/etherscan.json";
if (fs.existsSync(etherscanScanPath)) etherscan = require(etherscanScanPath);

const config: HardhatUserConfig = {
  networks: {
    bsc_testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      ...(accountTestnet ? { accounts: accountTestnet } : {})
    },
    bsc_mainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 20000000000,
      ...(accountMainnet ? { accounts: accountMainnet } : {})
    },
    hardhat: {
      initialDate: "2021-01-01"
    }
  },
  ...(etherscan ? { etherscan } : {}),
  solidity: "0.8.4"
};

export default config;
