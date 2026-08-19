import type { MarketEvent } from "@/lib/events";
import { shortAddress } from "@/lib/market";

const TONE: Record<MarketEvent["tone"], { icon: string; className: string }> = {
  neutral: { icon: "·", className: "text-ink-soft" },
  good: { icon: "✓", className: "text-success" },
  warn: { icon: "◌", className: "text-warning" },
  bad: { icon: "✗", className: "text-danger" },
};

/** Everything the market did, read from its own logs. No indexer, no backend. */
export function Timeline({ events }: { events: MarketEvent[] }) {
  if (events.length === 0) {
    return <p className="text-xs text-ink-faint">No events yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => {
        const tone = TONE[event.tone];
        return (
          <li
            key={`${event.block}-${event.logIndex}`}
            className="grid grid-cols-[auto_1fr] gap-3 border-l border-hairline pl-3"
          >
            <span aria-hidden className={`text-sm leading-5 ${tone.className}`}>
              {tone.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-5 text-ink">{event.text}</p>
              {event.detail && (
                <p className="tabular truncate text-xs text-ink-faint" title={event.detail}>
                  {event.detail}
                </p>
              )}
              <p className="tabular mt-0.5 text-[11px] text-ink-faint">
                block {event.block.toString()}
                {event.actor && ` · ${shortAddress(event.actor)}`}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
