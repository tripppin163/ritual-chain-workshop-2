/**
 * The demo oracle a market points at.
 *
 * A TEE executor fetches this URL from inside an enclave during the scheduled
 * resolution, then the jq precompile pulls `.price` out of the response as a uint256 —
 * so the value must be a bare integer, not a string and not a decimal.
 *
 * Two upstreams are tried in order. One price API being unreachable from wherever this
 * happens to run should not decide a market, and the fallback costs one extra request
 * only when the first source is down.
 *
 * `?price=` forces a value. That is what makes a workshop demo watchable: the same
 * market can be made to resolve YES or NO on demand without waiting for the market to
 * move.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Source = { url: string; extract: (body: unknown) => number };

const SOURCES: Source[] = [
  {
    url: process.env.ORACLE_UPSTREAM_URL ?? "https://api.coinbase.com/v2/prices/ETH-USD/spot",
    extract: (body) => Number((body as { data?: { amount?: string } }).data?.amount),
  },
  {
    url: "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT",
    extract: (body) => Number((body as { price?: string }).price),
  },
];

type Payload = { price: number; asOf: string; source: string; note?: string };

export async function GET(request: Request): Promise<NextResponse<Payload>> {
  const forced = new URL(request.url).searchParams.get("price");
  if (forced !== null && /^\d+$/.test(forced)) {
    return json({
      price: Number(forced),
      asOf: new Date().toISOString(),
      source: "override",
      note: "Forced through ?price= for a demo.",
    });
  }

  const failures: string[] = [];

  for (const source of SOURCES) {
    try {
      const response = await fetch(source.url, {
        cache: "no-store",
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const amount = source.extract(await response.json());
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("no usable price in the body");

      // Whole dollars: the jq precompile is asked for a uint256, and 4231.55 is not one.
      return json({
        price: Math.round(amount),
        asOf: new Date().toISOString(),
        source: source.url,
      });
    } catch (error) {
      failures.push(`${new URL(source.url).host}: ${(error as Error).message}`);
    }
  }

  // Answering with a made-up number would let a market settle on fiction. Reporting the
  // failure is the correct outcome: three of these in a row and the market refunds
  // everyone instead of inventing a winner.
  return NextResponse.json(
    {
      price: 0,
      asOf: new Date().toISOString(),
      source: "none",
      note: `Every upstream failed — ${failures.join("; ")}`,
    },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}

function json(payload: Payload) {
  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
