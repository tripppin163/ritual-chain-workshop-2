import type { MarketEvent } from "@/lib/events";
import { shortAddress } from "@/lib/market";
import { FailedIcon, PendingIcon, SettledIcon, StepIcon } from "./icons";

const TONE = {
  neutral: { Icon: StepIcon, className: "text-ink-faint" },
  good: { Icon: SettledIcon, className: "text-success" },
  warn: { Icon: PendingIcon, className: "text-warning" },
  bad: { Icon: FailedIcon, className: "text-danger" },
} as const;

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
            <span className={`mt-0.5 ${tone.className}`}>
              <tone.Icon />
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
