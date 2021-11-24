import { ethers } from "hardhat";

async function main() {
  const Rudolf = await ethers.getContractFactory("Rudolf");
  console.log("Deployer address:", (await ethers.getSigners())[0].address);
  console.log("Deploying Rudolf...");
  const rudolf = await Rudolf.deploy();
  await rudolf.deployed();
  console.log("Rudolf deployed to:", rudolf.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
