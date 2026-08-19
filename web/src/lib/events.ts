import { formatEther } from "viem";
import { predictAbi } from "./predict-abi";
import { PREDICT_ADDRESS, publicClient } from "./chain";

/**
 * The market's own history, read from its logs.
 *
 * Everything on this page comes from events the contract emits — there is no indexer
 * and no backend. `fromBlock: 0n` is fine for a workshop chain; a busy one would want a
 * deployment block to start from.
 */

export type MarketEvent = {
  kind:
    | "created"
    | "rule"
    | "bet"
    | "attempted"
    | "failed"
    | "resolved"
    | "invalidated"
    | "claimed"
    | "refunded";
  block: bigint;
  logIndex: number;
  text: string;
  detail?: string;
  actor?: `0x${string}`;
  tone: "neutral" | "good" | "warn" | "bad";
};

/** One point per bet: the running YES share of the pool, which is the market's price. */
export type PricePoint = { block: bigint; yesShare: number; pool: bigint };

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const amount = (value: bigint) => `${formatEther(value)} RITUAL`;

export async function readMarketHistory(marketId: bigint): Promise<{
  events: MarketEvent[];
  price: PricePoint[];
}> {
  const logs = await publicClient.getContractEvents({
    address: PREDICT_ADDRESS,
    abi: predictAbi,
    fromBlock: 0n,
    toBlock: "latest",
  });

  const events: MarketEvent[] = [];
  const price: PricePoint[] = [];
  let yesTotal = 0n;
  let noTotal = 0n;

  for (const log of logs) {
    const args = log.args as Record<string, unknown>;
    if (args.marketId !== marketId) continue;

    const base = { block: log.blockNumber ?? 0n, logIndex: log.logIndex ?? 0 };

    switch (log.eventName) {
      case "MarketCreated":
        events.push({
          ...base,
          kind: "created",
          tone: "neutral",
          text: "Market created",
          detail: `betting closes at block ${args.closeBlock}, Scheduler booked for ${args.resolveBlock}`,
          actor: args.creator as `0x${string}`,
        });
        break;

      case "ResolutionRuleSet":
        events.push({
          ...base,
          kind: "rule",
          tone: "neutral",
          text: "Resolution rule fixed",
          detail: `${args.jsonPath} from ${args.oracleUrl}`,
        });
        break;

      case "BetPlaced": {
        const isYes = args.isYes as boolean;
        const value = args.amount as bigint;
        if (isYes) yesTotal += value;
        else noTotal += value;
        const pool = yesTotal + noTotal;

        events.push({
          ...base,
          kind: "bet",
          tone: "neutral",
          text: `${amount(value)} on ${isYes ? "YES" : "NO"}`,
          actor: args.bettor as `0x${string}`,
        });
        price.push({
          block: base.block,
          pool,
          yesShare: pool === 0n ? 50 : Number((yesTotal * 10_000n) / pool) / 100,
        });
        break;
      }

      case "ResolutionAttempted":
        events.push({
          ...base,
          kind: "attempted",
          tone: "warn",
          text: `Scheduler woke the contract · attempt ${args.attempt}`,
          detail: `executor ${short(args.executor as string)}`,
        });
        break;

      case "ResolutionFailed":
        events.push({
          ...base,
          kind: "failed",
          tone: "bad",
          text: `Attempt ${args.attempt} failed`,
          detail: args.reason as string,
        });
        break;

      case "MarketResolved":
        events.push({
          ...base,
          kind: "resolved",
          tone: "good",
          text: `Resolved ${args.outcome === 1 ? "YES" : "NO"}`,
          detail: `observed ${args.observedValue}`,
        });
        break;

      case "MarketInvalidated":
        events.push({
          ...base,
          kind: "invalidated",
          tone: "bad",
          text: "Market invalidated · everyone refunds",
          detail: args.reason as string,
        });
        break;

      case "WinningsClaimed":
        events.push({
          ...base,
          kind: "claimed",
          tone: "good",
          text: `Claimed ${amount(args.amount as bigint)}`,
          actor: args.claimant as `0x${string}`,
        });
        break;

      case "StakeRefunded":
        events.push({
          ...base,
          kind: "refunded",
          tone: "warn",
          text: `Refunded ${amount(args.amount as bigint)}`,
          actor: args.claimant as `0x${string}`,
        });
        break;
    }
  }

  events.sort((a, b) =>
    a.block === b.block ? b.logIndex - a.logIndex : Number(b.block - a.block),
  );
  return { events, price };
}
