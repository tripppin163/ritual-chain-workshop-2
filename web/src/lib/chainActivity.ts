"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEther } from "viem";
import { predictAbi } from "./predict-abi";
import { HAS_ADDRESS, PREDICT_ADDRESS, publicClient } from "./chain";

/**
 * What the chain did on its own.
 *
 * Every event below is emitted inside `onScheduledResolve`, which only the Scheduler
 * can call — so nothing here was triggered by a person clicking anything. That is the
 * whole claim this feed makes, and it is the reason the human-authored events (created,
 * bet, claimed) are deliberately absent.
 */
export type ChainAction = {
  key: string;
  kind: "woke" | "failed" | "settled" | "invalidated";
  marketId: bigint;
  block: bigint;
  logIndex: number;
  headline: string;
  detail: { label: string; value: string }[];
};

export type ChainActivity = {
  actions: ChainAction[];
  /** Scheduled executions the chain has run, counted from its own logs. */
  executions: number;
  /** Native RITUAL the contract has paid out without anyone asking it to. */
  settledMarkets: number;
};

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export function useChainActivity(pollMs = 4_000): ChainActivity {
  const [activity, setActivity] = useState<ChainActivity>({
    actions: [],
    executions: 0,
    settledMarkets: 0,
  });

  const read = useCallback(async () => {
    if (!HAS_ADDRESS) return;
    try {
      const logs = await publicClient.getContractEvents({
        address: PREDICT_ADDRESS,
        abi: predictAbi,
        fromBlock: 0n,
        toBlock: "latest",
      });

      const actions: ChainAction[] = [];
      let executions = 0;
      let settledMarkets = 0;

      for (const log of logs) {
        const args = log.args as Record<string, unknown>;
        const marketId = args.marketId as bigint | undefined;
        if (marketId === undefined) continue;

        const block = log.blockNumber ?? 0n;
        const logIndex = log.logIndex ?? 0;
        const key = `${block}-${logIndex}`;
        const base = { key, marketId, block, logIndex };

        switch (log.eventName) {
          case "ResolutionAttempted": {
            executions++;
            const executor = args.executor as string;
            actions.push({
              ...base,
              kind: "woke",
              headline: `Scheduler woke market #${marketId}`,
              detail: [
                { label: "Block", value: block.toString() },
                { label: "Attempt", value: `${args.attempt} of 3` },
                {
                  label: "Executor",
                  value:
                    executor === "0x0000000000000000000000000000000000000000"
                      ? "none available"
                      : short(executor),
                },
              ],
            });
            break;
          }

          case "ResolutionFailed":
            actions.push({
              ...base,
              kind: "failed",
              headline: `Attempt ${args.attempt} on market #${marketId} could not read the oracle`,
              detail: [
                { label: "Block", value: block.toString() },
                { label: "Reason", value: args.reason as string },
              ],
            });
            break;

          case "MarketResolved":
            settledMarkets++;
            actions.push({
              ...base,
              kind: "settled",
              headline: `Market #${marketId} settled ${args.outcome === 1 ? "YES" : "NO"}`,
              detail: [
                { label: "Block", value: block.toString() },
                { label: "Observed", value: (args.observedValue as bigint).toString() },
              ],
            });
            break;

          case "MarketInvalidated":
            actions.push({
              ...base,
              kind: "invalidated",
              headline: `Market #${marketId} became refundable`,
              detail: [
                { label: "Block", value: block.toString() },
                { label: "Reason", value: args.reason as string },
              ],
            });
            break;
        }
      }

      actions.sort((a, b) =>
        a.block === b.block ? b.logIndex - a.logIndex : Number(b.block - a.block),
      );
      setActivity({ actions, executions, settledMarkets });
    } catch {
      // The page's own error panel reports a chain that cannot be read.
    }
  }, []);

  useEffect(() => {
    void read();
    const timer = setInterval(() => void read(), pollMs);
    return () => clearInterval(timer);
  }, [read, pollMs]);

  return activity;
}

export const ritualAmount = (value: bigint) => formatEther(value);
