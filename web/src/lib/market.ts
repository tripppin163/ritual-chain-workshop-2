import { formatEther } from "viem";
import { MARKET_STATE } from "./presets";

/** The Market struct as viem decodes it from getMarket / getMarkets. */
export type Market = {
  id: bigint;
  creator: `0x${string}`;
  question: string;
  oracleUrl: string;
  jsonPath: string;
  target: bigint;
  comparator: number;
  closeBlock: bigint;
  resolveBlock: bigint;
  scheduleId: bigint;
  totalYes: bigint;
  totalNo: bigint;
  state: number;
  outcome: number;
  attempts: number;
  observedValue: bigint;
  invalidReason: string;
  isPrivate: boolean;
};

export const isOpen = (m: Market) => m.state === 0;
export const isResolved = (m: Market) => m.state === 3;
export const isInvalid = (m: Market) => m.state === 4;
export const stateLabel = (m: Market) => MARKET_STATE[m.state] ?? "Unknown";

export function pool(m: Market) {
  const total = m.totalYes + m.totalNo;
  const yesPercent = total === 0n ? 50 : Number((m.totalYes * 10_000n) / total) / 100;
  return { total, yesPercent };
}

/** Blocks are the contract's unit of time; seconds are only for humans. */
export function blocksToSeconds(blocks: bigint, blockTimeMs: bigint): number {
  return (Number(blocks) * Number(blockTimeMs)) / 1000;
}

export function countdown(target: bigint, current: bigint, blockTimeMs: bigint): string {
  if (current >= target) return "now";
  const seconds = Math.round(blocksToSeconds(target - current, blockTimeMs));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export const ritual = (amount: bigint) => `${trimZeros(formatEther(amount))}`;

function trimZeros(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/\.?0+$/, "");
}

export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
