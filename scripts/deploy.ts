import { run, ethers } from "hardhat";

async function main() {
  await run("compile");
  const Rudolf = await ethers.getContractFactory("Rudolf");
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
