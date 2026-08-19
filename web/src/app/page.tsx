"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatEther } from "viem";
import { predictAbi } from "@/lib/predict-abi";
import { HAS_ADDRESS, PREDICT_ADDRESS, RPC_URL, activeChain, publicClient } from "@/lib/chain";
import { ritual, shortAddress, type Market } from "@/lib/market";
import { useTransactions, writeContract } from "@/lib/tx";
import { MarketCard, readStakes, type Stakes } from "@/components/MarketCard";
import { CreateMarketForm } from "@/components/CreateMarketForm";
import { OraclePreview } from "@/components/OraclePreview";
import { MarketCardSkeleton } from "@/components/Skeleton";
import { ToastBar } from "@/components/ToastBar";

type ChainState = {
  block: bigint;
  blockTimeMs: bigint;
  executionBalance: bigint;
  markets: readonly Market[];
};

export default function Page() {
  const [chain, setChain] = useState<ChainState>();
  const [stakes, setStakes] = useState<Record<string, Stakes>>({});
  const [error, setError] = useState<string>();

  const { toast, dismiss, send, account } = useTransactions(() => refresh());

  const refresh = useCallback(async () => {
    if (!HAS_ADDRESS) return;
    try {
      const [block, blockTimeMs, executionBalance, markets] = await Promise.all([
        publicClient.getBlockNumber(),
        publicClient.readContract({
          address: PREDICT_ADDRESS,
          abi: predictAbi,
          functionName: "blockTimeMs",
        }),
        publicClient.readContract({
          address: PREDICT_ADDRESS,
          abi: predictAbi,
          functionName: "executionBalance",
        }),
        publicClient.readContract({
          address: PREDICT_ADDRESS,
          abi: predictAbi,
          functionName: "getMarkets",
        }),
      ]);

      setChain({ block, blockTimeMs, executionBalance, markets: markets as readonly Market[] });
      setError(undefined);

      if (account) {
        const entries = await Promise.all(
          (markets as readonly Market[]).map(
            async (market) =>
              [market.id.toString(), await readStakes(market.id, account)] as const,
          ),
        );
        setStakes(Object.fromEntries(entries));
      }
    } catch (refreshError) {
      setError((refreshError as Error).message);
    }
  }, [account]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 4_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-24 sm:px-8">
      <header className="pt-10 pb-8">
        <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] text-ink sm:text-[34px]">
          Markets that settle themselves
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          Nobody presses resolve.{" "}
          <Link href="/how-it-works" className="text-accent transition-opacity hover:opacity-80">
            How it works →
          </Link>
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-hairline pt-6 sm:grid-cols-4">
          <Stat label="Network">
            {activeChain.name}
            <span className="ml-1.5 text-ink-faint">{activeChain.id}</span>
          </Stat>
          <Stat label="Block">{chain ? chain.block.toString() : "—"}</Stat>
          <Stat label="Prepaid fees">
            {chain ? `${formatEther(chain.executionBalance)} RITUAL` : "—"}
          </Stat>
          <Stat label="Contract">
            {HAS_ADDRESS ? shortAddress(PREDICT_ADDRESS) : "not configured"}
          </Stat>
        </dl>
      </header>

      {!HAS_ADDRESS && <SetupPanel />}
      {HAS_ADDRESS && error && <ErrorPanel message={error} />}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <section id="markets" className="space-y-5">
          {!chain && HAS_ADDRESS && !error && (
            <>
              <MarketCardSkeleton />
              <MarketCardSkeleton />
            </>
          )}

          {chain?.markets.length === 0 && (
            <p className="card px-5 py-16 text-center text-sm text-ink-faint">
              No markets yet. Create the first one.
            </p>
          )}

          {chain?.markets.map((market) => (
            <MarketCard
              key={market.id.toString()}
              market={market}
              block={chain.block}
              blockTimeMs={chain.blockTimeMs}
              account={account}
              stakes={stakes[market.id.toString()]}
              onBet={(marketId, isYes, value) =>
                send(`Bet ${ritual(value)} on ${isYes ? "YES" : "NO"}`, (signer) =>
                  writeContract(signer, "bet", [marketId, isYes], value),
                )
              }
              onClaim={(marketId, amount) =>
                send(`Claim ${ritual(amount)} RITUAL`, (signer) =>
                  writeContract(signer, "claimWinnings", [marketId]),
                )
              }
              onRefund={(marketId, amount) =>
                send(`Refund ${ritual(amount)} RITUAL`, (signer) =>
                  writeContract(signer, "claimRefund", [marketId]),
                )
              }
            />
          ))}
        </section>

        <aside className="space-y-6 lg:sticky lg:top-8">
          <section className="card p-5 sm:p-6">
            <h2 className="mb-5 text-[15px] font-medium text-ink">New market</h2>
            <CreateMarketForm
              disabled={!HAS_ADDRESS}
              onCreate={(params) =>
                send(`Create market`, (signer) =>
                  writeContract(signer, "createMarket", [params]),
                )
              }
            />
          </section>

          <section className="card p-5 sm:p-6">
            <OraclePreview />
          </section>
        </aside>
      </div>

      {toast && <ToastBar toast={toast} onDismiss={dismiss} />}
    </main>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="tabular mt-1 text-[15px] text-ink">{children}</dd>
    </div>
  );
}

function SetupPanel() {
  return (
    <section className="card mb-6 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-[15px] font-medium text-warning">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
        No contract configured
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        Deploy the contract, then put its address in <code>web/.env.local</code>:
      </p>
      <pre className="tabular mt-4 overflow-x-auto rounded-lg bg-surface px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
{`# against Ritual Chain
cd hardhat && npx hardhat run scripts/deploy.ts

# or entirely offline, against a local node
cd hardhat && npx hardhat node
npx hardhat run scripts/local-serve.ts`}
      </pre>
    </section>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <section role="alert" className="card mb-6 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-[15px] font-medium text-danger">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger" />
        Cannot read the chain
      </h2>
      <p className="mt-2 text-sm text-ink-soft">{message}</p>
      <p className="tabular mt-1 text-[13px] text-ink-faint">{RPC_URL}</p>
    </section>
  );
}
