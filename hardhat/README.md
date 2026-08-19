# Ritual Predict — contracts

The `RitualPredict` market contract, its tests, and the deployment scripts.
Full architecture and the workshop runbook live in [../README.md](../README.md).

## Layout

```
contracts/
  RitualPredict.sol          the market: creation, betting, autonomous resolution, payouts
  RitualPredict.t.sol        Solidity unit tests
  ritual/RitualChain.sol     canonical Ritual addresses + system contract interfaces
  mocks/RitualMocks.sol      test-only stand-ins for the precompiles and system contracts
test/
  RitualPredict.e2e.ts       end-to-end walkthroughs of the workshop flow
scripts/
  block-time.ts              measure the chain's current block time
  deploy.ts                  deploy + prepay execution fees
  fund.ts                    top up the prepaid execution balance
  status.ts                  live state of every market
  create-demo-market.ts      create the preset market from the CLI
  export-abi.ts              copy the compiled ABI into the frontend
  local-stack.ts             install the Ritual system contracts on a plain EVM node
  local-demo.ts              the whole lifecycle, narrated, with no network
  local-serve.ts             set up a local chain for the frontend
  local-executor.ts          play Scheduler + TEE executor locally
```

## Commands

```bash
cp .env.example .env                            # RITUAL_PRIVATE_KEY, funded from the faucet

npx hardhat test                                # 65 Solidity + 4 TypeScript tests
npx hardhat test solidity                       # Solidity only
npx hardhat build                               # compile
npx tsc --noEmit                                # typecheck scripts and tests

npx hardhat run scripts/block-time.ts           # measure block time
npx hardhat run scripts/deploy.ts               # deploy to Ritual Chain
PREDICT_ADDRESS=0x... npx hardhat run scripts/status.ts
PREDICT_ADDRESS=0x... npx hardhat run scripts/fund.ts
```

Tests run entirely against mocks — `vm.etch` puts the mock runtime code at the canonical Ritual
addresses — so no network access or funded account is needed.

## Offline

With the testnet unreachable, the same lifecycle runs against a local node:

```bash
npx hardhat node                                # terminal 1
npx hardhat run scripts/local-demo.ts           # terminal 2 — creates, bets, resolves, pays

# or, to drive it from the UI:
npx hardhat run scripts/local-serve.ts          # writes ../web/.env.local
PREDICT_ADDRESS=0x... npx hardhat run scripts/local-executor.ts
```

See [../FORK-NOTES.md](../FORK-NOTES.md).
