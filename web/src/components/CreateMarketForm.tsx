"use client";

import { MetallicSurface } from "./MetallicSurface";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { activeChain, localChain } from "@/lib/chain";
import { COMPARATOR, COMPARATOR_LABEL, DEMO_MARKET, type ComparatorKey } from "@/lib/presets";
import { Select } from "./Select";

/** Mirrors the contract's own limits, so a bad market is refused before it costs gas. */
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
    viewers: readonly Address[];
  }) => Promise<void>;
};

export function CreateMarketForm({ disabled, onCreate }: Props) {
  const [form, setForm] = useState({ ...DEMO_MARKET });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [guests, setGuests] = useState("");

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  // Only a problem on the real chain, where the executor runs in the cloud. Against a
  // local node the executor is a script on this machine, and localhost is correct.
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

    // Anything separated by a comma, a space or a newline, so a pasted list works.
    const viewers = guests
      .split(/[\s,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (restricted) {
      const bad = viewers.find((entry) => !isAddress(entry));
      if (bad) return setError(`Not a wallet address: ${bad}`);
      if (viewers.length === 0) return setError("Invite at least one wallet, or make it public.");
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
        viewers: restricted ? (viewers as Address[]) : [],
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
          className="field w-full resize-none"
        />
      </Field>

      <Field label="Oracle URL" hint="fetched by a TEE executor, not by your browser">
        <input
          value={form.oracleUrl}
          onChange={(event) => set("oracleUrl")(event.target.value)}
          className="field w-full text-[13px]"
        />
        {localhostOracle && (
          <p className="mt-2 text-[13px] text-warning">
            The executor runs in the cloud, so localhost will never resolve. Expose{" "}
            <code>/api/oracle/eth</code> through a tunnel first.
          </p>
        )}
      </Field>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <Field label="Reads">
          <input
            value={form.jsonPath}
            onChange={(event) => set("jsonPath")(event.target.value)}
            className="field tabular w-full"
          />
        </Field>
        <Field label="Test">
          <Select
            label="Comparison"
            value={form.comparator}
            onChange={(next) => set("comparator")(next)}
            options={(Object.keys(COMPARATOR) as ComparatorKey[]).map((key) => ({
              value: key,
              label: COMPARATOR_LABEL[COMPARATOR[key]] ?? key,
            }))}
            className="w-20"
          />
        </Field>
        <Field label="Target">
          <input
            value={form.target}
            onChange={(event) => set("target")(event.target.value)}
            inputMode="numeric"
            className="field tabular w-full"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Betting" hint="seconds">
          <input
            value={form.bettingSeconds}
            onChange={(event) => set("bettingSeconds")(event.target.value)}
            inputMode="numeric"
            className="field tabular w-full"
          />
        </Field>
        <Field label="Then resolve after" hint="seconds">
          <input
            value={form.resolveDelaySeconds}
            onChange={(event) => set("resolveDelaySeconds")(event.target.value)}
            inputMode="numeric"
            className="field tabular w-full"
          />
        </Field>
      </div>

      <div className="rounded-xl border border-hairline p-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={restricted}
            onChange={(event) => setRestricted(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
          />
          <span>
            <span className="block text-[14px] text-ink">Invite only</span>
            <span className="block text-[13px] text-ink-faint">
              Keeps it off the public board and refuses stakes from anyone else.
            </span>
          </span>
        </label>

        {restricted && (
          <div className="mt-3">
            <textarea
              value={guests}
              onChange={(event) => setGuests(event.target.value)}
              rows={2}
              placeholder="0xabc… 0xdef…"
              className="field tabular w-full resize-none text-[13px]"
              aria-label="Invited wallet addresses"
            />
            <p className="mt-2 text-[13px] text-warning">
              Access control, not privacy: the question and every bet stay readable
              on-chain by anyone.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || busy}
        className="raised relative isolate w-full overflow-hidden rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-faint disabled:shadow-none"
      >
        {/* A disabled button drops to the flat surface fill, so it gets no metal either. */}
        {!(disabled || busy) && <MetallicSurface />}
        <span className="relative">
          {busy ? "Creating…" : disabled ? "Connect a wallet to create" : "Create market"}
        </span>
      </button>

      <p className="label">Books its own resolution in the same transaction.</p>
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
      <span className="text-[13px] text-ink-soft">{label}</span>
      {hint && <span className="ml-1.5 text-[13px] text-ink-faint">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
