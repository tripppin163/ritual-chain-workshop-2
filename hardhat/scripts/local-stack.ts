/**
 * Puts a working Ritual Chain underneath a plain EVM node.
 *
 * RitualPredict talks to five fixed addresses — the Scheduler, RitualWallet, the TEE
 * registry, and the HTTP and jq precompiles. A local Hardhat node has none of them, so
 * every call returns empty and the contract cannot even be deployed (its constructor
 * calls approveScheduler). This installs the mocks from contracts/mocks at exactly
 * those addresses with `hardhat_setCode`, which is what makes the whole lifecycle
 * runnable offline.
 *
 * Shared by test/RitualPredict.e2e.ts and scripts/local-demo.ts so the simulated chain
 * is defined in one place.
 */
import type { network } from "hardhat";

export type Connection = Awaited<ReturnType<typeof network.create>>;

/** Mirrors contracts/ritual/RitualChain.sol. */
export const RITUAL_ADDRESSES = {
  scheduler: "0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B",
  ritualWallet: "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948",
  teeServiceRegistry: "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F",
  httpPrecompile: "0x0000000000000000000000000000000000000801",
  jqPrecompile: "0x0000000000000000000000000000000000000803",
} as const;

/** Stand-in executor addresses; the mock registry hands these to the contract. */
export const LOCAL_EXECUTORS = [
  "0x00000000000000000000000000000000000eec01",
  "0x00000000000000000000000000000000000eec02",
] as const;

/** MockHttpPrecompile.Kind */
export const HTTP_KIND = { response: 0, malformed: 1, unsettled: 2, revert: 3 } as const;

/** RitualPredict.MarketState, .Outcome and .Comparator, for printing and for tests. */
export const MARKET_STATE = ["Open", "Closed", "Resolving", "Resolved", "Invalid"] as const;
export const OUTCOME = ["Unresolved", "YES", "NO"] as const;
export const COMPARATOR = { gt: 0, gte: 1, lt: 2, lte: 3 } as const;

export async function installRitualMocks(connection: Connection) {
  const { viem, provider } = connection;
  const publicClient = await viem.getPublicClient();

  const sources = {
    [RITUAL_ADDRESSES.scheduler]: await viem.deployContract("MockScheduler"),
    [RITUAL_ADDRESSES.ritualWallet]: await viem.deployContract("MockRitualWallet"),
    [RITUAL_ADDRESSES.teeServiceRegistry]: await viem.deployContract("MockTEEServiceRegistry"),
    [RITUAL_ADDRESSES.httpPrecompile]: await viem.deployContract("MockHttpPrecompile"),
    [RITUAL_ADDRESSES.jqPrecompile]: await viem.deployContract("MockJqPrecompile"),
  };

  for (const [target, source] of Object.entries(sources)) {
    const code = await publicClient.getCode({ address: source.address });
    if (code === undefined) throw new Error(`mock at ${source.address} has no runtime code`);
    // Copies runtime code but not storage, so nothing here may depend on a
    // constructor having run.
    await provider.request({ method: "hardhat_setCode", params: [target, code] });
  }

  const scheduler = await viem.getContractAt("MockScheduler", RITUAL_ADDRESSES.scheduler);
  const wallet = await viem.getContractAt("MockRitualWallet", RITUAL_ADDRESSES.ritualWallet);
  const registry = await viem.getContractAt(
    "MockTEEServiceRegistry",
    RITUAL_ADDRESSES.teeServiceRegistry,
  );
  const http = await viem.getContractAt(
    "MockHttpPrecompile",
    RITUAL_ADDRESSES.httpPrecompile,
  );

  // `hardhat_setCode` replaces code but leaves storage behind, so a second run against
  // a long-lived node would inherit the previous run's queued oracle responses — and
  // the queue's last entry is sticky. Clear it here rather than in every caller.
  await http.write.reset();
  await registry.write.setExecutors([[...LOCAL_EXECUTORS]]);

  return { scheduler, wallet, registry, http, publicClient };
}

/** `hardhat_mine`, which both the in-process network and `hardhat node` support. */
export async function mineBlocks(connection: Connection, count: bigint) {
  if (count <= 0n) return;
  await connection.provider.request({
    method: "hardhat_mine",
    params: [`0x${count.toString(16)}`],
  });
}
