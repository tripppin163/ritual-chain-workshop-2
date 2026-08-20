import { explorerTx } from "@/lib/chain";
import { CloseIcon, FailedIcon, PendingIcon, SettledIcon } from "./icons";
import type { Toast } from "@/lib/tx";

export function ToastBar({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const tone =
    toast.kind === "error"
      ? "border-danger/40 text-danger"
      : toast.kind === "done"
        ? "border-accent/40 text-accent"
        : "border-warning/40 text-warning";
  const Icon =
    toast.kind === "error" ? FailedIcon : toast.kind === "done" ? SettledIcon : PendingIcon;
  const link = "hash" in toast && toast.hash ? explorerTx(toast.hash) : undefined;

  return (
    <div
      role="alert"
      className={`fixed inset-x-4 bottom-4 z-50 border bg-elevated px-4 py-3 text-sm shadow-card sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-md ${tone}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 ${toast.kind === "pending" ? "pulse-dot" : ""}`}>
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{toast.label}</p>
          {toast.kind === "error" && <p className="mt-1 text-xs text-ink-soft">{toast.message}</p>}
          {"hash" in toast && toast.hash && (
            <p className="tabular mt-1 truncate text-xs text-ink-faint">
              {link ? (
                <a href={link} target="_blank" rel="noreferrer" className="underline">
                  {toast.hash}
                </a>
              ) : (
                toast.hash
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="mt-0.5 text-ink-faint transition-colors hover:text-ink"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
