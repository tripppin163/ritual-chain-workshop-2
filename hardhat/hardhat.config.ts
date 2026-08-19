import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

// `.env` is not read automatically — without this the documented setup
// (`cp .env.example .env`, then run a script) leaves every variable undefined and the
// deploy asks for a key on stdin. `process.loadEnvFile` is built into Node 20+, so no
// dependency is needed; it throws when the file is absent, which is fine on CI.
try {
  process.loadEnvFile();
} catch {
  // no .env — variables come from the real environment or the Hardhat keystore
}

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    // Ritual Chain testnet. Requires EIP-1559 (type-2) transactions; viem sends
    // those by default.
    ritual: {
      type: "http",
      chainType: "l1",
      chainId: 1979,
      // Overridable so a private testnet or a proxy can be pointed at without editing
      // this file; documented in .env.example.
      url: process.env.RITUAL_RPC_URL ?? "https://rpc.ritualfoundation.org",
      // Named RITUAL_PRIVATE_KEY to match .env.example and the message in
      // scripts/ritual.ts. It used to read DEPLOYER_PRIVATE_KEY, which no other file
      // mentions, so a correctly filled .env still prompted for a key.
      accounts: [configVariable("RITUAL_PRIVATE_KEY")],
    },

    // A local EDR node for the offline runbook: `npx hardhat node` and then
    // `npx hardhat run scripts/local-demo.ts --network localhost`.
    localhost: {
      type: "http",
      chainType: "l1",
      url: process.env.LOCAL_RPC_URL ?? "http://127.0.0.1:8545",
    },
  },
});
