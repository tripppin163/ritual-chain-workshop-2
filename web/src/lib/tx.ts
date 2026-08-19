"use client";

import { useCallback, useState } from "react";
import type { Address } from "viem";
import { predictAbi } from "./predict-abi";
import { PREDICT_ADDRESS, connectWallet, publicClient } from "./chain";
import { useWallet } from "./wallet";

export type Toast =
  | { kind: "pending"; label: string; hash?: `0x${string}` }
  | { kind: "done"; label: string; hash: `0x${string}` }
  | { kind: "error"; label: string; message: string };

export type WriteName = "bet" | "claimWinnings" | "claimRefund" | "createMarket";

/**
 * Simulate, then send. The simulation is what turns a revert into a readable message
 * before the wallet ever opens, instead of a failed transaction the user pays for.
 */
export async function writeContract(
  account: Address,
  functionName: WriteName,
  args: readonly unknown[],
  value?: bigint,
): Promise<`0x${string}`> {
  const { client } = await connectWallet();
  const { request } = await publicClient.simulateContract({
    address: PREDICT_ADDRESS,
    abi: predictAbi,
    functionName,
    args,
    account,
    value,
  } as Parameters<typeof publicClient.simulateContract>[0]);
  return client.writeContract(request as Parameters<typeof client.writeContract>[0]);
}

/** One place where a write is sent, watched to a receipt, and reported. */
export function useTransactions(onSettled: () => Promise<void> | void) {
  const [toast, setToast] = useState<Toast>();
  const { account, connect } = useWallet();

  const send = useCallback(
    async (label: string, run: (account: Address) => Promise<`0x${string}`>) => {
      try {
        const signer = await connect();
        setToast({ kind: "pending", label });

        const hash = await run(signer);
        setToast({ kind: "pending", label, hash });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted") throw new Error("the transaction reverted");

        setToast({ kind: "done", label, hash });
        await onSettled();
      } catch (error) {
        const raw = error as { shortMessage?: string; message?: string };
        setToast({ kind: "error", label, message: raw.shortMessage ?? raw.message ?? "failed" });
      }
    },
    [onSettled, connect],
  );

  return { toast, dismiss: () => setToast(undefined), send, account };
}
