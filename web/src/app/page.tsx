"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { predictAbi } from "@/lib/predict-abi";
import { HAS_ADDRESS, PREDICT_ADDRESS, RPC_URL, activeChain, publicClient } from "@/lib/chain";
import { canSee, useInvites } from "@/lib/invites";
import { shortAddress, type Market } from "@/lib/market";
import { useOracle } from "@/lib/oracle";
import { useTransactions, writeContract } from "@/lib/tx";
import { readStakes, type Stakes } from "@/components/MarketCard";
import { MarketTile } from "@/components/MarketTile";
import {
  FILTERS,
  MarketToolbar,
  sortMarkets,
  type FilterKey,
  type SortKey,
} from "@/components/MarketToolbar";
import { NewMarketDialog } from "@/components/NewMarketDialog";
import { MarketCardSkeleton } from "@/components/Skeleton";
import { ToastBar } from "@/components/ToastBar";

type ChainState = {
  block: bigint;
  blockTimeMs: bigint;
  executionBalance: bigint;
  markets: readonly Market[];
  privateCount: bigint;
};

/** How many tiles render before "Show more". Keeps a hundred markets off the first paint. */
const PAGE_SIZE = 24;

export default function Page() {
  const [chain, setChain] = useState<ChainState>();
  const [stakes, setStakes] = useState<Record<string, Stakes>>({});
  const [error, setError] = useState<string>();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [creating, setCreating] = useState(false);

  const oracle = useOracle();
  const invites = useInvites();
  const { toast, dismiss, send, account } = useTransactions(() => refresh());

  const refresh = useCallback(async () => {
    if (!HAS_ADDRESS) return;
    try {
      const [block, blockTimeMs, executionBalance, markets, privateCount] = await Promise.all([
        publicClient.getBlockNumber(),
        publicClient.readContract({ address: PREDICT_ADDRESS, abi: predictAbi, functionName: "blockTimeMs" }),
        publicClient.readContract({ address: PREDICT_ADDRESS, abi: predictAbi, functionName: "executionBalance" }),
        publicClient.readContract({ address: PREDICT_ADDRESS, abi: predictAbi, functionName: "getMarkets" }),
        publicClient.readContract({ address: PREDICT_ADDRESS, abi: predictAbi, functionName: "privateMarketCount" }),
      ]);
      setChain({
        block,
        blockTimeMs,
        executionBalance,
        markets: markets as readonly Market[],
        privateCount,
      });
      setError(undefined);
    } catch (refreshError) {
      setError((refreshError as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 4_000);
    return () => clearInterval(timer);
  }, [refresh]);

  // Invite-only markets never reach the board unless this wallet was invited to them.
  const readable = useMemo(
    () => (chain ? chain.markets.filter((market) => canSee(market, account, invites)) : []),
    [chain, account, invites],
  );

  const filtered = useMemo(() => {
    const match = FILTERS.find((option) => option.key === filter)?.match ?? (() => true);
    const needle = query.trim().toLowerCase();
    return sortMarkets(
      readable.filter(
        (market) => match(market) && (!needle || market.question.toLowerCase().includes(needle)),
      ),
      sort,
    );
  }, [readable, filter, query, sort]);

  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  // Positions are read only for what is on screen. One read per market per refresh would
  // be a hundred calls every four seconds on a busy contract.
  const visibleIds = visible.map((market) => market.id.toString()).join(",");
  useEffect(() => {
    if (!account || !visibleIds) return setStakes({});
    let cancelled = false;

    void (async () => {
      const entries = await Promise.all(
        visibleIds
          .split(",")
          .map(async (id) => [id, await readStakes(BigInt(id), account)] as const),
      );
      if (!cancelled) setStakes(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
  }, [account, visibleIds]);

  useEffect(() => setLimit(PAGE_SIZE), [filter, query, sort]);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
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

        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-hairline pt-6 sm:grid-cols-3 lg:grid-cols-5">
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
          <Stat label="Invite only">
            {chain ? (
              <span className="inline-flex items-baseline gap-1.5">
                {chain.privateCount.toString()}
                <span className="text-[13px] text-ink-faint">settled privately</span>
              </span>
            ) : (
              "—"
            )}
          </Stat>
          <Stat label="Oracle now">
            {oracle.ok && oracle.reading?.price !== undefined ? (
              <span className="inline-flex items-center gap-2">
                {oracle.reading.price.toLocaleString("en-US")}
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
              </span>
            ) : (
              <span className="text-ink-faint">unreachable</span>
            )}
          </Stat>
        </dl>
      </header>

      {!HAS_ADDRESS && <SetupPanel />}
      {HAS_ADDRESS && error && <ErrorPanel message={error} />}

      <section id="markets">
        {chain && (
          <MarketToolbar
            markets={readable}
            filter={filter}
            onFilter={setFilter}
            query={query}
            onQuery={setQuery}
            sort={sort}
            onSort={setSort}
            onCreate={() => setCreating(true)}
          />
        )}

        {!chain && HAS_ADDRESS && !error && (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <MarketCardSkeleton />
            <MarketCardSkeleton />
            <MarketCardSkeleton />
          </div>
        )}

        {chain && filtered.length === 0 && (
          <p className="card px-5 py-16 text-center text-sm text-ink-faint">
            {readable.length === 0
              ? "No markets yet. Create the first one."
              : "Nothing matches that filter."}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((market) => (
            <MarketTile
              key={market.id.toString()}
              market={market}
              block={chain!.block}
              blockTimeMs={chain!.blockTimeMs}
              position={
                stakes[market.id.toString()]
                  ? {
                      staked:
                        stakes[market.id.toString()]!.yes + stakes[market.id.toString()]!.no,
                      claimable: stakes[market.id.toString()]!.claimable,
                    }
                  : undefined
              }
            />
          ))}
        </div>

        {filtered.length > visible.length && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setLimit((current) => current + PAGE_SIZE)}
              className="raised-quiet rounded-lg border border-line bg-surface px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-hover"
            >
              Show more
              <span className="tabular ml-1.5 text-ink-faint">
                {filtered.length - visible.length}
              </span>
            </button>
          </div>
        )}
      </section>

      <NewMarketDialog
        open={creating}
        onClose={() => setCreating(false)}
        disabled={!HAS_ADDRESS}
        onCreate={(params) =>
          send("Create market", (signer) => writeContract(signer, "createMarket", [params]))
        }
      />

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
