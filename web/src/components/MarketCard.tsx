"use client";

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
    <article className="border border-hairline bg-elevated/80 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="data text-xs text-ink-faint">#{market.id.toString()}</span>
            <span className="text-ink-faint">·</span>
            <span className="data text-xs text-ink-faint">
              by {shortAddress(market.creator)}
            </span>
          </div>
          <h3 className="mt-1.5 font-display text-lg leading-snug text-ink text-balance">
            {market.question}
          </h3>
        </div>
        <StatePill market={market} />
      </header>

      <div className="space-y-5 px-5 py-5">
        <PoolBar market={market} />

        {/* The resolution rule, fixed at creation. There is no setter for any of it. */}
        <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-[auto_1fr]">
          <dt className="label">Rule</dt>
          <dd className="data text-ink">
            <span className="text-ritual-lime">{market.jsonPath}</span>{" "}
            {COMPARATOR_LABEL[market.comparator]} {market.target.toString()}
          </dd>

          <dt className="label">Oracle</dt>
          <dd className="data truncate text-ink-soft" title={market.oracleUrl}>
            <span aria-hidden className="mr-1.5 text-ritual-green">⇄</span>
            {market.oracleUrl}
          </dd>

          <dt className="label">Schedule</dt>
          <dd className="data text-ink-soft">
            <span aria-hidden className="mr-1.5 text-ritual-gold">◎</span>
            id {market.scheduleId.toString()} · fires at block{" "}
            {market.resolveBlock.toString()} <AttemptDots attempts={market.attempts} />
          </dd>

          {market.state !== 3 && market.state !== 4 && (
            <>
              <dt className="label">Timing</dt>
              <dd className="data text-ink-soft">
                {bettingOpen
                  ? `betting closes in ${countdown(market.closeBlock, block, blockTimeMs)}`
                  : `resolution in ${countdown(market.resolveBlock, block, blockTimeMs)}`}
              </dd>
            </>
          )}

          {isResolved(market) && (
            <>
              <dt className="label">Observed</dt>
              <dd className="data text-ritual-lime">
                {market.observedValue.toString()}
                <span className="ml-2 text-ink-faint">read in the scheduled transaction</span>
              </dd>
            </>
          )}

          {isInvalid(market) && (
            <>
              <dt className="label">Invalid</dt>
              <dd className="text-ritual-red">
                <span aria-hidden className="mr-1.5">✗</span>
                {market.invalidReason || "no reason recorded"}
              </dd>
            </>
          )}
        </dl>

        {myStake > 0n && (
          <p className="border-l-2 border-ritual-green/40 pl-3 text-xs text-ink-soft">
            Your stake: <span className="data text-ink">{ritual(stakes!.yes)}</span> YES ·{" "}
            <span className="data text-ink">{ritual(stakes!.no)}</span> NO
            {stakes!.settled && <span className="ml-2 text-ink-faint">(already settled)</span>}
          </p>
        )}

        {/* Actions follow the lifecycle: bet, then wait, then claim. */}
        {bettingOpen && account && (
          <div className="space-y-3 border-t border-hairline pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex" role="group" aria-label="Pick a side">
                {(["yes", "no"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSide(option)}
                    aria-pressed={side === option}
                    className={`border px-4 py-2 text-sm font-semibold tracking-wide uppercase transition-colors ${
                      side === option
                        ? "border-ritual-green bg-ritual-green/10 text-ritual-green"
                        : "border-hairline text-ink-faint hover:border-ink-faint"
                    } ${option === "no" ? "-ml-px" : ""}`}
                  >
                    {option}
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
                className="data w-28 border border-hairline bg-surface px-3 py-2 text-sm text-ink"
                aria-describedby={amountError ? `amount-error-${market.id}` : undefined}
              />
              <span className="text-xs text-ink-faint">RITUAL</span>

              <button
                type="button"
                onClick={placeBet}
                className="ml-auto border border-ritual-green px-4 py-2 text-sm font-semibold text-ritual-green transition-colors hover:bg-ritual-green/10"
              >
                Place bet
              </button>
            </div>
            {amountError && (
              <p id={`amount-error-${market.id}`} className="text-xs text-ritual-red">
                {amountError}
              </p>
            )}
          </div>
        )}

        {!bettingOpen && !isResolved(market) && !isInvalid(market) && (
          <p className="flex items-center gap-2 border-t border-hairline pt-4 text-xs text-ritual-gold">
            <span aria-hidden className="pulse-dot">◌</span>
            Betting is closed. Nobody resolves this — the Scheduler wakes the contract at
            block {market.resolveBlock.toString()}.
          </p>
        )}

        {isResolved(market) && stakes && stakes.claimable > 0n && account && (
          <button
            type="button"
            onClick={() => onClaim(market.id, stakes.claimable)}
            className="w-full border border-ritual-green px-4 py-2.5 text-sm font-semibold text-ritual-green transition-colors hover:bg-ritual-green/10 sm:w-auto"
          >
            Claim {ritual(stakes.claimable)} RITUAL
          </button>
        )}

        {isInvalid(market) && stakes && stakes.claimable > 0n && account && (
          <button
            type="button"
            onClick={() => onRefund(market.id, stakes.claimable)}
            className="w-full border border-dashed border-ritual-gold px-4 py-2.5 text-sm font-semibold text-ritual-gold transition-colors hover:bg-ritual-gold/10 sm:w-auto"
          >
            Refund {ritual(stakes.claimable)} RITUAL
          </button>
        )}
      </div>
    </article>
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
