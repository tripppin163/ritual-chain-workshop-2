import type { Market } from "@/lib/market";
import { OUTCOME } from "@/lib/presets";

/**
 * Colour never carries meaning on its own here — every state pairs a hue with a glyph
 * and a word, so the interface stays readable for red/green colourblind users.
 */
const PRESETS: Record<
  number,
  { icon: string; text: string; className: string; pulse?: boolean }
> = {
  0: { icon: "◉", text: "Open", className: "text-ritual-green border-ritual-green/30 bg-ritual-green/5" },
  1: { icon: "◌", text: "Closed", className: "text-ritual-gold border-ritual-gold/30 bg-ritual-gold/5", pulse: true },
  2: { icon: "⟳", text: "Resolving", className: "text-ritual-gold border-ritual-gold/30 bg-ritual-gold/5", pulse: true },
  3: { icon: "✓", text: "Resolved", className: "text-ritual-green border-ritual-green/30 bg-ritual-green/5" },
  4: { icon: "⊘", text: "Invalid", className: "text-ritual-red border-ritual-red/30 bg-ritual-red/5" },
};

export function StatePill({ market }: { market: Market }) {
  const preset = PRESETS[market.state] ?? PRESETS[0]!;
  const suffix = market.state === 3 ? ` · ${OUTCOME[market.outcome]}` : "";

  return (
    <span
      role="status"
      aria-label={`Market status: ${preset.text}${suffix}`}
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase ${preset.className}`}
    >
      <span aria-hidden className={preset.pulse ? "pulse-dot" : undefined}>
        {preset.icon}
      </span>
      {preset.text}
      {suffix}
    </span>
  );
}

/** Three booked attempts, drawn as three slots so a retry is visible at a glance. */
export function AttemptDots({ attempts, max = 3 }: { attempts: number; max?: number }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`${attempts} of ${max} resolution attempts used`}
    >
      {Array.from({ length: max }, (_, index) => (
        <span
          key={index}
          aria-hidden
          className={
            index < attempts ? "text-ritual-gold" : "text-ink-faint/40"
          }
        >
          {index < attempts ? "◉" : "◌"}
        </span>
      ))}
    </span>
  );
}
