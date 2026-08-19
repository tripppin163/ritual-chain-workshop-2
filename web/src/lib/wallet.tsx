"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Address } from "viem";
import { connectWallet } from "./chain";

type WalletState = {
  account?: Address;
  error?: string;
  connect: () => Promise<Address>;
};

const WalletContext = createContext<WalletState | undefined>(undefined);

/** One connection for the whole app, so the header and the pages agree on who is signing. */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Address>();
  const [error, setError] = useState<string>();

  const connect = useCallback(async () => {
    try {
      const { account: connected } = await connectWallet();
      setAccount(connected);
      setError(undefined);
      return connected;
    } catch (connectError) {
      setError((connectError as Error).message);
      throw connectError;
    }
  }, []);

  const value = useMemo(() => ({ account, error, connect }), [account, error, connect]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}
