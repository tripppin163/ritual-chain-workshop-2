"use client";

import MoltenMetal from "./reactbits/MoltenMetal";

/**
 * The molten field, poured into something small.
 *
 * The page's own field runs black with silver streaks; a control filled that way would
 * swallow its own label, so the palette inverts here: a light body with darker veins,
 * dark type on top. Same material, lit from the other side.
 *
 * Each instance is its own WebGL context, so this belongs on the few controls that
 * carry the page — not on every button in a list.
 */
export function MoltenSurface({
  speed = 0.22,
  className = "",
}: {
  speed?: number;
  className?: string;
}) {
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <MoltenMetal
        color1="#9ca3af"
        color2="#ffffff"
        color3="#ffffff"
        speed={speed}
        mouseInteraction={false}
        grain={false}
        brightness={1.15}
        blackPoint={0.02}
      />
    </span>
  );
}
