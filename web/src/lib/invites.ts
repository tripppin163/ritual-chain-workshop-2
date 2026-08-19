"use client";

import { useEffect, useState } from "react";
import { getAddress, type Address } from "viem";
import { predictAbi } from "./predict-abi";
import { HAS_ADDRESS, PREDICT_ADDRESS, publicClient } from "./chain";

/**
 * Who was invited to which private market, read from the MarketRestricted logs.
 *
 * One `getLogs` beats one `canBet` call per market per refresh, and the data is public
 * either way — a private market restricts who may bet, it does not hide anything from
 * anyone holding an RPC endpoint.
 */
export function useInvites() {
  const [invites, setInvites] = useState<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    if (!HAS_ADDRESS) return;
    let cancelled = false;

    void (async () => {
      try {
        const logs = await publicClient.getContractEvents({
          address: PREDICT_ADDRESS,
          abi: predictAbi,
          eventName: "MarketRestricted",
          fromBlock: 0n,
          toBlock: "latest",
        });

        const next = new Map<string, Set<string>>();
        for (const log of logs) {
          const args = log.args as { marketId?: bigint; viewers?: readonly Address[] };
          if (args.marketId === undefined || !args.viewers) continue;
          next.set(
            args.marketId.toString(),
            new Set(args.viewers.map((viewer) => getAddress(viewer))),
          );
        }
        if (!cancelled) setInvites(next);
      } catch {
        // A chain that cannot be read is reported by the page's own error panel.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return invites;
}

/** A private market shows only to its creator and the addresses it invited. */
export function canSee(
  market: { id: bigint; isPrivate: boolean; creator: Address },
  account: Address | undefined,
  invites: Map<string, Set<string>>,
): boolean {
  if (!market.isPrivate) return true;
  if (!account) return false;
  const me = getAddress(account);
  if (getAddress(market.creator) === me) return true;
  return invites.get(market.id.toString())?.has(me) ?? false;
}
