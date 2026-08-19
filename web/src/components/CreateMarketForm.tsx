"use client";

import { useState } from "react";
import { activeChain, localChain } from "@/lib/chain";
import { COMPARATOR, COMPARATOR_LABEL, DEMO_MARKET, type ComparatorKey } from "@/lib/presets";

/** Mirrors the contract's own limits so a bad market is refused before it costs gas. */
const MIN_BETTING_SECONDS = 30;
const MIN_RESOLVE_DELAY_SECONDS = 15;
const MAX_MARKET_SECONDS = 86_400;

type Props = {
  disabled: boolean;
  onCreate: (params: {
    question: string;
    oracleUrl: string;
    jsonPath: string;
    target: bigint;
    comparator: number;
    bettingSeconds: bigint;
    resolveDelaySeconds: bigint;
  }) => Promise<void>;
};

export function CreateMarketForm({ disabled, onCreate }: Props) {
  const [form, setForm] = useState({ ...DEMO_MARKET });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  // Only a problem on the real chain: there the executor runs in the cloud. Against a
  // local node the "executor" is scripts/local-executor.ts on this machine, and
  // localhost is exactly where it should point.
  const localhostOracle =
    activeChain.id !== localChain.id && /localhost|127\.0\.0\.1/.test(form.oracleUrl);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    const betting = Number(form.bettingSeconds);
    const delay = Number(form.resolveDelaySeconds);

    if (!form.question.trim() || !form.oracleUrl.trim() || !form.jsonPath.trim()) {
      return setError("Question, oracle URL and JSON path are all required.");
    }
    if (!/^\d+$/.test(form.target)) return setError("The target must be a whole number.");
    if (!Number.isFinite(betting) || betting < MIN_BETTING_SECONDS) {
      return setError(`Betting must stay open for at least ${MIN_BETTING_SECONDS}s.`);
    }
    if (!Number.isFinite(delay) || delay < MIN_RESOLVE_DELAY_SECONDS) {
      return setError(`The resolve delay must be at least ${MIN_RESOLVE_DELAY_SECONDS}s.`);
    }
    if (betting + delay > MAX_MARKET_SECONDS) {
      return setError("A market cannot run longer than a day.");
    }

    setBusy(true);
    try {
      await onCreate({
        question: form.question.trim(),
        oracleUrl: form.oracleUrl.trim(),
        jsonPath: form.jsonPath.trim(),
        target: BigInt(form.target),
        comparator: COMPARATOR[form.comparator],
        bettingSeconds: BigInt(betting),
        resolveDelaySeconds: BigInt(delay),
      });
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Question">
        <textarea
          value={form.question}
          onChange={(event) => set("question")(event.target.value)}
          rows={2}
          className="w-full resize-none border border-hairline bg-surface px-3 py-2 text-sm text-ink"
        />
      </Field>

      <Field label="Oracle URL" hint="fetched by a TEE executor, not by your browser">
        <input
          value={form.oracleUrl}
          onChange={(event) => set("oracleUrl")(event.target.value)}
          className="data w-full border border-hairline bg-surface px-3 py-2 text-xs text-ink"
        />
        {localhostOracle && (
          <p className="mt-1.5 text-xs text-ritual-gold">
            <span aria-hidden className="mr-1">◌</span>
            The executor runs in the cloud, so localhost will never resolve. Expose{" "}
            <code className="data">/api/oracle/eth</code> through a tunnel first.
          </p>
        )}
      </Field>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <Field label="JSON path">
          <input
            value={form.jsonPath}
            onChange={(event) => set("jsonPath")(event.target.value)}
            className="data w-full border border-hairline bg-surface px-3 py-2 text-sm text-ink"
          />
        </Field>
        <Field label="Test">
          <select
            value={form.comparator}
            onChange={(event) => set("comparator")(event.target.value as ComparatorKey)}
            className="data border border-hairline bg-surface px-2 py-2 text-sm text-ink"
          >
            {(Object.keys(COMPARATOR) as ComparatorKey[]).map((key) => (
              <option key={key} value={key}>
                {COMPARATOR_LABEL[COMPARATOR[key]]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Target">
          <input
            value={form.target}
            onChange={(event) => set("target")(event.target.value)}
            inputMode="numeric"
            className="data w-full border border-hairline bg-surface px-3 py-2 text-sm text-ink"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Betting" hint="seconds">
          <input
            value={form.bettingSeconds}
            onChange={(event) => set("bettingSeconds")(event.target.value)}
            inputMode="numeric"
            className="data w-full border border-hairline bg-surface px-3 py-2 text-sm text-ink"
          />
        </Field>
        <Field label="Then resolve after" hint="seconds">
          <input
            value={form.resolveDelaySeconds}
            onChange={(event) => set("resolveDelaySeconds")(event.target.value)}
            inputMode="numeric"
            className="data w-full border border-hairline bg-surface px-3 py-2 text-sm text-ink"
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="text-xs text-ritual-red">
          <span aria-hidden className="mr-1">✗</span>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || busy}
        className="w-full border border-ritual-green px-4 py-2.5 text-sm font-semibold text-ritual-green transition-colors hover:bg-ritual-green/10 disabled:cursor-not-allowed disabled:border-hairline disabled:text-ink-faint"
      >
        {busy ? "Creating…" : disabled ? "Connect a wallet to create" : "Create market"}
      </button>
      <p className="text-xs text-ink-faint">
        Creating a market books its own resolution with the Scheduler in the same
        transaction: three attempts, 200 blocks apart, paid from the contract's prepaid
        balance.
      </p>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {hint && <span className="ml-2 text-[11px] text-ink-faint lowercase">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
