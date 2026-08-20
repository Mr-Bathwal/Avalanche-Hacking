const { ethers, network } = require("hardhat");

// Deploys the TicketVerse core contracts and prints the addresses to paste into
// the frontend (src/lib/contracts.js).
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  // 1. UserVerifier
  const UserVerifier = await ethers.getContractFactory("UserVerifier");
  const verifier = await UserVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();

  // 2. EventFactory (creation fee = 0 for testnet; wired to the verifier)
  const creationFee = ethers.parseEther("0");
  const EventFactory = await ethers.getContractFactory("EventFactory");
  const factory = await EventFactory.deploy(creationFee, verifierAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();

  // 3. TicketMarketplace
  const TicketMarketplace = await ethers.getContractFactory("TicketMarketplace");
  const marketplace = await TicketMarketplace.deploy();
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();

  console.log("\nDeployed:");
  console.log(`  USER_VERIFIER:      ${verifierAddr}`);
  console.log(`  EVENT_FACTORY:      ${factoryAddr}`);
  console.log(`  TICKET_MARKETPLACE: ${marketplaceAddr}`);

  console.log("\nPaste into src/lib/contracts.js:");
  console.log(
    JSON.stringify(
      {
        USER_VERIFIER: verifierAddr,
        EVENT_FACTORY: factoryAddr,
        TICKET_MARKETPLACE: marketplaceAddr,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
