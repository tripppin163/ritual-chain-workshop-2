"use client";

import { useEffect, useState } from "react";

export type OracleReading = {
  price?: number;
  asOf?: string;
  source?: string;
  note?: string;
};

/** Polls the demo oracle. Shared by the header stat and the full panel. */
export function useOracle(intervalMs = 15_000) {
  const [reading, setReading] = useState<OracleReading>();
  const [status, setStatus] = useState<number>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/oracle/eth", { cache: "no-store" });
        const body = (await response.json()) as OracleReading;
        if (cancelled) return;
        setStatus(response.status);
        setReading(body);
        setError(undefined);
      } catch (loadError) {
        if (!cancelled) setError((loadError as Error).message);
      }
    };

    void load();
    const timer = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return { reading, status, error, ok: status === 200 };
}
