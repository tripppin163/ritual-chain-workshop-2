"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { parseEther, type Address } from "viem";
import { predictAbi } from "@/lib/predict-abi";
import { PREDICT_ADDRESS, publicClient } from "@/lib/chain";
import {
  countdown,
  isInvalid,
  isOpen,
  isResolved,
  ritual,
  shortAddress,
  type Market,
} from "@/lib/market";
import { COMPARATOR_LABEL } from "@/lib/presets";
import { AttemptDots, StatePill } from "./StatePill";
import { PoolBar } from "./PoolBar";

export type Stakes = { yes: bigint; no: bigint; settled: boolean; claimable: bigint };

type Props = {
  market: Market;
  block: bigint;
  blockTimeMs: bigint;
  account?: Address;
  stakes?: Stakes;
  compact?: boolean;
  onBet: (marketId: bigint, isYes: boolean, value: bigint) => Promise<void>;
  onClaim: (marketId: bigint, amount: bigint) => Promise<void>;
  onRefund: (marketId: bigint, amount: bigint) => Promise<void>;
};

export function MarketCard({
  market,
  block,
  blockTimeMs,
  account,
  stakes,
  compact = false,
  onBet,
  onClaim,
  onRefund,
}: Props) {
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("0.1");
  const [amountError, setAmountError] = useState<string>();

  const bettingOpen = isOpen(market) && block < market.closeBlock;
  const myStake = stakes ? stakes.yes + stakes.no : 0n;

  async function placeBet() {
    let value: bigint;
    try {
      value = parseEther(amount.trim() as `${number}`);
    } catch {
      setAmountError("Enter an amount like 0.25");
      return;
    }
    if (value <= 0n) {
      setAmountError("A bet needs a stake");
      return;
    }
    setAmountError(undefined);
    await onBet(market.id, side === "yes", value);
  }

  return (
    <article className="card p-5 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[17px] leading-snug font-medium text-balance text-ink sm:text-lg">
            {compact ? (
              market.question
            ) : (
              <Link href={`/market/${market.id.toString()}` as Route} className="transition-opacity hover:opacity-70">
                {market.question}
              </Link>
            )}
          </h3>
          <p className="label mt-1">
            #{market.id.toString()} · by {shortAddress(market.creator)}
          </p>
        </div>
        <StatePill market={market} />
      </header>

      <div className="mt-5">
        <PoolBar market={market} />
      </div>

      {/* The resolution rule, fixed at creation. None of it has a setter. */}
      <dl className="mt-5 space-y-2 text-[13px]">
        <Row label="Settles on">
          <span className="tabular text-ink">
            {market.jsonPath} {COMPARATOR_LABEL[market.comparator]} {market.target.toString()}
          </span>
        </Row>
        <Row label="Oracle">
          <span className="truncate text-ink-soft" title={market.oracleUrl}>
            {market.oracleUrl}
          </span>
        </Row>
        <Row label="Scheduler">
          <span className="text-ink-soft">
            <span className="tabular">block {market.resolveBlock.toString()}</span>
            <span className="ml-2 inline-flex items-center gap-1.5">
              <AttemptDots attempts={market.attempts} />
            </span>
          </span>
        </Row>
        {!isResolved(market) && !isInvalid(market) && (
          <Row label={bettingOpen ? "Betting closes" : "Resolves"}>
            <span className="tabular text-ink-soft">
              in{" "}
              {bettingOpen
                ? countdown(market.closeBlock, block, blockTimeMs)
                : countdown(market.resolveBlock, block, blockTimeMs)}
            </span>
          </Row>
        )}
        {isResolved(market) && (
          <Row label="Observed">
            <span className="tabular font-medium text-accent">
              {market.observedValue.toString()}
            </span>
          </Row>
        )}
        {isInvalid(market) && (
          <Row label="Invalid">
            <span className="text-danger">{market.invalidReason || "no reason recorded"}</span>
          </Row>
        )}
      </dl>

      {myStake > 0n && stakes && (
        <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-[13px] text-ink-soft">
          Your position: <span className="tabular text-ink">{ritual(stakes.yes)}</span> YES ·{" "}
          <span className="tabular text-ink">{ritual(stakes.no)}</span> NO
          {stakes.settled && <span className="ml-2 text-ink-faint">already settled</span>}
        </p>
      )}

      {bettingOpen && account && (
        <div className="mt-5 border-t border-hairline pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="recessed flex rounded-lg bg-surface p-1" role="group" aria-label="Pick a side">
              {(["yes", "no"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSide(option)}
                  aria-pressed={side === option}
                  className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors ${
                    side === option
                      ? "raised-quiet bg-hover text-ink"
                      : "text-ink-faint hover:text-ink-soft"
                  }`}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>

            <label className="sr-only" htmlFor={`amount-${market.id}`}>
              Stake in RITUAL
            </label>
            <input
              id={`amount-${market.id}`}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className="field tabular w-24"
              aria-describedby={amountError ? `amount-error-${market.id}` : undefined}
            />

            <button
              type="button"
              onClick={placeBet}
              className="raised ml-auto rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              Place bet
            </button>
          </div>
          {amountError && (
            <p id={`amount-error-${market.id}`} className="mt-2 text-[13px] text-danger">
              {amountError}
            </p>
          )}
        </div>
      )}

      {!bettingOpen && !isResolved(market) && !isInvalid(market) && (
        <p className="mt-5 flex items-center gap-2 border-t border-hairline pt-5 text-[13px] text-ink-soft">
          <span aria-hidden className="pulse-dot h-1.5 w-1.5 rounded-full bg-warning" />
          Betting is closed. Nobody resolves this: the Scheduler wakes the contract at block{" "}
          <span className="tabular">{market.resolveBlock.toString()}</span>.
        </p>
      )}

      {isResolved(market) && stakes && stakes.claimable > 0n && account && (
        <button
          type="button"
          onClick={() => onClaim(market.id, stakes.claimable)}
          className="raised mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 sm:w-auto"
        >
          Claim {ritual(stakes.claimable)} RITUAL
        </button>
      )}

      {isInvalid(market) && stakes && stakes.claimable > 0n && account && (
        <button
          type="button"
          onClick={() => onRefund(market.id, stakes.claimable)}
          className="raised-quiet mt-5 w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-hover sm:w-auto"
        >
          Refund {ritual(stakes.claimable)} RITUAL
        </button>
      )}
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
      <dt className="label">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** Reads one account's position in one market. */
export async function readStakes(marketId: bigint, account: Address): Promise<Stakes> {
  const [yes, no, settled, claimable] = await publicClient.readContract({
    address: PREDICT_ADDRESS,
    abi: predictAbi,
    functionName: "stakesOf",
    args: [marketId, account],
  });
  return { yes, no, settled, claimable };
}
