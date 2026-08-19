"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { HAS_ADDRESS, PREDICT_ADDRESS, publicClient } from "@/lib/chain";
import { predictAbi } from "@/lib/predict-abi";
import { readMarketHistory, type MarketEvent, type PricePoint } from "@/lib/events";
import { ritual, type Market } from "@/lib/market";
import { useTransactions, writeContract } from "@/lib/tx";
import { MarketCard, readStakes, type Stakes } from "@/components/MarketCard";
import { ProbabilityChart } from "@/components/ProbabilityChart";
import { Lifecycle } from "@/components/Lifecycle";
import { Timeline } from "@/components/Timeline";
import { BackLink } from "@/components/Prose";
import { MarketCardSkeleton, Skeleton } from "@/components/Skeleton";
import { ToastBar } from "@/components/ToastBar";

/** One market in full: its price, where it is in its own run, and everything it did. */
export default function MarketPage() {
  const params = useParams<{ id: string }>();
  const marketId = BigInt(params.id ?? "1");

  const [market, setMarket] = useState<Market>();
  const [block, setBlock] = useState<bigint>();
  const [blockTimeMs, setBlockTimeMs] = useState<bigint>();
  const [stakes, setStakes] = useState<Stakes>();
  const [events, setEvents] = useState<MarketEvent[]>();
  const [price, setPrice] = useState<PricePoint[]>([]);
  const [error, setError] = useState<string>();

  const { toast, dismiss, send, account } = useTransactions(() => refresh());

  const refresh = useCallback(async () => {
    if (!HAS_ADDRESS) return;
    try {
      const [current, time, data, history] = await Promise.all([
        publicClient.getBlockNumber(),
        publicClient.readContract({
          address: PREDICT_ADDRESS,
          abi: predictAbi,
          functionName: "blockTimeMs",
        }),
        publicClient.readContract({
          address: PREDICT_ADDRESS,
          abi: predictAbi,
          functionName: "getMarket",
          args: [marketId],
        }),
        readMarketHistory(marketId),
      ]);

      setBlock(current);
      setBlockTimeMs(time);
      setMarket(data as Market);
      setEvents(history.events);
      setPrice(history.price);
      setError(undefined);

      if (account) setStakes(await readStakes(marketId, account));
    } catch (refreshError) {
      setError((refreshError as Error).message);
    }
  }, [marketId, account]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-24 sm:px-8">
      <nav className="pt-28 pb-8">
        <BackLink />
      </nav>

      {error && (
        <p role="alert" className="card mb-6 p-5 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="space-y-6">
          {market && block !== undefined && blockTimeMs !== undefined ? (
            <MarketCard
              market={market}
              block={block}
              blockTimeMs={blockTimeMs}
              account={account}
              stakes={stakes}
              compact
              onBet={(id, isYes, value) =>
                send(`Bet ${ritual(value)} on ${isYes ? "YES" : "NO"}`, (signer) =>
                  writeContract(signer, "bet", [id, isYes], value),
                )
              }
              onClaim={(id, amount) =>
                send(`Claim ${ritual(amount)} RITUAL`, (signer) =>
                  writeContract(signer, "claimWinnings", [id]),
                )
              }
              onRefund={(id, amount) =>
                send(`Refund ${ritual(amount)} RITUAL`, (signer) =>
                  writeContract(signer, "claimRefund", [id]),
                )
              }
            />
          ) : (
            <MarketCardSkeleton />
          )}

          <section className="card p-5 sm:p-6">
            {market ? (
              <ProbabilityChart points={price} />
            ) : (
              <Skeleton className="h-48 w-full rounded-lg" />
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <h2 className="mb-4 text-[15px] font-medium text-ink">Resolution lifecycle</h2>
            {market && block !== undefined ? (
              <Lifecycle market={market} block={block} />
            ) : (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((row) => (
                  <Skeleton key={row} className="h-8 w-full rounded-lg" />
                ))}
              </div>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="mb-1 text-[15px] font-medium text-ink">On-chain history</h2>
            <p className="label mb-4">Read from the contract&apos;s own logs</p>
            {events ? (
              <Timeline events={events} />
            ) : (
              <div className="space-y-3">
                {[0, 1, 2].map((row) => (
                  <Skeleton key={row} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {toast && <ToastBar toast={toast} onDismiss={dismiss} />}
    </main>
  );
}
