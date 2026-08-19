"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { shortAddress } from "@/lib/market";
import { useWallet } from "@/lib/wallet";

const LINKS = [
  { href: "/", label: "Markets" },
  { href: "/how-it-works", label: "How it works" },
] as const;

/** Thin, sticky, and the only place the wallet lives. */
export function Nav() {
  const pathname = usePathname();
  const { account, error, connect } = useWallet();

  return (
    <header className="floating sticky top-0 z-40 border-b border-hairline bg-canvas/70 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-6 px-5 py-3 sm:px-8">
        <Link href="/" className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          Ritual Predict
        </Link>

        <div className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" || pathname.startsWith("/market") : pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href as Route}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                  active ? "bg-surface text-ink" : "text-ink-faint hover:text-ink-soft"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto text-right">
          <button
            type="button"
            onClick={() => void connect().catch(() => undefined)}
            className={
              account
                ? "tabular rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-hover"
                : "raised rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
            }
          >
            {account ? shortAddress(account) : "Connect wallet"}
          </button>
        </div>
      </nav>

      {error && (
        <p className="mx-auto w-full max-w-5xl px-5 pb-2 text-right text-[13px] text-danger sm:px-8">
          {error}
        </p>
      )}
    </header>
  );
}
