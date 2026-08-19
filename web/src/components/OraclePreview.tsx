"use client";

import { useEffect, useState } from "react";

type Payload = { price?: number; asOf?: string; source?: string; note?: string };

/**
 * What the executor would read right now. Worth showing next to the create form: the
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="label">Demo oracle</span>
        <span className={`data text-xs ${ok ? "text-ritual-green" : "text-ritual-gold"}`}>
          <span aria-hidden className="mr-1">{ok ? "✓" : "◌"}</span>
          {status ? `HTTP ${status}` : "…"}
        </span>
      </div>

      <pre className="data overflow-x-auto border border-hairline bg-surface px-3 py-2 text-xs text-ink-soft">
        {error ?? JSON.stringify(payload ?? {}, null, 2)}
      </pre>

      <p className="text-xs text-ink-faint">
        <code className="data text-ritual-lime">.price</code> is pulled out on-chain by the
        jq precompile as a uint256, so it has to stay a bare integer. Add{" "}
        <code className="data">?price=4500</code> to force a value during a demo.
      </p>
    </div>
  );
}
