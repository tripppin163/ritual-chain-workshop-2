/**
 * Plays the two roles a local node does not have: the Scheduler and the TEE executor.
 *
 *   npx hardhat run scripts/local-executor.ts
 *
 * On the real chain the Scheduler fires the booked execution and an attested executor
 * fetches the oracle inside an enclave. Here this loop watches for markets that have
 * reached their resolve block, fetches the market's own oracle URL over plain HTTP,
 * queues the response into the HTTP precompile mock, and runs the execution.
 *
 * The contract, its encoding and its callback are untouched — only the two off-chain
 * roles are stood in for, which is exactly the part a workshop cannot demo while the
 * testnet is unreachable.
 */
import { network } from "hardhat";
import { MARKET_STATE, OUTCOME, RITUAL_ADDRESSES, installRitualMocks } from "./local-stack.ts";

const POLL_MS = Number(process.env.POLL_MS ?? 2_000);
const PREDICT_ADDRESS = process.env.PREDICT_ADDRESS;

const connection = await network.create({
  network: process.env.LOCAL_NETWORK ?? "localhost",
  chainType: "l1",
});
const { viem } = connection;
const publicClient = await viem.getPublicClient();

// The mocks are already installed by local-serve.ts; this only rebinds to them.
const scheduler = await viem.getContractAt("MockScheduler", RITUAL_ADDRESSES.scheduler);
const http = await viem.getContractAt("MockHttpPrecompile", RITUAL_ADDRESSES.httpPrecompile);

const address =
  PREDICT_ADDRESS ??
  (() => {
    throw new Error(
      "Set PREDICT_ADDRESS to the deployed contract (printed by scripts/local-serve.ts).",
    );
  })();
const predict = await viem.getContractAt("RitualPredict", address as `0x${string}`);

console.log(`watching ${address} — Ctrl-C to stop`);

const seen = new Set<string>();

for (;;) {
  const block = await publicClient.getBlockNumber();

  for (const market of await predict.read.getMarkets()) {
    const pending = market.state !== 3 && market.state !== 4;
    const due = block >= market.resolveBlock;
    const attemptsLeft = market.attempts < (await predict.read.MAX_ATTEMPTS());
    const key = `${market.id}:${market.attempts}`;

    if (!pending || !due || !attemptsLeft || seen.has(key)) continue;
    seen.add(key);

    // The executor's job: fetch the market's own oracle URL and hand the response back.
    let status = 0;
    let body = "";
    let transportError = "";
    try {
      const response = await fetch(market.oracleUrl, {
        signal: AbortSignal.timeout(5_000),
      });
      status = response.status;
      body = await response.text();
    } catch (error) {
      transportError = (error as Error).message;
    }

    await http.write.reset();
    if (transportError) {
      await http.write.queueResponse([502, "0x", transportError]);
    } else {
      await http.write.queueResponse([
        status,
        `0x${Buffer.from(body, "utf8").toString("hex")}`,
        "",
      ]);
    }

    console.log(
      `#${market.id} attempt ${market.attempts + 1} at block ${block} — oracle ${
        transportError ? `unreachable (${transportError})` : `HTTP ${status} ${body.slice(0, 60)}`
      }`,
    );

    await scheduler.write.fireStrict([market.scheduleId, BigInt(market.attempts)], {
      gas: 8_000_000n,
    });

    const after = await predict.read.getMarket([market.id]);
    console.log(
      `        → ${MARKET_STATE[after.state]}` +
        (after.state === 3 ? ` ${OUTCOME[after.outcome]} (observed ${after.observedValue})` : "") +
        (after.state === 4 ? ` (${after.invalidReason})` : ""),
    );
  }

  await new Promise((resolveTimer) => setTimeout(resolveTimer, POLL_MS));
}
