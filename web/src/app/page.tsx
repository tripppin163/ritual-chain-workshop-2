"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEther, type Address } from "viem";
import { predictAbi } from "@/lib/predict-abi";
import {
  HAS_ADDRESS,
  PREDICT_ADDRESS,
  RPC_URL,
  activeChain,
  connectWallet,
  explorerTx,
  publicClient,
} from "@/lib/chain";
import { ritual, shortAddress, type Market } from "@/lib/market";
import { MarketCard, readStakes, type Stakes } from "@/components/MarketCard";
import { CreateMarketForm } from "@/components/CreateMarketForm";
import { OraclePreview } from "@/components/OraclePreview";

type ChainState = {
  block: bigint;
  blockTimeMs: bigint;
  executionBalance: bigint;
  markets: readonly Market[];
};

type Toast =
  | { kind: "pending"; label: string; hash?: `0x${string}` }
  | { kind: "done"; label: string; hash: `0x${string}` }
  | { kind: "error"; label: string; message: string };

export default function Page() {
  const [chain, setChain] = useState<ChainState>();
  const [stakes, setStakes] = useState<Record<string, Stakes>>({});
  const [account, setAccount] = useState<Address>();
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<Toast>();

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
            async (market) => [market.id.toString(), await readStakes(market.id, account)] as const,
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

  /** One place where a write is sent, watched to a receipt, and reported. */
  const send = useCallback(
    async (label: string, run: (account: Address) => Promise<`0x${string}`>) => {
      try {
        const { account: signer } = await connectWallet();
        setAccount(signer);
        setToast({ kind: "pending", label });
        const hash = await run(signer);
        setToast({ kind: "pending", label, hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") throw new Error("the transaction reverted");
        setToast({ kind: "done", label, hash });
        await refresh();
      } catch (sendError) {
        const raw = (sendError as { shortMessage?: string; message?: string });
        setToast({ kind: "error", label, message: raw.shortMessage ?? raw.message ?? "failed" });
      }
    },
    [refresh],
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
      <header className="pt-12 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl">
            <p className="label text-ritual-green">Ritual Chain · self-resolving</p>
            <h1 className="mt-2 font-display text-4xl leading-[0.95] tracking-tight text-ink sm:text-5xl">
              RITUAL PREDICT
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Stake on a yes-or-no question. When the betting window closes nobody presses
              resolve and no backend cron runs: the Scheduler wakes the contract, the HTTP
              precompile reads the oracle inside a TEE, jq pulls out one number, and the
              market settles itself.
            </p>
          </div>

          <WalletButton account={account} onConnect={setAccount} />
        </div>

        <div className="rule-line mt-8" />

        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-xs">
          <Stat label="Chain">
            {activeChain.name} <span className="text-ink-faint">· {activeChain.id}</span>
          </Stat>
          <Stat label="Block">{chain ? chain.block.toString() : "—"}</Stat>
          <Stat label="Contract">
            {HAS_ADDRESS ? shortAddress(PREDICT_ADDRESS) : "not configured"}
          </Stat>
          <Stat label="Prepaid fees">
            {chain ? `${formatEther(chain.executionBalance)} RITUAL` : "—"}
          </Stat>
          <Stat label="Block time">
            {chain ? `${chain.blockTimeMs.toString()} ms` : "—"}
          </Stat>
        </dl>
      </header>

      {!HAS_ADDRESS && <SetupPanel />}
      {HAS_ADDRESS && error && <ErrorPanel message={error} />}

      <div className="grid gap-8 lg:grid-cols-[1.55fr_1fr]">
        <section id="markets" className="space-y-5">
          <h2 className="label">Markets</h2>

          {chain?.markets.length === 0 && (
            <p className="border border-dashed border-hairline px-5 py-10 text-center text-sm text-ink-faint">
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

          {!chain && HAS_ADDRESS && !error && (
            <p className="text-sm text-ink-faint">Reading the chain…</p>
          )}
        </section>

        <aside className="space-y-8 lg:sticky lg:top-8 lg:self-start">
          <section className="border border-hairline bg-elevated/80 p-5 shadow-card">
            <h2 className="label mb-4">New market</h2>
            <CreateMarketForm
              disabled={!HAS_ADDRESS}
              onCreate={(params) =>
                send(`Create "${params.question.slice(0, 32)}…"`, (signer) =>
                  writeContract(signer, "createMarket", [params]),
                )
              }
            />
          </section>

          <section className="border border-hairline bg-elevated/80 p-5 shadow-card">
            <OraclePreview />
          </section>
        </aside>
      </div>

      {toast && <ToastBar toast={toast} onDismiss={() => setToast(undefined)} />}
    </main>
  );
}

/** Typed once per function so no call site has to cast. */
async function writeContract(
  account: Address,
  functionName: "bet" | "claimWinnings" | "claimRefund" | "createMarket",
  args: readonly unknown[],
  value?: bigint,
): Promise<`0x${string}`> {
  const { client } = await connectWallet();
  const { request } = await publicClient.simulateContract({
    address: PREDICT_ADDRESS,
    abi: predictAbi,
    functionName,
    args,
    account,
    value,
  } as Parameters<typeof publicClient.simulateContract>[0]);
  return client.writeContract(request as Parameters<typeof client.writeContract>[0]);
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="data mt-1 text-ink">{children}</dd>
    </div>
  );
}

function WalletButton({
  account,
  onConnect,
}: {
  account?: Address;
  onConnect: (account: Address) => void;
}) {
  const [error, setError] = useState<string>();

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={async () => {
          try {
            const { account: connected } = await connectWallet();
            onConnect(connected);
            setError(undefined);
          } catch (connectError) {
            setError((connectError as Error).message);
          }
        }}
        className="border border-ritual-green px-4 py-2.5 text-sm font-semibold text-ritual-green transition-colors hover:bg-ritual-green/10"
      >
        {account ? shortAddress(account) : "Connect wallet"}
      </button>
      {error && <p className="mt-2 max-w-[16rem] text-xs text-ritual-red">{error}</p>}
    </div>
  );
}

function SetupPanel() {
  return (
    <section className="mb-8 border border-ritual-gold/30 bg-ritual-gold/5 p-5">
      <h2 className="font-display text-sm tracking-wide text-ritual-gold">
        <span aria-hidden className="mr-2">◌</span>No contract configured
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        Deploy the contract, then put its address in <code className="data">web/.env.local</code>:
      </p>
      <pre className="data mt-3 overflow-x-auto border border-hairline bg-surface px-3 py-2 text-xs text-ink-soft">
{`# against Ritual Chain
cd hardhat && npx hardhat run scripts/deploy.ts

# or entirely offline, against a local node
cd hardhat && npx hardhat node
npx hardhat run scripts/local-demo.ts

NEXT_PUBLIC_PREDICT_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545`}
      </pre>
    </section>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <section role="alert" className="mb-8 border border-ritual-red/30 bg-ritual-red/5 p-5">
      <h2 className="font-display text-sm tracking-wide text-ritual-red">
        <span aria-hidden className="mr-2">✗</span>Cannot read the chain
      </h2>
      <p className="mt-2 text-sm text-ink-soft">{message}</p>
      <p className="data mt-2 text-xs text-ink-faint">{RPC_URL}</p>
    </section>
  );
}

function ToastBar({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const tone =
    toast.kind === "error"
      ? "border-ritual-red/40 text-ritual-red"
      : toast.kind === "done"
        ? "border-ritual-green/40 text-ritual-green"
        : "border-ritual-gold/40 text-ritual-gold";
  const icon = toast.kind === "error" ? "✗" : toast.kind === "done" ? "✓" : "◌";
  const link = "hash" in toast && toast.hash ? explorerTx(toast.hash) : undefined;

  return (
    <div
      role="alert"
      className={`fixed inset-x-4 bottom-4 z-50 border bg-elevated px-4 py-3 text-sm shadow-card sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-md ${tone}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className={toast.kind === "pending" ? "pulse-dot" : undefined}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{toast.label}</p>
          {toast.kind === "error" && <p className="mt-1 text-xs text-ink-soft">{toast.message}</p>}
          {"hash" in toast && toast.hash && (
            <p className="data mt-1 truncate text-xs text-ink-faint">
              {link ? (
                <a href={link} target="_blank" rel="noreferrer" className="underline">
                  {toast.hash}
                </a>
              ) : (
                toast.hash
              )}
            </p>
          )}
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-ink-faint">
          ✕
        </button>
      </div>
    </div>
  );
}
