import type { Metadata } from "next";
import Link from "next/link";
import { Code, Out, PageTitle, Section, Table } from "@/components/Prose";

export const metadata: Metadata = {
  title: "Architecture — Ritual Predict",
  description: "The contract, the precompiles it calls, and how it all runs without a chain.",
};

export default function ArchitecturePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-28 pb-28 sm:px-8">
      <PageTitle
        title="Architecture"
        lead="One contract, four of Ritual's own capabilities, and no server anywhere. This is what sits underneath the screen you just came from."
      />

      <Section title="The contract">
        <p>
          <Code>RitualPredict.sol</Code> holds every market, every stake and the rule each
          market settles by. A market moves through five states: open, closed, resolving,
          then either resolved or invalid.
        </p>
        <p>
          Every deadline is a <strong className="text-ink">block number</strong>, never a
          timestamp. The Scheduler fires at a block, so betting has to close at a block
          too — anything else lets the two disagree the moment block times drift. Human
          durations are converted once, at creation, using the block time measured from
          the live chain at deploy.
        </p>
        <p>
          Payouts are pull-based and loop-free: a winner claims{" "}
          <Code>stake × pool ÷ winning side</Code> for themselves. Nothing iterates over
          participants, so no market can grow too large to settle.
        </p>
        <p>
          The resolution rule has no setter. The oracle URL, the JSON path, the target,
          the comparison and the resolve block are fixed when the market is created and
          emitted as an event. There is no admin key that can move them afterwards.
        </p>
      </Section>

      <Section title="What it calls">
        <Table
          rows={[
            ["HTTP precompile", "0x0801", "13-field request; GET, no secrets, TTL in blocks"],
            ["jq precompile", "0x0803", "Query plus body, asked for a uint256; called through STATICCALL"],
            ["Scheduler", "0x56e7…D58B", "schedule(): 3 calls, 200 blocks apart, TTL 150, payer is the contract"],
            ["RitualWallet", "0x532F…3948", "Prepaid balance every scheduled execution draws from"],
            ["TEE registry", "0x9644…F47F", "pickServiceByCapability with a per-attempt seed and 8 probes"],
          ]}
        />
        <p>
          The HTTP call and the jq extraction both happen inside the one transaction the
          Scheduler triggers. The contract never learns anything asynchronously — by the
          time its callback returns, the market has settled or the attempt has failed.
        </p>
      </Section>

      <Section title="The scheduled resolution">
        <p>
          Creating a market books its own resolution in the same transaction. Three
          executions are reserved up front, so a market that cannot be read on the first
          try still has two more chances without anyone intervening.
        </p>
        <p>
          The callback is deliberately revert-free for everything except an
          authorisation failure. A revert would roll back the attempt counter, and a
          market whose counter never advances can never reach invalid — the stakes would
          sit in the contract permanently. Unknown market, early trigger, already
          settled: all of them return quietly instead.
        </p>
        <p>
          Each attempt asks the registry for a fresh executor, seeded with the market id,
          the execution index and the block number, so one unhealthy node cannot sink a
          market by being picked three times.
        </p>
      </Section>

      <Section title="Running it without the chain">
        <p>
          Ritual&apos;s capabilities live at fixed addresses, so a local node has none of
          them — the contract cannot even deploy, because its constructor calls the
          Scheduler. The repository installs mock runtime code{" "}
          <em>at those exact addresses</em>: <Code>vm.etch</Code> in the Solidity tests,{" "}
          <Code>hardhat_setCode</Code> in TypeScript.
        </p>
        <p>
          What runs on top is the real contract, the real encoding and the real callback
          path. Only the two off-chain roles are stood in for, by a script that watches
          for markets due to resolve, fetches each one&apos;s oracle URL over real HTTP,
          and drives the execution.
        </p>
        <p>
          That is the whole reason this is demonstrable while the testnet is unreachable.
        </p>
      </Section>

      <Section title="Tests">
        <p>
          71 Solidity tests and 5 end-to-end walkthroughs, none of which need an RPC or a
          funded account. The properties worth naming: a failed oracle read is never
          recorded as NO, the attempt counter always advances, a settled market ignores
          leftover executions, and a winner can never claim more than the pool.
        </p>
      </Section>

      <Section title="Known limits">
        <p>
          <Code>getMarkets()</Code> returns every market with no pagination. Fine for a
          workshop, wrong for a chain with real usage; the frontend pages client-side,
          which is a patch over the contract rather than a fix in it.
        </p>
        <p>
          The contract is unaudited workshop code and has never been deployed to Ritual
          Chain — the testnet was unreachable throughout. Every claim here is backed by a
          local run.
        </p>
        <p>
          Invite-only markets are access control, not privacy. The question and every bet
          stay readable on-chain by anyone.
        </p>
      </Section>

      <p className="mt-16 text-[15px]">
        <Out href="https://github.com/tripppin163/ritual-chain-workshop-2">
          Read the source →
        </Out>
        <span className="mx-3 text-ink-faint">·</span>
        <Link href="/how-it-works" className="text-accent transition-opacity hover:opacity-80">
          How a market settles →
        </Link>
      </p>
    </main>
  );
}
