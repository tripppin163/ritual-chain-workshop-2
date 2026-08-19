# Ritual Predict — web

The market UI and the demo oracle the markets read.

```
src/app/page.tsx                  markets, chain status, wallet, transaction toasts
src/app/api/oracle/eth/route.ts   the demo oracle a market points at
src/components/MarketCard.tsx     one market: pool, rule, schedule, bet / claim / refund
src/components/CreateMarketForm.tsx
src/components/OraclePreview.tsx  what the executor would read right now
src/lib/chain.ts                  chain config, injected wallet, network switching
src/lib/predict-abi.ts            generated — hardhat/scripts/export-abi.ts
```

## Run it

```bash
cp .env.local.example .env.local     # or let scripts/local-serve.ts write it
npm install
npm run dev
```

Against a local node, `hardhat/scripts/local-serve.ts` writes `.env.local` for you.
See [../FORK-NOTES.md](../FORK-NOTES.md) for the full offline runbook.

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_PREDICT_ADDRESS` | deployed RitualPredict |
| `NEXT_PUBLIC_CHAIN_ID` | `1979` for Ritual Chain, `31337` for a local node |
| `NEXT_PUBLIC_RPC_URL` | RPC the browser reads from |
| `NEXT_PUBLIC_DEMO_ORACLE_URL` | oracle URL prefilled in the create form |
| `ORACLE_UPSTREAM_URL` | upstream the demo oracle reads (defaults to Coinbase spot) |

## The demo oracle

`GET /api/oracle/eth` answers `{"price": 4231, "asOf": "...", "source": "..."}`.

`price` is a **bare integer**: on-chain it is extracted by the jq precompile as a
`uint256`, and `4231.55` is not one. Two upstreams are tried in order, and if both fail
the route answers `503` rather than inventing a number — a market settling on fiction is
worse than a market that refunds everyone.

`?price=4500` forces a value, which is what makes a live demo watchable.

The URL a market stores is fetched **by a TEE executor**, not by the browser, so on
Ritual Chain it has to be publicly reachable — expose this route through a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Against a local node the "executor" is `hardhat/scripts/local-executor.ts` on the same
machine, so `http://127.0.0.1:3000/api/oracle/eth` is correct there.

## Wallet

The app talks to whatever injected wallet is present (`window.ethereum`) and switches
it to the configured chain, adding the network if the wallet does not know it. There is
no wallet-connect stack: one chain, one connector, no dependency tree to audit.
