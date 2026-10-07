// Deploys EscrowAgent and writes its address + ABI into the web app.
//   npx hardhat run scripts/deploy.js --network botchain         (testnet, 968)
//   npx hardhat run scripts/deploy.js --network botchainMainnet  (mainnet, 677)
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const OFFICIAL_USDT = {
  968: "0x75edC9335175Fc0552D51D48439F229c10420fe3",
  677: "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C",
};

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  let usdt = process.env.USDT_ADDRESS || OFFICIAL_USDT[chainId];
  if (chainId === 677) usdt = OFFICIAL_USDT[677]; // never point mainnet at a test token
  if (!usdt) {
    console.log("No USDT for this network, deploying MockUSDT");
    const mock = await (await ethers.getContractFactory("MockUSDT")).deploy();
    await mock.waitForDeployment();
    usdt = await mock.getAddress();
  }

  const owner = process.env.OWNER || deployer.address;
  const treasury = process.env.TREASURY || owner;
  const arbiter = process.env.ARBITER || owner;
  const feeBps = Number(process.env.FEE_BPS ?? 50);

  console.log(`Network   ${network.name} (${chainId})`);
  console.log(`Deployer  ${deployer.address}`);
  console.log(`Owner     ${owner}`);
  console.log(`Arbiter   ${arbiter}${arbiter === owner ? "  (same as owner, that wallet can't trade)" : ""}`);
  console.log(`Treasury  ${treasury}`);
  console.log(`USDT      ${usdt}`);
  console.log(`Fee       ${feeBps} bps`);

  const Escrow = await ethers.getContractFactory("EscrowAgent");
  const escrow = await Escrow.deploy(usdt, arbiter, treasury, feeBps, owner);
  await escrow.waitForDeployment();
  const address = await escrow.getAddress();
  const receipt = await escrow.deploymentTransaction().wait();
  console.log(`\nEscrowAgent deployed at ${address} (block ${receipt.blockNumber})`);

  const { abi } = await hre.artifacts.readArtifact("EscrowAgent");
  const out = path.join(__dirname, "../../web/src/lib/contract.ts");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    `// Written by contracts/scripts/deploy.js. Do not edit by hand.\n` +
      `export const CHAIN_ID: number = ${chainId};\n` +
      `export const ESCROW_ADDRESS: \`0x\${string}\` = "${address}";\n` +
      `export const USDT_ADDRESS: \`0x\${string}\` = "${usdt}";\n` +
      `export const DEPLOY_BLOCK: bigint = ${receipt.blockNumber}n;\n\n` +
      `export const escrowAbi = ${JSON.stringify(abi, null, 2)} as const;\n`
  );
  console.log(`Wrote ${path.relative(process.cwd(), out)}`);

  const deployments = path.join(__dirname, "../deployments.json");
  const all = fs.existsSync(deployments) ? JSON.parse(fs.readFileSync(deployments, "utf8")) : {};
  all[network.name] = { chainId, address, usdt, arbiter, treasury, owner, feeBps, block: receipt.blockNumber };
  fs.writeFileSync(deployments, JSON.stringify(all, null, 2) + "\n");

  console.log(`\nVerify with:\nnpx hardhat verify --network ${network.name} ${address} ${usdt} ${arbiter} ${treasury} ${feeBps} ${owner}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
