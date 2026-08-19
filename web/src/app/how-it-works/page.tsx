import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works — Ritual Predict",
  description:
    "What happens between a bet and a settled market, and why no server is involved.",
};

/**
 * Everything explanatory lives here rather than on the markets screen, which is for
 * doing things. Static by design: nothing on this page reads the chain.
 */
export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-14 pb-28 sm:px-8">
      <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.02em] text-ink sm:text-[40px]">
        How it works
      </h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
        A market here decides its own outcome. Nobody presses resolve, no backend cron
        runs, and no oracle network is subscribed to. The contract books its own wake-up
        call at creation and reads the answer itself.
      </p>

      <Section title="The loop">
        <Steps
          items={[
            [
              "Someone creates a market",
              "A question, a URL to read, a path into that URL's JSON, a target and a comparison. In the same transaction the contract asks Ritual's Scheduler to wake it three times, starting at the block where betting ends.",
            ],
            [
              "Anyone bets",
              "Native RITUAL on YES or NO. Both sides pool together, so the split between them is the market's price.",
            ],
            [
              "Betting closes on its own",
              "The deadline is a block number, not a clock reading, so the close and the wake-up can never disagree.",
            ],
            [
              "The Scheduler wakes the contract",
              "A system contract on Ritual calls back into the market at the booked block. This is the step that would be a server anywhere else.",
            ],
            [
              "The oracle is read inside a TEE",
              "The HTTP precompile fetches the URL from inside a trusted execution environment, and the jq precompile pulls one number out of the response. Both happen inside that single scheduled transaction.",
            ],
            [
              "The market settles",
              "The number is compared to the target, the outcome is recorded, and winners pull their share of the pool. Nothing loops over participants, so no market can be too large to settle.",
            ],
          ]}
        />
      </Section>

      <Section title="What runs on-chain">
        <Table
          rows={[
            ["HTTP precompile", "0x0801", "Fetches the oracle URL from inside a TEE"],
            ["jq precompile", "0x0803", "Extracts one uint256 from the response body"],
            ["Scheduler", "0x56e7…D58B", "Wakes the contract at a chosen block, three times"],
            ["RitualWallet", "0x532F…3948", "Holds the prepaid fees each execution draws from"],
            ["TEE registry", "0x9644…F47F", "Hands out an attested executor, re-rolled per attempt"],
          ]}
        />
      </Section>

      <Section title="When the oracle does not answer">
        <p>
          A failure is never read as NO. A precompile that fails, a non-200 response, an
          error from the executor, a malformed envelope and a body that will not parse are
          all treated the same way: as an attempt that did not happen.
        </p>
        <p>
          Three attempts are booked at creation, 200 blocks apart, and each one asks the
          registry for a fresh executor so a single unhealthy node cannot sink a market.
          If all three fail the market becomes invalid and every stake is refundable.
        </p>
      </Section>

      <Section title="The demo oracle">
        <p>
          The bundled oracle at <Code>/api/oracle/eth</Code> answers with a whole number,
          because the jq precompile extracts it as a <Code>uint256</Code> and 4231.55 is
          not one. It reads a live ETH price, tries a second source if the first is down,
          and answers <Code>503</Code> rather than inventing a value — a market settling
          on fiction is worse than one that refunds everyone.
        </p>
        <p>
          Add <Code>?price=4500</Code> to force a value, which is what makes a live demo
          watchable.
        </p>
        <p>
          On Ritual Chain the URL is fetched by an executor in the cloud, so it has to be
          publicly reachable. Against a local node the executor is a script on the same
          machine, and localhost is correct.
        </p>
      </Section>

      <Section title="Questions">
        <Faq
          items={[
            [
              "Who can change a market's rule after it is created?",
              "Nobody. The URL, the path, the target, the comparison and the resolve block have no setter. They are emitted as an event at creation and that is the record.",
            ],
            [
              "What if nobody backs the winning side?",
              "Pari-mutuel has no denominator to divide by, so the outcome still stands and is recorded, but the market becomes refundable instead of paying out.",
            ],
            [
              "Why block numbers instead of timestamps?",
              "The Scheduler fires at a block, so betting closes at a block too. Anything else lets the two disagree when block times drift.",
            ],
            [
              "Who pays for the resolution?",
              "The contract does, from a balance prepaid into RitualWallet. Fees are taken at execution time, not when the market is created.",
            ],
            [
              "Can I run all of this without the testnet?",
              "Yes. The repository ships a local runbook: the Ritual system contracts are installed on a plain Hardhat node, and a script plays the Scheduler and the TEE executor.",
            ],
          ]}
        />
      </Section>

      <p className="mt-16 text-[15px]">
        <Link href="/" className="text-accent transition-opacity hover:opacity-80">
          Back to the markets →
        </Link>
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t border-hairline pt-8">
      <h2 className="text-[15px] font-medium text-ink">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: [string, string][] }) {
  return (
    <ol className="space-y-6">
      {items.map(([title, body], index) => (
        <li key={title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-4">
          <span className="tabular pt-0.5 text-[13px] text-accent">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <p className="text-[15px] font-medium text-ink">{title}</p>
            <p className="mt-1">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[14px]">
        <tbody>
          {rows.map(([name, address, what]) => (
            <tr key={name} className="border-b border-hairline last:border-0">
              <th scope="row" className="py-3 pr-4 font-medium whitespace-nowrap text-ink">
                {name}
              </th>
              <td className="tabular py-3 pr-4 whitespace-nowrap text-ink-faint">{address}</td>
              <td className="py-3">{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Faq({ items }: { items: [string, string][] }) {
  return (
    <div className="divide-y divide-hairline">
      {items.map(([question, answer]) => (
        <details key={question} className="group py-4">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-medium text-ink">
            {question}
            <span
              aria-hidden
              className="mt-1 shrink-0 text-ink-faint transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="mt-2 pr-8">{answer}</p>
        </details>
      ))}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="tabular rounded bg-surface px-1.5 py-0.5 text-[13px] text-ink">
      {children}
    </code>
  );
}
