"use client";

import type { Market } from "@/lib/market";
import { MetallicSurface } from "./MetallicSurface";
import { Select } from "./Select";

export const FILTERS = [
  { key: "all", label: "All", match: () => true },
  { key: "open", label: "Open", match: (m: Market) => m.state === 0 },
  { key: "awaiting", label: "Awaiting", match: (m: Market) => m.state === 1 || m.state === 2 },
  { key: "resolved", label: "Resolved", match: (m: Market) => m.state === 3 },
  { key: "invalid", label: "Invalid", match: (m: Market) => m.state === 4 },
] as const;

export type FilterKey = (typeof FILTERS)[number]["key"];
export type SortKey = "newest" | "closing" | "pool";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "closing", label: "Resolving soonest" },
  { key: "pool", label: "Largest pool" },
];

/**
 * Two markets need no toolbar and a hundred are unusable without one, so this exists
 * for the second case: narrow by state, find by wording, order by what matters.
 * Counts sit on the tabs because "Open 3" answers the question the tab is asking.
 */
export function MarketToolbar({
  markets,
  filter,
  onFilter,
  query,
  onQuery,
  sort,
  onSort,
  onCreate,
}: {
  markets: readonly Market[];
  filter: FilterKey;
  onFilter: (key: FilterKey) => void;
  query: string;
  onQuery: (value: string) => void;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  onCreate: () => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 lg:flex-nowrap">
      <div className="recessed flex shrink-0 flex-wrap gap-1 rounded-lg bg-surface p-1" role="tablist" aria-label="Filter markets">
        {FILTERS.map((option) => {
          const count = markets.filter(option.match).length;
          const active = filter === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilter(option.key)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                active ? "raised-quiet bg-hover text-ink" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              {option.label}
              <span className="tabular ml-1.5 text-ink-faint">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
        <label className="sr-only" htmlFor="market-search">
          Search markets
        </label>
        <input
          id="market-search"
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search questions"
          className="field w-full py-1.5 text-[13px] sm:w-44"
        />

        <Select
          label="Sort markets"
          value={sort}
          onChange={onSort}
          options={SORTS.map((option) => ({ value: option.key, label: option.label }))}
          className="w-44 shrink-0"
        />

        <button
          type="button"
          onClick={onCreate}
          className="raised relative isolate overflow-hidden rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-opacity hover:opacity-90"
        >
          <MetallicSurface />
          <span className="relative text-canvas">New market</span>
        </button>
      </div>
    </div>
  );
}

/** Sort comparators, kept beside the labels they belong to. */
export function sortMarkets(markets: readonly Market[], sort: SortKey): Market[] {
  const copy = [...markets];
  if (sort === "pool") {
    return copy.sort((a, b) => Number(b.totalYes + b.totalNo - (a.totalYes + a.totalNo)));
  }
  if (sort === "closing") {
    // Unsettled first, soonest resolve block leading; settled markets keep newest-first.
    return copy.sort((a, b) => {
      const aPending = a.state !== 3 && a.state !== 4;
      const bPending = b.state !== 3 && b.state !== 4;
      if (aPending !== bPending) return aPending ? -1 : 1;
      if (aPending) return Number(a.resolveBlock - b.resolveBlock);
      return Number(b.id - a.id);
    });
  }
  return copy.sort((a, b) => Number(b.id - a.id));
}
