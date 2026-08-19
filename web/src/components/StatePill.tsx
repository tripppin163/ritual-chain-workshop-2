import type { Market } from "@/lib/market";
import { OUTCOME } from "@/lib/presets";

/**
 * State never rides on colour alone: every pill carries a dot, a word, and for a
 * settled market its outcome. Colourblind readers and greyscale screenshots both work.
 */
const PRESETS: Record<
  number,
  { text: string; dot: string; className: string; pulse?: boolean }
> = {
  0: { text: "Open", dot: "bg-success", className: "text-success", pulse: false },
  1: { text: "Closed", dot: "bg-warning", className: "text-warning", pulse: true },
  2: { text: "Resolving", dot: "bg-warning", className: "text-warning", pulse: true },
  3: { text: "Resolved", dot: "bg-success", className: "text-success" },
  4: { text: "Invalid", dot: "bg-danger", className: "text-danger" },
};

export function StatePill({ market }: { market: Market }) {
  const preset = PRESETS[market.state] ?? PRESETS[0]!;
  const suffix = market.state === 3 ? ` · ${OUTCOME[market.outcome]}` : "";

  return (
    <span
      role="status"
      aria-label={`Market status: ${preset.text}${suffix}`}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full bg-surface px-3 py-1 text-[13px] font-medium ${preset.className}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${preset.dot} ${preset.pulse ? "pulse-dot" : ""}`}
      />
      {preset.text}
      {suffix}
    </span>
  );
}

/** Three booked attempts, drawn as three slots so a retry is visible at a glance. */
export function AttemptDots({ attempts, max = 3 }: { attempts: number; max?: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 align-middle"
      aria-label={`${attempts} of ${max} resolution attempts used`}
    >
      {Array.from({ length: max }, (_, index) => (
        <span
          key={index}
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${
            index < attempts ? "bg-warning" : "bg-line"
          }`}
        />
      ))}
    </span>
  );
}
