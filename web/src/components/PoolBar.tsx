import type { Market } from "@/lib/market";
import { pool, ritual } from "@/lib/market";

/**
 * Pari-mutuel, so the split is the price. Accent marks the YES side; NO stays neutral
 * rather than borrowing a status colour that means something else. After settlement the
 * losing side recedes instead of disappearing.
 */
export function PoolBar({ market }: { market: Market }) {
  const { total, yesPercent } = pool(market);
  const settled = market.state === 3;
  const yesWon = market.outcome === 1;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[15px] font-medium text-ink">
          <span className="tabular">{ritual(total)}</span>{" "}
          <span className="text-ink-faint">RITUAL in the pool</span>
        </span>
      </div>

      <div className="mt-3 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            settled && !yesWon ? "bg-accent/30" : "bg-accent"
          }`}
          style={{ width: `${total === 0n ? 50 : yesPercent}%` }}
        />
        <div
          className={`h-full flex-1 rounded-full transition-all duration-500 ${
            settled && yesWon ? "bg-line" : "bg-ink-faint"
          }`}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between text-[13px]">
        <span className={settled && !yesWon ? "text-ink-faint" : "text-ink-soft"}>
          <span className="tabular font-medium text-ink">
            {total === 0n ? "—" : `${yesPercent.toFixed(0)}%`}
          </span>{" "}
          YES · {ritual(market.totalYes)}
        </span>
        <span className={settled && yesWon ? "text-ink-faint" : "text-ink-soft"}>
          NO · {ritual(market.totalNo)}{" "}
          <span className="tabular font-medium text-ink">
            {total === 0n ? "—" : `${(100 - yesPercent).toFixed(0)}%`}
          </span>
        </span>
      </div>
    </div>
  );
}
