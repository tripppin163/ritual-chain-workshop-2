/**
 * Sets up a local chain the frontend can actually talk to.
 *
 *   npx hardhat node                                 # terminal 1
 *   npx hardhat run scripts/local-serve.ts           # terminal 2, once
 *   SEED=0 npx hardhat run scripts/local-serve.ts    # ...or with an empty board
 *   npx hardhat run scripts/local-executor.ts        # terminal 2, keep running
 *   cd ../web && npm run dev                         # terminal 3
 *
 * Installs the Ritual system contracts at their canonical addresses, deploys
 * RitualPredict, prepays its execution fees, opens one demo market, switches the node
 * to one block per second so countdowns move on their own, and writes web/.env.local.
 */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { COMPARATOR, installRitualMocks } from "./local-stack.ts";

const BLOCK_TIME_MS = 1_000n; // matches the interval mining set below
const ORACLE_URL = process.env.ORACLE_URL ?? "http://127.0.0.1:3000/api/oracle/eth";

/** Long enough to click around in. Overridable for a shorter or longer demo. */
const BETTING_SECONDS = BigInt(process.env.BETTING_SECONDS ?? 1_800);
const RESOLVE_DELAY_SECONDS = BigInt(process.env.RESOLVE_DELAY_SECONDS ?? 60);

const connection = await network.create({
  network: process.env.LOCAL_NETWORK ?? "localhost",
  chainType: "l1",
});
const { viem, provider } = connection;
const publicClient = await viem.getPublicClient();
const [, alice, bob] = await viem.getWalletClients();

await installRitualMocks(connection);
const predict = await viem.deployContract("RitualPredict", [BLOCK_TIME_MS]);
await predict.write.fundExecution([500_000n], { value: parseEther("1") });

/*
 * Every run deploys a fresh contract, so the board starts empty and the previous run's
 * markets are simply no longer the ones being read. That is the same move that clears a
 * board on a real chain: nothing on-chain is ever deleted, a new instance is deployed
 * and the frontend is pointed at it. SEED=0 skips the demo markets entirely.
 */
const seed = process.env.SEED !== "0";

if (seed) {
await predict.write.createMarket([
  {
    question: "Will ETH/USD be at least $4,000 when this market resolves?",
    oracleUrl: ORACLE_URL,
    jsonPath: ".price",
    target: 4_000n,
    comparator: COMPARATOR.gte,
    bettingSeconds: BETTING_SECONDS,
    resolveDelaySeconds: RESOLVE_DELAY_SECONDS,
    viewers: [],
  },
]);

// A second, deliberately short market, so the self-resolving part can be watched
// happening rather than waited out. Skip with DEMO_SHORT_MARKET=0.
if (process.env.DEMO_SHORT_MARKET !== "0") {
  await predict.write.createMarket([
    {
      question: "Will ETH/USD be under $10,000 in a couple of minutes?",
      oracleUrl: ORACLE_URL,
      jsonPath: ".price",
      target: 10_000n,
      comparator: COMPARATOR.lt,
      bettingSeconds: 60n,
      resolveDelaySeconds: 30n,
      viewers: [],
    },
  ]);
}

// A couple of stakes, so the UI opens on a market with a real pool rather than an
// empty one. Skip with DEMO_BETS=0.
if (process.env.DEMO_BETS !== "0" && alice && bob) {
  const count = await predict.read.marketCount();
  for (let id = 1n; id <= count; id++) {
    await predict.write.bet([id, true], { account: alice.account, value: parseEther("2") });
    await predict.write.bet([id, false], { account: bob.account, value: parseEther("3") });
  }
}

}

// One block per second, so blockTimeMs above is the truth and the UI's countdowns are
// real rather than frozen until the next transaction.
await provider.request({ method: "evm_setIntervalMining", params: [1_000] });

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/.env.local");
await writeFile(
  envPath,
  [
    "# Written by hardhat/scripts/local-serve.ts",
    `NEXT_PUBLIC_PREDICT_ADDRESS=${predict.address}`,
    "NEXT_PUBLIC_CHAIN_ID=31337",
    "NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545",
    `NEXT_PUBLIC_DEMO_ORACLE_URL=${ORACLE_URL}`,
    "",
  ].join("\n"),
  "utf8",
);

console.log(`RitualPredict      ${predict.address}`);
console.log(`prepaid fees       ${formatEther(await predict.read.executionBalance())} RITUAL`);
for (const market of await predict.read.getMarkets()) {
  console.log(
    `market #${market.id}          closes at block ${market.closeBlock}, resolves at ${market.resolveBlock}`,
  );
}
console.log(`current block      ${await publicClient.getBlockNumber()} (mining 1 block/second)`);
console.log(`wrote              ${envPath}`);
console.log("");
console.log("Next:");
console.log("  npx hardhat run scripts/local-executor.ts   # plays Scheduler + TEE executor");
console.log("  cd ../web && npm run dev");

await connection.close();
