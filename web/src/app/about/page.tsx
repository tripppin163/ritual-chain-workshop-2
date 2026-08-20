import type { Metadata } from "next";
import Link from "next/link";
import { BackLink, Out, PageTitle, Section, Steps } from "@/components/Prose";

export const metadata: Metadata = {
  title: "About — Ritual Predict",
  description: "Why this exists: a Proof of Building for Ritual Academy's second bootcamp.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-28 pb-28 sm:px-8">
      <div className="mb-8">
        <BackLink />
      </div>
      <PageTitle
        title="About"
        lead="This is a Proof of Building for the second Ritual Academy bootcamp, whose workshop built a prediction market that resolves itself on Ritual Chain."
      />

      <Section title="The workshop">
        <p>
          Ritual Academy&apos;s second bootcamp walked through a self-resolving
          prediction market live: a contract that books its own wake-up call with the
          Scheduler, reads an oracle through the HTTP precompile inside a TEE, and
          settles without anyone pressing a button.
        </p>
        <p>
          The session ran out of time before the frontend, which went into the homework
          instead.{" "}
          <Out href="https://x.com/i/broadcasts/1pKdRDDOgBvJW">The recording is here</Out>,
          and the starter repository is{" "}
          <Out href="https://github.com/cozfuttu/ritual-chain-workshop-2">
            cozfuttu/ritual-chain-workshop-2
          </Out>
          .
        </p>
      </Section>

      <Section title="What the starter shipped">
        <p>
          Five functions were left blank — market creation, the Scheduler booking, the
          callback, the oracle read and executor selection. Between them they are the
          entire Ritual surface of the contract; what remained was ordinary Solidity that
          would run on any chain.
        </p>
        <p>
          Its README also documented three files that were not in the repository — the
          mocks and both test suites — and a <code>web/</code> directory that the deploy
          script printed instructions for but that did not exist.
        </p>
      </Section>

      <Section title="What this fork adds">
        <Steps
          numbered={false}
          items={[
            [
              "The five functions",
              "Implemented against the behaviour the README describes, with the reasoning for each decision recorded in the commit rather than left to be guessed.",
            ],
            [
              "The tests the README promised",
              "Mock runtime code placed at Ritual's canonical addresses, then 71 Solidity tests and 5 end-to-end walkthroughs over the real contract.",
            ],
            [
              "A way to run it with the chain down",
              "Scripts that install Ritual's system contracts on a plain Hardhat node and play the two off-chain roles, so the whole lifecycle is demonstrable offline.",
            ],
            [
              "This frontend",
              "The markets board, the market pages, the demo oracle the markets read, and the explainers you are reading now.",
            ],
            [
              "Invite-only markets",
              "The one feature beyond the workshop's contract: a market can name the wallets allowed to bet on it, for a private bet that does not belong on a public board.",
            ],
          ]}
        />
      </Section>

      <Section title="Running it yourself">
        <p>
          Everything runs locally with no testnet and no funded account.{" "}
          <Out href="https://github.com/tripppin163/ritual-chain-workshop-2/blob/main/RUNBOOK.txt">
            RUNBOOK.txt
          </Out>{" "}
          covers starting it, filling the board with test data and clearing it again;{" "}
          <Out href="https://github.com/tripppin163/ritual-chain-workshop-2/blob/main/FORK-NOTES.md">
            FORK-NOTES.md
          </Out>{" "}
          covers what changed and why.
        </p>
      </Section>

      <p className="mt-16 text-[15px]">
        <Link href="/architecture" className="text-accent transition-opacity hover:opacity-80">
          How it is built →
        </Link>
        <span className="mx-3 text-ink-faint">·</span>
        <Link href="/" className="text-accent transition-opacity hover:opacity-80">
          Back to the markets →
        </Link>
      </p>
    </main>
  );
}
