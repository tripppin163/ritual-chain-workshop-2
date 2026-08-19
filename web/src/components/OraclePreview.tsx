"use client";

import { useOracle } from "@/lib/oracle";

/**
 * The full reading, with the body an executor would receive. Lives on the explainer
 * page; the markets screen carries only the number, in the header strip.
 */
export function OraclePreview() {
  const { reading, status, error, ok } = useOracle();

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[15px] font-medium text-ink">Right now</h3>
        <span className={`inline-flex items-center gap-2 text-[13px] ${ok ? "text-success" : "text-warning"}`}>
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-success" : "bg-warning pulse-dot"}`}
          />
          {status ? `HTTP ${status}` : "reading…"}
        </span>
      </div>

      {reading?.price !== undefined && ok && (
        <p className="tabular mt-4 text-[32px] leading-none font-semibold text-ink">
          {reading.price.toLocaleString("en-US")}
        </p>
      )}

      <pre className="tabular mt-4 overflow-x-auto rounded-lg bg-surface px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
        {error ?? JSON.stringify(reading ?? {}, null, 2)}
      </pre>
    </div>
  );
}
