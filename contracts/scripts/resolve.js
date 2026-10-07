// Arbiter tool: settle a disputed deal.
//   DEAL=4 TO_BUYER=25.5 npx hardhat run scripts/resolve.js --network botchainMainnet
// Run it with the arbiter's key in PRIVATE_KEY. TO_BUYER is in USDT; the rest goes to the seller.
const hre = require("hardhat");
const deployments = require("../deployments.json");

async function main() {
  const { ethers, network } = hre;
  const id = BigInt(process.env.DEAL || 0);
  if (!id) throw new Error("Set DEAL=<id>");
  const escrow = await ethers.getContractAt("EscrowAgent", deployments[network.name].address);
  const d = await escrow.getDeal(id);
  const toBuyer = ethers.parseUnits(process.env.TO_BUYER ?? "0", 6);
  console.log(`Deal #${id}: ${ethers.formatUnits(d.amount, 6)} USDT, status ${d.status}`);
  console.log(`Buyer ${d.buyer} gets ${ethers.formatUnits(toBuyer, 6)}`);
  console.log(`Terms: ${d.terms}`);
  const tx = await escrow.resolveDispute(id, toBuyer);
  await tx.wait();
  console.log(`Resolved in ${tx.hash}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
