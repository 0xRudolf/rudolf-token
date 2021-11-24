import fs from "fs";
import { ethers } from "hardhat";

const accountMainnetPath = "./secrets/accounts.mainnet.json";
if (!fs.existsSync(accountMainnetPath)) {
  const account = ethers.Wallet.createRandom();
  const { phrase, path } = account._mnemonic();
  fs.writeFileSync(accountMainnetPath, JSON.stringify({ mnemonic: phrase, path }));
  console.log("New Mainnet account:", account.address);
}

const accountTestnetPath = "./secrets/accounts.testnet.json";
if (!fs.existsSync(accountTestnetPath)) {
  const account = ethers.Wallet.createRandom();
  const { phrase, path } = account._mnemonic();
  fs.writeFileSync(accountTestnetPath, JSON.stringify({ mnemonic: phrase, path }));
  console.log("New Testnet account:", account.address);
}
