/**
 * End-to-end walkthroughs of the workshop flow, driven the way a user or a script
 * drives it: deploy, create, bet, wait for the Scheduler, claim.
 *
 * The chain's capabilities live at fixed addresses, so the suite puts mock runtime
 * code at those addresses with `hardhat_setCode` — the TypeScript counterpart of the
 * `vm.etch` the Solidity tests use. Nothing here needs an RPC or a funded account.
 *
 * `contracts/RitualPredict.t.sol` covers the contract's branches. This file covers the
 * things only an outside caller can see: multi-account money movement, the view shapes
 * the frontend reads, and the whole lifecycle in one pass.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress, parseEther } from "viem";

/** Mirrors contracts/ritual/RitualChain.sol. */
const RITUAL = {
  scheduler: "0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B",
  ritualWallet: "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948",
  teeServiceRegistry: "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F",
  httpPrecompile: "0x0000000000000000000000000000000000000801",
  jqPrecompile: "0x0000000000000000000000000000000000000803",
} as const;

/** MockHttpPrecompile.Kind */
const KIND = { response: 0, malformed: 1, unsettled: 2, revert: 3 } as const;
/** RitualPredict.MarketState / .Outcome */
const STATE = { open: 0, closed: 1, resolving: 2, resolved: 3, invalid: 4 } as const;
const OUTCOME = { unresolved: 0, yes: 1, no: 2 } as const;
const COMPARATOR = { gt: 0, gte: 1, lt: 2, lte: 3 } as const;

/** One block per second, so every deadline in this file reads in plain seconds. */
const BLOCK_TIME_MS = 1_000n;

const connection = await network.create();
const { viem, networkHelpers, provider } = connection;

async function deployRitualStack() {
  const publicClient = await viem.getPublicClient();
  const [deployer, alice, bob] = await viem.getWalletClients();
  if (!deployer || !alice || !bob) {
    throw new Error("this suite needs three funded accounts");
  }

  // Deploy the mocks normally, then copy their runtime code to the addresses the
  // contract actually calls.
  const sources = {
    [RITUAL.scheduler]: await viem.deployContract("MockScheduler"),
    [RITUAL.ritualWallet]: await viem.deployContract("MockRitualWallet"),
    [RITUAL.teeServiceRegistry]: await viem.deployContract("MockTEEServiceRegistry"),
    [RITUAL.httpPrecompile]: await viem.deployContract("MockHttpPrecompile"),
    [RITUAL.jqPrecompile]: await viem.deployContract("MockJqPrecompile"),
  };
  for (const [target, source] of Object.entries(sources)) {
    const code = await publicClient.getCode({ address: source.address });
    await provider.request({ method: "hardhat_setCode", params: [target, code] });
  }

  const scheduler = await viem.getContractAt("MockScheduler", RITUAL.scheduler);
  const http = await viem.getContractAt("MockHttpPrecompile", RITUAL.httpPrecompile);
  const registry = await viem.getContractAt(
    "MockTEEServiceRegistry",
    RITUAL.teeServiceRegistry,
  );
  await registry.write.setExecutors([[
    "0x00000000000000000000000000000000000eec01",
    "0x00000000000000000000000000000000000eec02",
  ]]);

  // The constructor calls Scheduler.approveScheduler, so the mocks have to be in
  // place first.
  const predict = await viem.deployContract("RitualPredict", [BLOCK_TIME_MS]);

  return { predict, scheduler, http, registry, publicClient, deployer, alice, bob };
}

function marketParams(overrides: Record<string, unknown> = {}) {
  return {
    question: "Will ETH/USD be at least $4,000 when this market resolves?",
    oracleUrl: "https://oracle.test/api/oracle/eth",
    jsonPath: ".price",
    target: 4_000n,
    comparator: COMPARATOR.gte,
    bettingSeconds: 60n,
    resolveDelaySeconds: 30n,
    ...overrides,
  } as const;
}

/** Mines forward until the Scheduler's booked block, then runs one execution. */
async function fireScheduledResolution(
  stack: Awaited<ReturnType<typeof deployRitualStack>>,
  marketId: bigint,
  executionIndex: bigint,
) {
  const market = await stack.predict.read.getMarket([marketId]);
  const current = await stack.publicClient.getBlockNumber();
  if (current < market.resolveBlock) {
    await networkHelpers.mine(Number(market.resolveBlock - current));
  }
  // An explicit gas limit, because MockScheduler.fire swallows a failed callback the
  // way the chain does: estimation would otherwise settle on a limit too small to
  // forward RESOLVE_GAS_LIMIT, and the inner call would quietly run out of gas.
  await stack.scheduler.write.fire([market.scheduleId, executionIndex], {
    gas: 8_000_000n,
  });
}

describe("RitualPredict end to end", () => {
  it("settles itself from the oracle and pays the winners their share of the pool", async () => {
    const stack = await networkHelpers.loadFixture(deployRitualStack);
    const { predict, http, publicClient, alice, bob } = stack;

    await predict.write.fundExecution([500_000n], { value: parseEther("0.5") });
    assert.equal(await predict.read.executionBalance(), parseEther("0.5"));

    await predict.write.createMarket([marketParams()]);
    const marketId = await predict.read.marketCount();
    assert.equal(marketId, 1n);

    await predict.write.bet([marketId, true], {
      account: alice.account,
      value: parseEther("3"),
    });
    await predict.write.bet([marketId, false], {
      account: bob.account,
      value: parseEther("1"),
    });

    const open = await predict.read.getMarket([marketId]);
    assert.equal(open.state, STATE.open);
    assert.equal(open.totalYes, parseEther("3"));
    assert.equal(open.totalNo, parseEther("1"));
    assert.equal(await publicClient.getBalance({ address: predict.address }), parseEther("4"));

    // Betting closes on its own: no transaction flips the state, the view does.
    await networkHelpers.mine(Number(open.closeBlock - (await publicClient.getBlockNumber())));
    assert.equal((await predict.read.getMarket([marketId])).state, STATE.closed);

    await http.write.queueJson(['{"price":4231,"asOf":"2026-08-19T00:00:00Z"}']);
    await fireScheduledResolution(stack, marketId, 0n);

    const resolved = await predict.read.getMarket([marketId]);
    assert.equal(resolved.state, STATE.resolved);
    assert.equal(resolved.outcome, OUTCOME.yes);
    assert.equal(resolved.observedValue, 4231n);
    assert.equal(resolved.attempts, 1);
    assert.equal(
      await http.read.lastUrl(),
      "https://oracle.test/api/oracle/eth",
      "the executor was asked for the market's own oracle URL",
    );

    // The winner takes the whole pool; the loser has nothing to claim.
    const [, , , claimable] = await predict.read.stakesOf([marketId, alice.account.address]);
    assert.equal(claimable, parseEther("4"));

    await viem.assertions.emitWithArgs(
      predict.write.claimWinnings([marketId], { account: alice.account }),
      predict,
      "WinningsClaimed",
      [marketId, getAddress(alice.account.address), parseEther("4")],
    );
    await viem.assertions.revertWithCustomError(
      predict.write.claimWinnings([marketId], { account: bob.account }),
      predict,
      "NothingToClaim",
    );

    assert.equal(
      await publicClient.getBalance({ address: predict.address }),
      0n,
      "the pool is fully distributed",
    );
  });

  it("refunds every stake when the oracle never answers", async () => {
    const stack = await networkHelpers.loadFixture(deployRitualStack);
    const { predict, http, publicClient, alice, bob } = stack;

    await predict.write.createMarket([marketParams()]);
    const marketId = await predict.read.marketCount();
    await predict.write.bet([marketId, true], {
      account: alice.account,
      value: parseEther("1"),
    });
    await predict.write.bet([marketId, false], {
      account: bob.account,
      value: parseEther("2"),
    });

    await http.write.queueKind([KIND.revert]); // sticky: every attempt fails

    const attempts = await predict.read.MAX_ATTEMPTS();
    const retryInterval = await predict.read.RETRY_INTERVAL_BLOCKS();
    for (let i = 0n; i < attempts; i++) {
      await fireScheduledResolution(stack, marketId, i);
      if (i + 1n < attempts) await networkHelpers.mine(Number(retryInterval));
    }

    const invalid = await predict.read.getMarket([marketId]);
    assert.equal(invalid.state, STATE.invalid);
    assert.equal(invalid.outcome, OUTCOME.unresolved, "a dead oracle is never a NO");
    assert.equal(invalid.attempts, Number(attempts));
    assert.equal(invalid.invalidReason, "http precompile call failed");

    await predict.write.claimRefund([marketId], { account: alice.account });
    await predict.write.claimRefund([marketId], { account: bob.account });
    assert.equal(await publicClient.getBalance({ address: predict.address }), 0n);

    await viem.assertions.revertWithCustomError(
      predict.write.claimRefund([marketId], { account: alice.account }),
      predict,
      "AlreadySettled",
    );
  });

  it("exposes every field the frontend renders, newest market first", async () => {
    const stack = await networkHelpers.loadFixture(deployRitualStack);
    const { predict, alice } = stack;

    await predict.write.createMarket([marketParams({ question: "First?" })]);
    await predict.write.createMarket([
      marketParams({ question: "Second?", comparator: COMPARATOR.lt, target: 100n }),
    ]);
    await predict.write.bet([1n, true], { account: alice.account, value: parseEther("1") });

    const markets = await predict.read.getMarkets();
    assert.equal(markets.length, 2);
    assert.equal(markets[0]!.question, "Second?", "newest first");
    assert.equal(markets[0]!.comparator, COMPARATOR.lt);
    assert.equal(markets[1]!.question, "First?");
    assert.equal(markets[1]!.totalYes, parseEther("1"));
    assert.notEqual(markets[0]!.scheduleId, markets[1]!.scheduleId);
    assert.ok(markets[0]!.resolveBlock > markets[0]!.closeBlock);
  });

  it("books the Scheduler for three attempts paid from the contract's own balance", async () => {
    const stack = await networkHelpers.loadFixture(deployRitualStack);
    const { predict, scheduler } = stack;

    await predict.write.createMarket([marketParams()]);
    const market = await predict.read.getMarket([1n]);
    const call = await scheduler.read.getCall([market.scheduleId]);

    assert.equal(getAddress(call.target), getAddress(predict.address));
    assert.equal(getAddress(call.payer), getAddress(predict.address));
    assert.equal(BigInt(call.startBlock), market.resolveBlock);
    assert.equal(call.numCalls, await predict.read.MAX_ATTEMPTS());
    assert.equal(call.frequency, await predict.read.RETRY_INTERVAL_BLOCKS());
    assert.equal(call.ttl, await predict.read.SCHEDULER_TTL_BLOCKS());
    assert.ok(call.maxFeePerGas >= (await predict.read.MIN_MAX_FEE_PER_GAS()));
    assert.equal(call.value, 0n);
  });
});
