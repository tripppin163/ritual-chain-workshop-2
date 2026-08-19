import type { Route } from "next";
import Link from "next/link";
import { countdown, isInvalid, isResolved, pool, ritual, type Market } from "@/lib/market";
import { COMPARATOR_LABEL, OUTCOME } from "@/lib/presets";

/**
 * One market in a grid of many.
 *
 * Deliberately thin: a question, a price, a state and the one line of timing that
 * matters right now. Everything else — the oracle URL, the schedule, the history, the
 * controls — lives one click away on the market's own page. A hundred of these have to
 * be scannable, and a hundred fully expanded cards are not.
 */
export function MarketTile({
  market,
  block,
  blockTimeMs,
  position,
}: {
  market: Market;
  block: bigint;
  blockTimeMs: bigint;
  position?: { staked: bigint; claimable: bigint };
}) {
  const { total, yesPercent } = pool(market);
  const settled = isResolved(market);
  const invalid = isInvalid(market);
  const yesWon = market.outcome === 1;
  const bettingOpen = market.state === 0 && block < market.closeBlock;

  return (
    <Link
      href={`/market/${market.id.toString()}` as Route}
      className="card rise group flex h-full flex-col p-5 transition-colors hover:border-line"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2">
          <Status market={market} />
          {market.isPrivate && (
            <span
              title="Invite only"
              className="rounded-full bg-surface px-2 py-0.5 text-[12px] text-ink-faint"
            >
              Invite only
            </span>
          )}
        </span>
        {position && position.claimable > 0n && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[12px] font-medium text-accent">
            {ritual(position.claimable)} to claim
          </span>
        )}
      </div>

      <h3 className="mt-3 line-clamp-3 text-[16px] leading-snug font-medium text-balance text-ink">
        {market.question}
      </h3>

      <div className="mt-auto pt-5">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="tabular font-medium text-ink">
            {total === 0n ? "No bets yet" : `${yesPercent.toFixed(0)}% YES`}
          </span>
          <span className="tabular text-ink-faint">{ritual(total)} RITUAL</span>
        </div>

        <div className="recessed mt-2 flex h-1 w-full gap-0.5 overflow-hidden rounded-full bg-canvas" aria-hidden>
          <div
            className={`h-full rounded-full ${settled && !yesWon ? "bg-accent/30" : "bg-accent"}`}
            style={{ width: `${total === 0n ? 0 : yesPercent}%` }}
          />
          <div className={`h-full flex-1 rounded-full ${settled && yesWon ? "bg-line" : "bg-ink-faint"}`} />
        </div>

        <p className="tabular mt-3 truncate text-[13px] text-ink-faint">
          {settled
            ? `${OUTCOME[market.outcome]} · observed ${market.observedValue.toString()}`
            : invalid
              ? market.invalidReason || "could not be resolved"
              : bettingOpen
                ? `Closes in ${countdown(market.closeBlock, block, blockTimeMs)} · ${market.jsonPath} ${COMPARATOR_LABEL[market.comparator]} ${market.target.toString()}`
                : `Resolves in ${countdown(market.resolveBlock, block, blockTimeMs)}`}
        </p>
      </div>
    </Link>
  );
}

function Status({ market }: { market: Market }) {
  const presets: Record<number, { text: string; dot: string; className: string; pulse?: boolean }> = {
    0: { text: "Open", dot: "bg-success", className: "text-success" },
    1: { text: "Closed", dot: "bg-warning", className: "text-warning", pulse: true },
    2: { text: "Resolving", dot: "bg-warning", className: "text-warning", pulse: true },
    3: { text: "Resolved", dot: "bg-success", className: "text-success" },
    4: { text: "Invalid", dot: "bg-danger", className: "text-danger" },
  };
  const preset = presets[market.state] ?? presets[0]!;

  return (
    <span className={`inline-flex items-center gap-2 text-[13px] font-medium ${preset.className}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${preset.dot} ${preset.pulse ? "pulse-dot" : ""}`} />
      {preset.text}
      <span className="tabular font-normal text-ink-faint">#{market.id.toString()}</span>
    </span>
  );
}
