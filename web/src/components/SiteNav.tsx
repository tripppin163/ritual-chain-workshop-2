"use client";

import Link from "next/link";
import { shortAddress } from "@/lib/market";
import { useWallet } from "@/lib/wallet";
import CardNav, { type CardNavItem } from "./reactbits/CardNav";
import { DocsIcon, PageIcon, RepoIcon, SiteIcon, SocialIcon } from "./icons";

/**
 * The header: a bar that opens into three cards.
 *
 * Everything that is not a market lives behind it — the explainers, Ritual's own
 * documentation, and the source. That keeps the markets screen about markets while
 * still putting the context one click away, which is the whole reason a visitor who
 * has never heard of Ritual can land here and work out what they are looking at.
 */
const ITEMS: CardNavItem[] = [
  {
    label: "This build",
    bgColor: "#141417",
    textColor: "#fafaf9",
    links: [
      {
        label: "How it works",
        href: "/how-it-works",
        ariaLabel: "How a market settles itself",
        icon: <PageIcon />,
      },
      {
        label: "Architecture",
        href: "/architecture",
        ariaLabel: "The contracts and precompiles behind it",
        icon: <PageIcon />,
      },
      {
        label: "About",
        href: "/about",
        ariaLabel: "What this project is",
        icon: <PageIcon />,
      },
    ],
  },
  {
    label: "Ritual",
    bgColor: "#17171b",
    textColor: "#fafaf9",
    links: [
      {
        label: "ritual.net",
        href: "https://ritual.net",
        ariaLabel: "Ritual's site",
        external: true,
        icon: <SiteIcon />,
      },
      {
        label: "Documentation",
        href: "https://docs.ritualfoundation.org",
        ariaLabel: "Ritual Chain documentation",
        external: true,
        icon: <DocsIcon />,
      },
      {
        label: "@ritualnet",
        href: "https://x.com/ritualnet",
        ariaLabel: "Ritual on X",
        external: true,
        icon: <SocialIcon />,
      },
    ],
  },
  {
    label: "Source",
    bgColor: "#1a1a1f",
    textColor: "#fafaf9",
    links: [
      {
        label: "This fork",
        href: "https://github.com/tripppin163/ritual-chain-workshop-2",
        ariaLabel: "The fork on GitHub",
        external: true,
        icon: <RepoIcon />,
      },
      {
        label: "Workshop starter",
        href: "https://github.com/cozfuttu/ritual-chain-workshop-2",
        ariaLabel: "The workshop's starter repository",
        external: true,
        icon: <RepoIcon />,
      },
      {
        label: "ritual-net",
        href: "https://github.com/ritual-net",
        ariaLabel: "Ritual on GitHub",
        external: true,
        icon: <RepoIcon />,
      },
    ],
  },
];

export function SiteNav() {
  const { account, connect } = useWallet();

  return (
    <CardNav
      items={ITEMS}
      baseColor="#111113"
      menuColor="#a1a1aa"
      ease="power3.out"
      className="[&_.card-nav]:border [&_.card-nav]:border-hairline"
      logoNode={
        <Link
          href="/"
          aria-label="Ritual Predict — back to the markets"
          className="text-[19px] font-semibold tracking-[-0.02em] whitespace-nowrap text-ink transition-opacity hover:opacity-80 sm:text-[21px]"
        >
          Ritual Predict
        </Link>
      }
      cta={
        <button
          type="button"
          onClick={() => void connect().catch(() => undefined)}
          className={
            account
              ? "tabular rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-medium whitespace-nowrap text-ink transition-colors hover:bg-hover"
              : "raised rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap text-canvas transition-opacity hover:opacity-90"
          }
        >
          {account ? shortAddress(account) : "Connect wallet"}
        </button>
      }
    />
  );
}
