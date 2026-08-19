import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Address,
  type WalletClient,
} from "viem";

/** Ritual Chain testnet. Block time is ~195 ms, so polling is cheap and confirmations are fast. */
export const ritualChain = defineChain({
  id: 1979,
  name: "Ritual Chain",
  nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.ritualfoundation.org"] } },
  blockExplorers: {
    default: { name: "Ritual Explorer", url: "https://explorer.ritualfoundation.org" },
  },
});

/** A local `npx hardhat node` with the Ritual system contracts installed by scripts/local-stack.ts. */
export const localChain = defineChain({
  id: 31337,
  name: "Local Hardhat",
  nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 1979);
export const activeChain = CHAIN_ID === localChain.id ? localChain : ritualChain;

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? activeChain.rpcUrls.default.http[0]!;

export const PREDICT_ADDRESS = (process.env.NEXT_PUBLIC_PREDICT_ADDRESS ?? "") as Address;
export const HAS_ADDRESS = /^0x[0-9a-fA-F]{40}$/.test(PREDICT_ADDRESS);

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(RPC_URL),
});

export function explorerTx(hash: string): string | undefined {
  const base = activeChain.blockExplorers?.default.url;
  return base ? `${base}/tx/${hash}` : undefined;
}

type Ethereum = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export function getInjected(): Ethereum | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Ethereum }).ethereum;
}

/**
 * Connects the injected wallet and makes sure it is on the chain this build talks to.
 * A wallet pointed at a different chain would sign transactions nobody can settle.
 */
export async function connectWallet(): Promise<{ client: WalletClient; account: Address }> {
  const ethereum = getInjected();
  if (!ethereum) throw new Error("No injected wallet found. Install MetaMask or Rabby.");

  const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as Address[];
  const account = accounts[0];
  if (!account) throw new Error("The wallet returned no accounts.");

  const chainIdHex = `0x${activeChain.id.toString(16)}`;
  const current = (await ethereum.request({ method: "eth_chainId" })) as string;
  if (current.toLowerCase() !== chainIdHex) {
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: activeChain.name,
            nativeCurrency: activeChain.nativeCurrency,
            rpcUrls: [RPC_URL],
            blockExplorerUrls: activeChain.blockExplorers
              ? [activeChain.blockExplorers.default.url]
              : undefined,
          },
        ],
      });
    }
  }

  return {
    client: createWalletClient({ account, chain: activeChain, transport: custom(ethereum) }),
    account,
  };
}
