import type { Market } from "@/lib/market";
import { pool, ritual } from "@/lib/market";

/**
 * Pari-mutuel, so the bar is the market: the split is the price. Green marks the YES
 * side; the NO side stays neutral rather than borrowing a colour that means something
 * else in this system. After settlement the losing side dims out.
 */
export function PoolBar({ market }: { market: Market }) {
  const { total, yesPercent } = pool(market);
  const settled = market.state === 3;
  const yesWon = market.outcome === 1;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="label">Pool</span>
        <span className="data text-sm text-ritual-lime">{ritual(total)} RITUAL</span>
      </div>

      <div className="mt-2 flex h-2 w-full overflow-hidden bg-surface" aria-hidden>
        <div
          className={`h-full transition-all duration-500 ${
            settled && !yesWon ? "bg-ritual-green/25" : "bg-ritual-green"
          }`}
          style={{ width: `${total === 0n ? 50 : yesPercent}%` }}
        />
        <div
          className={`h-full flex-1 transition-all duration-500 ${
            settled && yesWon ? "bg-ink-faint/25" : "bg-ink-faint"
          }`}
        />
      </div>

      <div className="mt-1.5 flex items-baseline justify-between text-xs">
        <span className={settled && !yesWon ? "text-ink-faint" : "text-ritual-green"}>
          YES {ritual(market.totalYes)}
          <span className="data ml-1.5 text-ink-faint">
            {total === 0n ? "—" : `${yesPercent.toFixed(1)}%`}
          </span>
        </span>
        <span className={settled && yesWon ? "text-ink-faint" : "text-ink-soft"}>
          <span className="data mr-1.5 text-ink-faint">
            {total === 0n ? "—" : `${(100 - yesPercent).toFixed(1)}%`}
          </span>
          NO {ritual(market.totalNo)}
        </span>
      </div>
    </div>
  );
}
