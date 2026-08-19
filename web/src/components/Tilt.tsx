"use client";

import { useEffect, useRef } from "react";

/**
 * Gives a card a little depth: it leans toward the pointer and carries a sheen that
 * follows it.
 *
 * Kept to a few degrees on purpose. Past that a card stops reading as a surface and
 * starts reading as a toy, and the numbers printed on it are the product.
 *
 * Written straight to CSS custom properties inside a rAF rather than through React
 * state, so a mousemove never triggers a render. Skipped entirely for coarse pointers
 * and for anyone who asked for reduced motion.
 */
export function Tilt({
  children,
  className = "",
  max = 4,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const interactive = window.matchMedia("(hover: hover) and (pointer: fine)");
    const stillness = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!interactive.matches || stillness.matches) return;

    let frame = 0;
    let pending: { x: number; y: number } | undefined;

    const apply = () => {
      frame = 0;
      if (!pending) return;
      const { x, y } = pending;
      element.style.setProperty("--tilt-x", `${(0.5 - y) * 2 * max}deg`);
      element.style.setProperty("--tilt-y", `${(x - 0.5) * 2 * max}deg`);
      element.style.setProperty("--sheen-x", `${x * 100}%`);
      element.style.setProperty("--sheen-y", `${y * 100}%`);
      element.style.setProperty("--sheen-opacity", "1");
    };

    const onMove = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      pending = {
        x: (event.clientX - box.left) / box.width,
        y: (event.clientY - box.top) / box.height,
      };
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      pending = undefined;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      element.style.setProperty("--tilt-x", "0deg");
      element.style.setProperty("--tilt-y", "0deg");
      element.style.setProperty("--sheen-opacity", "0");
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [max]);

  return (
    <div ref={ref} className={`tilt ${className}`.trim()}>
      <div className="tilt-inner">
        {children}
        <span aria-hidden className="tilt-sheen" />
      </div>
    </div>
  );
}
