"use client";

import { useState } from "react";
import type { PricePoint } from "@/lib/events";
import { ritual } from "@/lib/market";

/**
 * The market's price: the YES share of the pool after every bet.
 *
 * One series, so no legend — the title names it, and the last point is labelled
 * directly. A YES/NO pair was the obvious first idea and the wrong one: the second
 * colour would have to be a grey, which reads as "no category" and fails a categorical
 * palette check. One line carries the same information, because NO is its complement.
 */
export function ProbabilityChart({ points }: { points: PricePoint[] }) {
  const [hover, setHover] = useState<number>();

  if (points.length < 2) {
    return (
      <p className="border border-dashed border-hairline px-4 py-8 text-center text-xs text-ink-faint">
        Two bets are needed before there is a price to plot.
      </p>
    );
  }

  const width = 640;
  const height = 190;
  const pad = { top: 14, right: 46, bottom: 26, left: 34 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const firstBlock = Number(points[0]!.block);
  const lastBlock = Number(points[points.length - 1]!.block);
  const span = Math.max(1, lastBlock - firstBlock);

  const x = (block: bigint) => pad.left + ((Number(block) - firstBlock) / span) * plotW;
  const y = (share: number) => pad.top + (1 - share / 100) * plotH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.block)},${y(p.yesShare)}`).join(" ");
  const area =
    `M${x(points[0]!.block)},${pad.top + plotH} ` +
    points.map((p) => `L${x(p.block)},${y(p.yesShare)}`).join(" ") +
    ` L${x(points[points.length - 1]!.block)},${pad.top + plotH} Z`;

  const last = points[points.length - 1]!;
  const active = hover === undefined ? undefined : points[hover];

  return (
    <figure className="m-0">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="label">Implied YES price</span>
        <span className="tabular text-xs text-ink-faint">share of the pool, per bet</span>
      </figcaption>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label={`Implied YES price over time, currently ${last.yesShare.toFixed(1)} percent`}
          onMouseLeave={() => setHover(undefined)}
          onMouseMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const svgX = ((event.clientX - box.left) / box.width) * width;
            let nearest = 0;
            let best = Infinity;
            points.forEach((p, i) => {
              const distance = Math.abs(x(p.block) - svgX);
              if (distance < best) {
                best = distance;
                nearest = i;
              }
            });
            setHover(nearest);
          }}
        >
          {/* Recessive grid: quarters, plus an even-odds reference at 50%. */}
          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={pad.left + plotW}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 50 ? "#27272a" : "#1c1c1f"}
                strokeDasharray={tick === 50 ? "3 3" : undefined}
              />
              <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" className="tabular" fontSize="10" fill="#71717a">
                {tick}
              </text>
            </g>
          ))}

          <path d={area} fill="#fafaf9" opacity="0.09" />
          <path d={line} fill="none" stroke="#fafaf9" strokeWidth="2" strokeLinejoin="round" />

          {active && (
            <>
              <line
                x1={x(active.block)}
                x2={x(active.block)}
                y1={pad.top}
                y2={pad.top + plotH}
                stroke="#27272a"
              />
              {/* 2px surface ring, so the marker stays readable on top of the line. */}
              <circle cx={x(active.block)} cy={y(active.yesShare)} r="6" fill="#111113" />
              <circle cx={x(active.block)} cy={y(active.yesShare)} r="4" fill="#fafaf9" />
            </>
          )}

          {/* The only always-on value label: the current price. */}
          <circle cx={x(last.block)} cy={y(last.yesShare)} r="3.5" fill="#fafaf9" />
          <text
            x={x(last.block) + 8}
            y={y(last.yesShare) + 4}
            className="tabular"
            fontSize="11"
            fill="#fafaf9"
          >
            {last.yesShare.toFixed(1)}%
          </text>

          <text x={pad.left} y={height - 8} className="tabular" fontSize="10" fill="#71717a">
            block {firstBlock}
          </text>
          <text
            x={pad.left + plotW}
            y={height - 8}
            textAnchor="end"
            className="tabular"
            fontSize="10"
            fill="#71717a"
          >
            {lastBlock}
          </text>
        </svg>

        {active && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 border border-hairline bg-canvas/95 px-3 py-2 text-xs"
            style={{
              left: `${Math.min(72, (x(active.block) / width) * 100)}%`,
            }}
          >
            <div className="tabular font-medium text-accent">{active.yesShare.toFixed(1)}% YES</div>
            <div className="tabular mt-0.5 text-ink-faint">
              block {active.block.toString()} · pool {ritual(active.pool)}
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
