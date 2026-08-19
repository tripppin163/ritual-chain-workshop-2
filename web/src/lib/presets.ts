/** Mirrors DEMO_MARKET in hardhat/scripts/market-presets.ts. */
export const COMPARATOR = { gt: 0, gte: 1, lt: 2, lte: 3 } as const;
export type ComparatorKey = keyof typeof COMPARATOR;

export const COMPARATOR_LABEL: Record<number, string> = {
  0: "＞",
  1: "≥",
  2: "＜",
  3: "≤",
};

export const MARKET_STATE = ["Open", "Closed", "Resolving", "Resolved", "Invalid"] as const;
export const OUTCOME = ["Unresolved", "YES", "NO"] as const;

export const DEMO_MARKET = {
  question: "Will ETH/USD be at least $4,000 when this market resolves?",
  oracleUrl:
    process.env.NEXT_PUBLIC_DEMO_ORACLE_URL ?? "https://your-tunnel.example/api/oracle/eth",
  jsonPath: ".price",
  target: "4000",
  comparator: "gte" as ComparatorKey,
  bettingSeconds: "180",
  resolveDelaySeconds: "60",
} as const;
