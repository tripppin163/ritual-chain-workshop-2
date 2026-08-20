"use client";

import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  // Full strength where the page is numbers and controls; dimmed where it is prose,
  // because embers drifting behind a paragraph make it harder to read.
  const proseHeavy = pathname !== "/" && !pathname.startsWith("/market");

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
      className="pointer-events-none fixed inset-0 -z-10 transition-opacity duration-700"
      style={{
        opacity: proseHeavy ? 0.18 : 0.55,
        maskImage: "linear-gradient(to bottom, black 0%, black 30%, transparent 72%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 30%, transparent 72%)",
      }}
    >
      <MoltenMetal
        // Two colours, everything else left at the component's own defaults; overriding
        // scale, glow and blackPoint "to taste" once flattened the shader into plain
        // black. The field is silver rather than the preset's orange, because with a
        // monochrome accent an orange sky would be the only hue on the page.
        color1="#000000"
        color2="#fafaf9"
        speed={reducedMotion ? 0 : 0.35}
        mouseInteraction={!reducedMotion}
      />
    </div>
  );
}
