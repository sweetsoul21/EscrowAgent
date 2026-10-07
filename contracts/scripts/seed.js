// Testnet demo data: a handful of deals in different stages so every screen has something to show.
//   npx hardhat run scripts/seed.js --network botchain
// The deployer plays the buyer. Two throwaway seller wallets get a pinch of tBOT for gas.
const hre = require("hardhat");
const deployments = require("../deployments.json");

const DEALS = [
  { amount: "12", terms: "Used PS5 controller, white. Pickup at Yaba, Lagos", stage: "released" },
  { amount: "35", terms: "Logo + brand kit for a small bakery, 3 revisions", stage: "delivered" },
  { amount: "8.5", terms: "2 months of Spotify family slot", stage: "accepted" },
  { amount: "60", terms: "iPhone 11 screen replacement (original part)", stage: "funded" },
];

async function main() {
  const { ethers, network } = hre;
  if (network.config.chainId !== 968) throw new Error("Seed runs on testnet only");
  const [buyer] = await ethers.getSigners();
  const { address, usdt } = deployments[network.name];
  const escrow = await ethers.getContractAt("EscrowAgent", address);
  const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", usdt);

  const total = DEALS.reduce((s, d) => s + ethers.parseUnits(d.amount, 6), 0n);
  const bal = await token.balanceOf(buyer.address);
  if (bal < total) throw new Error(`Buyer has ${ethers.formatUnits(bal, 6)} USDT, needs ${ethers.formatUnits(total, 6)}`);
  await (await token.approve(address, total)).wait();

  const sellers = [ethers.Wallet.createRandom(), ethers.Wallet.createRandom()].map((w) => w.connect(ethers.provider));
  for (const s of sellers) {
    await (await buyer.sendTransaction({ to: s.address, value: ethers.parseEther("0.01") })).wait();
  }

  const now = (await ethers.provider.getBlock("latest")).timestamp;
  for (const [i, deal] of DEALS.entries()) {
    const seller = sellers[i % sellers.length];
    const tx = await escrow.createDeal(seller.address, ethers.parseUnits(deal.amount, 6), now + 3 * 86400, deal.terms);
    const rc = await tx.wait();
    const id = escrow.interface.parseLog(rc.logs.find((l) => l.address.toLowerCase() === address.toLowerCase())).args.id;
    const asSeller = escrow.connect(seller);
    if (deal.stage !== "funded") await (await asSeller.acceptDeal(id)).wait();
    if (deal.stage === "delivered" || deal.stage === "released") await (await asSeller.markDelivered(id)).wait();
    if (deal.stage === "released") await (await escrow.confirmReceipt(id)).wait();
    console.log(`#${id} ${deal.stage.padEnd(9)} ${deal.amount} USDT  ${deal.terms}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
