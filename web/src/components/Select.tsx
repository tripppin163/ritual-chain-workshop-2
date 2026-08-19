"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * A dropdown that belongs to this page rather than to the operating system.
 *
 * A native <select> cannot be styled where it matters — the open list is drawn by the
 * OS, so on a black page it arrives as a white slab with a blue highlight. This is the
 * same control rebuilt from a button and a listbox, with the keyboard behaviour people
 * expect from the native one: arrows move, Enter picks, Escape closes, Home and End
 * jump, and focus returns to the trigger.
 */
export type SelectOption<T extends string> = { value: T; label: string };

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
}: {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => options.findIndex((o) => o.value === value));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      setActive(options.findIndex((option) => option.value === value));
      return setOpen(true);
    }
    if (!open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit(active);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={label}
        onClick={() => {
          setActive(options.findIndex((option) => option.value === value));
          setOpen((current) => !current);
        }}
        className="field flex w-full items-center justify-between gap-2 py-1.5 text-[13px] whitespace-nowrap transition-colors"
      >
        {selected?.label}
        <span
          aria-hidden
          className={`text-ink-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          ⌄
        </span>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          className="card rise absolute right-0 z-50 mt-2 min-w-full overflow-hidden p-1"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => commit(index)}
                  className={`flex w-full items-center justify-between gap-4 rounded-md px-3 py-1.5 text-left text-[13px] whitespace-nowrap transition-colors ${
                    index === active ? "bg-hover text-ink" : "text-ink-soft"
                  }`}
                >
                  {option.label}
                  {isSelected && (
                    <span aria-hidden className="text-accent">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
