"use client";

import { useEffect, useState } from "react";
import MoltenMetal from "./reactbits/MoltenMetal";

/**
 * The molten field the page sits on.
 *
 * Fixed behind everything and inert to the pointer, masked so it is strongest behind
 * the header and gone by the time the market cards start — a shader that keeps moving
 * under a column of numbers makes them harder to read, and the numbers are the product.
 *
 * Motion is the part people opt out of, not the colour, so a reduced-motion visitor
 * still gets the field: it just stops moving.
 */
export function SiteBackground() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        maskImage: "linear-gradient(to bottom, black 0%, black 45%, transparent 88%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 45%, transparent 88%)",
      }}
    >
      <MoltenMetal
        // Exactly the parameters from the chosen preset: two colours, everything else
        // left at the component's own defaults. An earlier pass overrode scale, glow
        // and blackPoint "to taste" and flattened the shader into plain black.
        color1="#000000"
        color2="#ff6800"
        speed={reducedMotion ? 0 : 0.35}
        mouseInteraction={!reducedMotion}
      />
    </div>
  );
}
