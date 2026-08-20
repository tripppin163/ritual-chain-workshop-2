import type { Market } from "@/lib/market";
import { FailedIcon, PendingIcon, RefundIcon, SettledIcon, StepActiveIcon, StepIcon } from "./icons";

/**
 * Where this market is in the run it books for itself at creation.
 *
 * Ritual's async work is a lifecycle, not a single transaction, and the whole point of
 * this contract is that the middle of it happens with nobody watching. Showing the
 * stages makes the waiting legible instead of looking like a hang.
 */
type StageIcon = typeof StepIcon;

type Stage = {
  key: string;
  label: string;
  detail: string;
  Icon: StageIcon;
  state: "done" | "active" | "ahead" | "failed";
};

export function Lifecycle({ market, block }: { market: Market; block: bigint }) {
  const stages = buildStages(market, block);

  return (
    <ol className="space-y-0" aria-label="Resolution lifecycle">
      {stages.map((stage, index) => (
        <li key={stage.key} className="flex gap-3">
          {/* The rail: a filled dot for what happened, hollow for what has not. */}
          <div className="flex flex-col items-center" aria-hidden>
            <span className={`mt-1 leading-6 ${toneText(stage.state)}`}>
              <span className={stage.state === "active" ? "pulse-dot inline-block" : undefined}>
                <stage.Icon />
              </span>
            </span>
            {index < stages.length - 1 && (
              <span
                className={`w-px flex-1 ${
                  stage.state === "done" ? "bg-success/40" : "bg-line"
                }`}
              />
            )}
          </div>

          <div className={`pb-4 ${stage.state === "ahead" ? "opacity-45" : ""}`}>
            <p className={`text-sm leading-6 ${toneText(stage.state)}`}>{stage.label}</p>
            <p className="tabular text-xs text-ink-faint">{stage.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function toneText(state: Stage["state"]): string {
  if (state === "failed") return "text-danger";
  if (state === "active") return "text-warning";
  if (state === "done") return "text-success";
  return "text-ink-soft";
}

function buildStages(market: Market, block: bigint): Stage[] {
  const closed = block >= market.closeBlock;
  const due = block >= market.resolveBlock;
  const settled = market.state === 3;
  const invalid = market.state === 4;
  const attempts = market.attempts;

  return [
    {
      key: "open",
      label: "Betting open",
      detail: `until block ${market.closeBlock}`,
      Icon: closed ? SettledIcon : StepActiveIcon,
      state: closed ? "done" : "active",
    },
    {
      key: "closed",
      label: "Window closed, waiting for the Scheduler",
      detail: `wakes the contract at block ${market.resolveBlock}`,
      Icon: !closed ? StepIcon : due ? SettledIcon : PendingIcon,
      state: !closed ? "ahead" : due ? "done" : "active",
    },
    {
      key: "attempt",
      label:
        attempts === 0
          ? "Scheduled execution"
          : `Scheduled execution · attempt ${attempts} of 3`,
      detail:
        attempts === 0
          ? "three booked, 200 blocks apart"
          : "each attempt re-rolls the TEE executor",
      Icon: attempts === 0 ? StepIcon : StepActiveIcon,
      state: attempts === 0 ? "ahead" : settled || invalid ? "done" : "active",
    },
    {
      key: "read",
      label: "Oracle read inside a TEE",
      detail:
        settled && market.observedValue !== 0n
          ? `HTTP 0x0801 → jq 0x0803 → ${market.observedValue.toString()}`
          : "HTTP 0x0801 → jq 0x0803 → one number",
      Icon: settled ? SettledIcon : invalid ? FailedIcon : StepIcon,
      state: settled ? "done" : invalid ? "failed" : "ahead",
    },
    {
      key: "settled",
      label: invalid ? "Invalid · everyone refunds" : "Settled",
      detail: invalid
        ? market.invalidReason || "the oracle could not be read"
        : settled
          ? "winners claim their share of the pool"
          : "outcome recorded on-chain",
      Icon: invalid ? RefundIcon : settled ? SettledIcon : StepIcon,
      state: invalid ? "failed" : settled ? "done" : "ahead",
    },
  ];
}
