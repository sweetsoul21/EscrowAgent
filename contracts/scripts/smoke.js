// End-to-end check against a live deployment (testnet only). Runs the main deal paths with real
// transactions and checks every balance change.
//   npx hardhat run scripts/smoke.js --network botchain
// The deployer plays the buyer, a fresh wallet plays the seller, TESTNET_ARBITER_KEY settles the dispute.
const hre = require("hardhat");
const deployments = require("../deployments.json");

const fmt = (v) => hre.ethers.formatUnits(v, 6);

async function main() {
  const { ethers, network } = hre;
  if (network.config.chainId !== 968) throw new Error("Smoke test runs on testnet only");
  if (!process.env.TESTNET_ARBITER_KEY) throw new Error("Set TESTNET_ARBITER_KEY");

  const [buyer] = await ethers.getSigners();
  const { address, usdt, treasury } = deployments[network.name];
  const escrow = await ethers.getContractAt("EscrowAgent", address);
  const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", usdt);
  const seller = ethers.Wallet.createRandom().connect(ethers.provider);
  const arbiter = new ethers.Wallet(process.env.TESTNET_ARBITER_KEY, ethers.provider);

  for (const w of [seller, arbiter]) {
    if ((await ethers.provider.getBalance(w.address)) < ethers.parseEther("0.005")) {
      await (await buyer.sendTransaction({ to: w.address, value: ethers.parseEther("0.01") })).wait();
    }
  }
  await (await token.approve(address, ethers.parseUnits("10", 6))).wait();

  const bal = (a) => token.balanceOf(a);
  const check = (label, ok) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) process.exitCode = 1;
  };
  async function open(amount, terms) {
    const acceptBy = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    const rc = await (await escrow.createDeal(seller.address, ethers.parseUnits(amount, 6), acceptBy, terms)).wait();
    const log = rc.logs.map((l) => { try { return escrow.interface.parseLog(l); } catch { return null; } }).find((l) => l?.name === "DealCreated");
    return log.args.id;
  }
  const asSeller = escrow.connect(seller);

  // 1. Happy path: lock → accept → deliver → confirm
  let id = await open("2", "Smoke test: happy path");
  const s0 = await bal(seller.address);
  const t0 = await bal(treasury);
  await (await asSeller.acceptDeal(id)).wait();
  await (await asSeller.markDelivered(id)).wait();
  await (await escrow.confirmReceipt(id)).wait();
  const fee = ethers.parseUnits("0.01", 6); // 0.5% of 2
  check(`#${id} seller paid ${fmt((await bal(seller.address)) - s0)} USDT`, (await bal(seller.address)) - s0 === ethers.parseUnits("2", 6) - fee);
  check(`#${id} treasury got ${fmt((await bal(treasury)) - t0)} USDT fee`, (await bal(treasury)) - t0 === fee);
  check(`#${id} status Released`, Number((await escrow.getDeal(id)).status) === 5);

  // 2. Seller declines → buyer refunded in full
  id = await open("1", "Smoke test: decline");
  let b0 = await bal(buyer.address);
  await (await asSeller.declineDeal(id)).wait();
  check(`#${id} declined, buyer refunded ${fmt((await bal(buyer.address)) - b0)} USDT`, (await bal(buyer.address)) - b0 === ethers.parseUnits("1", 6));

  // 3. Dispute → arbiter splits 0.4 to buyer, 0.6 to seller (fee on seller share)
  id = await open("1", "Smoke test: dispute");
  await (await asSeller.acceptDeal(id)).wait();
  await (await escrow.raiseDispute(id)).wait();
  b0 = await bal(buyer.address);
  const s1 = await bal(seller.address);
  await (await escrow.connect(arbiter).resolveDispute(id, ethers.parseUnits("0.4", 6))).wait();
  check(`#${id} arbiter split: buyer +${fmt((await bal(buyer.address)) - b0)}`, (await bal(buyer.address)) - b0 === ethers.parseUnits("0.4", 6));
  check(`#${id} arbiter split: seller +${fmt((await bal(seller.address)) - s1)}`, (await bal(seller.address)) - s1 === ethers.parseUnits("0.597", 6));

  // 4. Mutual cancel after acceptance
  id = await open("1", "Smoke test: mutual cancel");
  await (await asSeller.acceptDeal(id)).wait();
  b0 = await bal(buyer.address);
  await (await escrow.requestCancel(id)).wait();
  await (await asSeller.requestCancel(id)).wait();
  check(`#${id} mutual cancel refunded ${fmt((await bal(buyer.address)) - b0)} USDT`, (await bal(buyer.address)) - b0 === ethers.parseUnits("1", 6));

  check(`contract holds ${fmt(await bal(address))} USDT afterwards (expected 0)`, (await bal(address)) === 0n);
  console.log(`\nSeller wallet used: ${seller.address}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
