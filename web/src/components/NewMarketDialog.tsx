"use client";

import { useEffect, useRef } from "react";
import { CreateMarketForm } from "./CreateMarketForm";

/**
 * Creating a market is a rare action, so it does not get to hold a third of the screen
 * permanently. Native <dialog> rather than a hand-rolled overlay: focus trapping,
 * Escape, inertness of the page behind it and the top layer all come for free.
 */
export function NewMarketDialog({
  open,
  onClose,
  onCreate,
  disabled,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: React.ComponentProps<typeof CreateMarketForm>["onCreate"];
  disabled: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // Clicking the backdrop lands on the dialog element itself, never on its content.
        if (event.target === ref.current) onClose();
      }}
      aria-label="Create a market"
      className="card w-[min(34rem,calc(100vw-2rem))] p-0 text-ink backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <h2 className="text-[15px] font-medium">New market</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg px-2 py-1 text-ink-faint transition-colors hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
        <CreateMarketForm
          disabled={disabled}
          onCreate={async (params) => {
            await onCreate(params);
            onClose();
          }}
        />
      </div>
    </dialog>
  );
}
