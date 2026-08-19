/**
 * The whole self-resolving lifecycle, offline, against a local Hardhat node.
 *
 *   npx hardhat node                                       # terminal 1
 *   npx hardhat run scripts/local-demo.ts                  # terminal 2
 *
 * Set LOCAL_NETWORK=hardhatMainnet to run it in-process instead, with no node at all.
 *
 * Ritual Chain's testnet is not always reachable, and the interesting part of this
 * contract — a market that settles itself with nobody watching — needs a Scheduler, a
 * TEE registry and two precompiles. scripts/local-stack.ts installs mocks at those
 * canonical addresses, so the flow below is the real contract, the real encoding and
 * the real callback path, with only the chain's own services stubbed.
 *
 * Act 1: a market resolves from its oracle and pays the winners.
 * Act 2: a market whose oracle never answers exhausts its attempts and refunds
 *        everyone. Set SKIP_FAILURE_DEMO=1 to stop after act 1.
 */
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import {
  COMPARATOR,
  HTTP_KIND,
  MARKET_STATE,
  OUTCOME,
  installRitualMocks,
  mineBlocks,
} from "./local-stack.ts";

const NETWORK = process.env.LOCAL_NETWORK ?? "localhost";
const BLOCK_TIME_MS = BigInt(process.env.BLOCK_TIME_MS ?? 1_000); // 1 block per second
const OBSERVED_PRICE = BigInt(process.env.ORACLE_PRICE ?? 4_231);
const TARGET = BigInt(process.env.TARGET ?? 4_000);

const rule = (label: string) => console.log(`\n\x1b[1m── ${label} ${"─".repeat(Math.max(0, 58 - label.length))}\x1b[0m`);
const step = (text: string) => console.log(`  ${text}`);

let connection;
try {
  connection = await network.create({ network: NETWORK, chainType: "l1" });
} catch (error) {
  console.error(
    `Could not connect to the "${NETWORK}" network.\n` +
      "Start one with:  npx hardhat node\n" +
      "or run this in-process with:  LOCAL_NETWORK=hardhatMainnet npx hardhat run scripts/local-demo.ts\n",
  );
  throw error;
}

const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [deployer, alice, bob, carol] = await viem.getWalletClients();
if (!deployer || !alice || !bob || !carol) {
  throw new Error("this demo needs four funded accounts");
}

rule("Local chain");
step(`network            ${NETWORK} (chain id ${await publicClient.getChainId()})`);
step(`block              ${await publicClient.getBlockNumber()}`);
step(`deployer           ${deployer.account.address}`);

rule("Ritual system contracts");
const { scheduler, wallet, registry, http } = await installRitualMocks(connection);
step(`Scheduler          ${scheduler.address}`);
step(`RitualWallet       ${wallet.address}`);
step(`TEEServiceRegistry ${registry.address}  (2 executors registered)`);
step(`HTTP precompile    ${http.address}`);
step("installed with hardhat_setCode at their canonical addresses");

rule("Deploy");
const predict = await viem.deployContract("RitualPredict", [BLOCK_TIME_MS]);
step(`RitualPredict      ${predict.address}`);
step(`blockTimeMs        ${BLOCK_TIME_MS}  →  1 second of market duration = ${1000n / BLOCK_TIME_MS} block(s)`);

await predict.write.fundExecution([500_000n], { value: parseEther("0.5") });
step(`execution balance  ${formatEther(await predict.read.executionBalance())} RITUAL prepaid in RitualWallet`);

// ─────────────────────────────── Act 1 ───────────────────────────────

rule("Act 1 — create a market");
const question = `Will ETH/USD be at least $${TARGET} when this market resolves?`;
await predict.write.createMarket([
  {
    question,
    oracleUrl: "https://oracle.local/api/oracle/eth",
    jsonPath: ".price",
    target: TARGET,
    comparator: COMPARATOR.gte,
    bettingSeconds: 60n,
    resolveDelaySeconds: 30n,
    viewers: [],
  },
]);
const marketId = await predict.read.marketCount();
let market = await predict.read.getMarket([marketId]);
step(`#${marketId}  ${question}`);
step(`rule               observed ≥ ${market.target} from ${market.oracleUrl} (jq ${market.jsonPath})`);
step(`betting closes     block ${market.closeBlock}`);
step(`scheduler fires    block ${market.resolveBlock}  (schedule id ${market.scheduleId})`);

const booking = await scheduler.read.getCall([market.scheduleId]);
step(`booked             ${booking.numCalls} attempts, ${booking.frequency} blocks apart, ttl ${booking.ttl}, payer = the contract`);

rule("Act 1 — bets");
await predict.write.bet([marketId, true], { account: alice.account, value: parseEther("3") });
await predict.write.bet([marketId, true], { account: bob.account, value: parseEther("1") });
await predict.write.bet([marketId, false], { account: carol.account, value: parseEther("4") });
market = await predict.read.getMarket([marketId]);
step(`alice   YES  3 RITUAL`);
step(`bob     YES  1 RITUAL`);
step(`carol   NO   4 RITUAL`);
step(`pool               ${formatEther(market.totalYes + market.totalNo)} RITUAL — YES ${formatEther(market.totalYes)} / NO ${formatEther(market.totalNo)}`);

rule("Act 1 — the window closes on its own");
await mineBlocks(connection, market.closeBlock - (await publicClient.getBlockNumber()));
market = await predict.read.getMarket([marketId]);
step(`block ${await publicClient.getBlockNumber()}  state ${MARKET_STATE[market.state]}  — no transaction did this, the view derives it`);

rule("Act 1 — the Scheduler wakes the contract");
await http.write.queueJson([`{"price":${OBSERVED_PRICE},"asOf":"local-demo"}`]);
step(`oracle will answer {"price":${OBSERVED_PRICE}}`);
await mineBlocks(connection, market.resolveBlock - (await publicClient.getBlockNumber()));
step(`block ${await publicClient.getBlockNumber()}  →  execution 0 fires`);

await scheduler.write.fireStrict([market.scheduleId, 0n], { gas: 8_000_000n });
market = await predict.read.getMarket([marketId]);
step(`HTTP precompile got GET ${await http.read.lastUrl()}  (ttl ${await http.read.lastTtl()} blocks, executor ${await http.read.lastExecutor()})`);
step(`state ${MARKET_STATE[market.state]}  outcome ${OUTCOME[market.outcome]}  observed ${market.observedValue}  attempts ${market.attempts}`);
const scheduleState = ["SCHEDULED", "EXECUTING", "COMPLETED", "CANCELLED", "EXPIRED"][
  await scheduler.read.getCallState([market.scheduleId])
];
step(`schedule state     ${scheduleState} — the contract asked to cancel the two`);
step(`                   remaining attempts, but a call cannot be cancelled while it`);
step(`                   is executing. Harmless: a leftover execution finds a settled`);
step(`                   market and returns without touching it.`);

rule("Act 1 — winners claim");
for (const [name, account] of [
  ["alice", alice.account],
  ["bob", bob.account],
] as const) {
  const [, , , claimable] = await predict.read.stakesOf([marketId, account.address]);
  await predict.write.claimWinnings([marketId], { account });
  step(`${name.padEnd(7)} claimed ${formatEther(claimable)} RITUAL`);
}
try {
  await predict.write.claimWinnings([marketId], { account: carol.account });
  step("carol   claimed — unexpected, the losing side should have nothing");
} catch {
  step("carol   nothing to claim (backed NO)");
}
step(`contract balance   ${formatEther(await publicClient.getBalance({ address: predict.address }))} RITUAL left`);

// ─────────────────────────────── Act 2 ───────────────────────────────

if (process.env.SKIP_FAILURE_DEMO !== "1") {
  rule("Act 2 — an oracle that never answers");
  await predict.write.createMarket([
    {
      question: "Will the dead oracle answer?",
      oracleUrl: "https://oracle.local/does-not-exist",
      jsonPath: ".price",
      target: 1n,
      comparator: COMPARATOR.gte,
      bettingSeconds: 30n,
      resolveDelaySeconds: 15n,
      viewers: [],
    },
  ]);
  const deadId = await predict.read.marketCount();
  await predict.write.bet([deadId, true], { account: alice.account, value: parseEther("1") });
  await predict.write.bet([deadId, false], { account: bob.account, value: parseEther("2") });
  step(`#${deadId} created, 3 RITUAL staked, oracle points at a URL that fails`);

  await http.write.reset();
  await http.write.queueKind([HTTP_KIND.revert]);

  const attempts = await predict.read.MAX_ATTEMPTS();
  const retryInterval = await predict.read.RETRY_INTERVAL_BLOCKS();
  let dead = await predict.read.getMarket([deadId]);
  await mineBlocks(connection, dead.resolveBlock - (await publicClient.getBlockNumber()));

  for (let i = 0n; i < attempts; i++) {
    await scheduler.write.fireStrict([dead.scheduleId, i], { gas: 8_000_000n });
    dead = await predict.read.getMarket([deadId]);
    step(`attempt ${dead.attempts}/${attempts} at block ${await publicClient.getBlockNumber()} → ${MARKET_STATE[dead.state]}`);
    if (i + 1n < attempts) await mineBlocks(connection, BigInt(retryInterval));
  }
  step(`invalid reason     "${dead.invalidReason}"`);
  step(`outcome            ${OUTCOME[dead.outcome]} — a dead oracle is never read as NO`);

  const before = await publicClient.getBalance({ address: predict.address });
  await predict.write.claimRefund([deadId], { account: alice.account });
  await predict.write.claimRefund([deadId], { account: bob.account });
  step(`refunded           ${formatEther(before - (await publicClient.getBalance({ address: predict.address })))} RITUAL to 2 accounts`);
}

rule("Done");
step("every market above settled without a single manual resolve call");

await connection.close();
