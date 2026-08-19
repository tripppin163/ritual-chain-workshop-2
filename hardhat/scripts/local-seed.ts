/**
 * Fills a local chain with enough markets to judge the UI at scale.
 *
 *   PREDICT_ADDRESS=0x... COUNT=16 npx hardhat run scripts/local-seed.ts
 *
 * Two markets tell you nothing about a grid, a filter bar or a "show more" button. This
 * creates a spread of questions with different windows and stakes so the list has
 * something to sort, search and paginate.
 */
import { network } from "hardhat";
import { parseEther } from "viem";
import { COMPARATOR } from "./local-stack.ts";

const COUNT = Number(process.env.COUNT ?? 16);
const ORACLE_URL = process.env.ORACLE_URL ?? "http://127.0.0.1:3000/api/oracle/eth";

const QUESTIONS: [string, bigint, keyof typeof COMPARATOR][] = [
  ["Will ETH/USD be at least $4,000 when this market resolves?", 4_000n, "gte"],
  ["Will ETH/USD stay under $2,500?", 2_500n, "lt"],
  ["Will ETH/USD break $5,000 today?", 5_000n, "gt"],
  ["Will ETH/USD close above $1,800?", 1_800n, "gt"],
  ["Will ETH/USD dip below $1,500?", 1_500n, "lt"],
  ["Will ETH/USD be at most $3,000?", 3_000n, "lte"],
  ["Will ETH/USD reach $10,000 this cycle?", 10_000n, "gte"],
  ["Will ETH/USD hold above $1,000?", 1_000n, "gt"],
];

const { viem } = await network.create({
  network: process.env.LOCAL_NETWORK ?? "localhost",
  chainType: "l1",
});

const address = process.env.PREDICT_ADDRESS;
if (!address) throw new Error("Set PREDICT_ADDRESS (printed by scripts/local-serve.ts).");

const predict = await viem.getContractAt("RitualPredict", address as `0x${string}`);
const wallets = await viem.getWalletClients();

for (let index = 0; index < COUNT; index++) {
  const [question, target, comparator] = QUESTIONS[index % QUESTIONS.length]!;
  // A spread of windows, so some close within the demo and some stay open.
  const bettingSeconds = BigInt(60 + ((index * 137) % 1_800));

  await predict.write.createMarket([
    {
      question: index < QUESTIONS.length ? question : `${question} (round ${Math.floor(index / QUESTIONS.length) + 1})`,
      oracleUrl: ORACLE_URL,
      jsonPath: ".price",
      target,
      comparator: COMPARATOR[comparator],
      bettingSeconds,
      resolveDelaySeconds: 30n,
    },
  ]);

  const marketId = await predict.read.marketCount();
  const bettors = wallets.slice(1, 4);
  for (const [slot, wallet] of bettors.entries()) {
    if (!wallet) continue;
    const amount = parseEther(String(((index + slot) % 5) + 0.5));
    await predict.write.bet([marketId, (index + slot) % 2 === 0], {
      account: wallet.account,
      value: amount,
    });
  }

  console.log(`#${marketId} ${question.slice(0, 46)}… betting ${bettingSeconds}s`);
}

console.log(`\nmarkets on chain: ${await predict.read.marketCount()}`);
