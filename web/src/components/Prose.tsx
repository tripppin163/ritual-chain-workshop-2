import Link from "next/link";
import type { Route } from "next";
import { BackIcon, PlusIcon } from "./icons";

/** Every page that is not the board opens with the way off it. */
export function BackLink({
  href = "/",
  label = "All markets",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href as Route}
      className="inline-flex items-center gap-2 text-[13px] text-ink-faint transition-colors hover:text-ink"
    >
      <BackIcon />
      {label}
    </Link>
  );
}

/**
 * The pieces the explanatory pages are built from. Shared so /how-it-works,
 * /architecture and /about read as one document rather than three.
 */
export function PageTitle({ title, lead }: { title: string; lead: string }) {
  return (
    <>
      <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.02em] text-ink sm:text-[40px]">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-soft">{lead}</p>
    </>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t border-hairline pt-8">
      <h2 className="text-[15px] font-medium text-ink">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

/**
 * Numbered only where the order is the information — a sequence of steps. A list of
 * things a project contains is not a sequence, and numbering it is decoration.
 */
export function Steps({
  items,
  numbered = true,
}: {
  items: [string, string][];
  numbered?: boolean;
}) {
  const Tag = numbered ? "ol" : "ul";
  return (
    <Tag className="space-y-6">
      {items.map(([title, body], index) => (
        <li key={title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-4">
          <span className="tabular pt-0.5 text-[13px] text-accent">
            {numbered ? String(index + 1).padStart(2, "0") : "—"}
          </span>
          <div>
            <p className="text-[15px] font-medium text-ink">{title}</p>
            <p className="mt-1">{body}</p>
          </div>
        </li>
      ))}
    </Tag>
  );
}

export function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[14px]">
        <tbody>
          {rows.map(([name, meta, what]) => (
            <tr key={name} className="border-b border-hairline last:border-0">
              <th scope="row" className="py-3 pr-4 font-medium whitespace-nowrap text-ink">
                {name}
              </th>
              <td className="tabular py-3 pr-4 whitespace-nowrap text-ink-faint">{meta}</td>
              <td className="py-3">{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Faq({ items }: { items: [string, string][] }) {
  return (
    <div className="divide-y divide-hairline">
      {items.map(([question, answer]) => (
        <details key={question} className="group py-4">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-medium text-ink">
            {question}
            <span className="mt-1 shrink-0 text-ink-faint transition-transform group-open:rotate-45">
              <PlusIcon />
            </span>
          </summary>
          <p className="mt-2 pr-8">{answer}</p>
        </details>
      ))}
    </div>
  );
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="tabular rounded bg-surface px-1.5 py-0.5 text-[13px] text-ink">
      {children}
    </code>
  );
}

export function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent transition-opacity hover:opacity-80"
    >
      {children}
    </a>
  );
}
