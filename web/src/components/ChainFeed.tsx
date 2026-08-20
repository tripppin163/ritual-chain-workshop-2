"use client";

import { useEffect, useRef, useState } from "react";
import type { ChainAction } from "@/lib/chainActivity";
import { ChevronIcon, FailedIcon, RefundIcon, SettledIcon, WakeIcon } from "./icons";

/**
 * What the chain did while nobody was looking.
 *
 * Every line here was written by a scheduled execution, not by a person — that is the
 * one claim this column makes, and why human actions are absent from it. A market
 * being created or bet on is somebody clicking; a market resolving is not.
 *
 * The arrival is the page's authored motion: a line drops in and its accent fades out
 * over a beat. Nothing else on the board moves on its own, so the eye learns that
 * movement here means the chain acted.
 */
const KINDS = {
  woke: { Icon: WakeIcon, tone: "text-accent" },
  failed: { Icon: FailedIcon, tone: "text-warning" },
  settled: { Icon: SettledIcon, tone: "text-success" },
  invalidated: { Icon: RefundIcon, tone: "text-ink-soft" },
} as const;

export function ChainFeed({
  actions,
  executions,
  settledMarkets,
}: {
  actions: ChainAction[];
  executions: number;
  settledMarkets: number;
}) {
  const [open, setOpen] = useState<string>();
  const seen = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const firstRead = useRef(true);

  useEffect(() => {
    const arrived = actions.map((action) => action.key).filter((key) => !seen.current.has(key));
    actions.forEach((action) => seen.current.add(action.key));

    // The first read is history, not news — it should not all flash at once.
    if (firstRead.current) {
      firstRead.current = actions.length === 0;
      return;
    }
    if (arrived.length === 0) return;

    setFresh(new Set(arrived));
    const timer = setTimeout(() => setFresh(new Set()), 2_600);
    return () => clearTimeout(timer);
  }, [actions]);

  return (
    <section aria-label="What the chain did on its own" className="card overflow-hidden">
      <header className="border-b border-hairline px-5 py-4">
        <p className="flex items-baseline gap-2">
          <span className="tabular text-[28px] leading-none font-semibold text-ink">
            {executions}
          </span>
          <span className="text-[13px] text-ink-soft">executions run by the chain</span>
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
          Nobody triggered these. The Scheduler woke the contract, an executor read the
          oracle inside a TEE, and {settledMarkets} market{settledMarkets === 1 ? "" : "s"}{" "}
          settled without a click.
        </p>
      </header>

      {actions.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13px] text-ink-faint">
          Nothing yet. The first market to reach its resolve block shows up here.
        </p>
      ) : (
        <ol className="max-h-[32rem] overflow-y-auto">
          {actions.slice(0, 40).map((action) => {
            const { Icon, tone } = KINDS[action.kind];
            const isOpen = open === action.key;

            return (
              <li
                key={action.key}
                data-fresh={fresh.has(action.key) ? "" : undefined}
                className="chain-row border-b border-hairline last:border-0"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? undefined : action.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-hover/60"
                >
                  <span className={`mt-0.5 ${tone}`}>
                    <Icon />
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink">
                    {action.headline}
                  </span>
                  <span
                    className={`mt-0.5 text-ink-faint transition-transform duration-200 ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  >
                    <ChevronIcon />
                  </span>
                </button>

                {isOpen && (
                  <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-5 pt-1 pb-4 text-[13px]">
                    {action.detail.map((row) => (
                      <div key={row.label} className="contents">
                        <dt className="text-ink-faint">{row.label}</dt>
                        <dd className="tabular break-words text-ink-soft">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
