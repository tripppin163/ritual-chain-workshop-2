"use client";

import { useEffect, useState } from "react";

type Payload = { price?: number; asOf?: string; source?: string; note?: string };

/**
 * What the executor would read right now. Worth showing beside the create form: the
 * market's whole outcome hangs on this one number surviving the jq extraction as an
 * integer.
 */
export function OraclePreview() {
  const [payload, setPayload] = useState<Payload>();
  const [status, setStatus] = useState<number>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/oracle/eth", { cache: "no-store" });
        const body = (await response.json()) as Payload;
        if (cancelled) return;
        setStatus(response.status);
        setPayload(body);
        setError(undefined);
      } catch (loadError) {
        if (!cancelled) setError((loadError as Error).message);
      }
    };

    void load();
    const timer = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const ok = status === 200;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-medium text-ink">Demo oracle</h2>
        <span
          className={`inline-flex items-center gap-2 text-[13px] ${ok ? "text-success" : "text-warning"}`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-success" : "bg-warning pulse-dot"}`}
          />
          {status ? `HTTP ${status}` : "reading…"}
        </span>
      </div>

      {payload?.price !== undefined && ok && (
        <p className="tabular mt-4 text-[32px] leading-none font-semibold text-ink">
          {payload.price.toLocaleString("en-US")}
        </p>
      )}

      <pre className="tabular mt-4 overflow-x-auto rounded-lg bg-surface px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
        {error ?? JSON.stringify(payload ?? {}, null, 2)}
      </pre>

      <p className="label mt-3">What an executor would read right now.</p>
    </div>
  );
}
