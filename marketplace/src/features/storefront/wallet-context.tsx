"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { connectShopWallet, injectedProvider, readShopWallet, shopWalletAddress } from "@/app/x402/shop-wallet";
import { toast } from "sonner";

type WalletState = Awaited<ReturnType<typeof connectShopWallet>>;
type WalletContextValue = {
  connected?: WalletState;
  setConnected: (value: WalletState) => void;
  disconnect: () => void;
  connect: (chooseAccount?: boolean) => Promise<void>;
  connecting: boolean;
  walletError: string;
};
const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connected, setWallet] = useState<WalletState>();
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState("");
  const generation = useRef(0);
  const current = useRef<WalletState | undefined>(undefined);
  const following = useRef(false);
  const connectingRef = useRef(false);
  const syncing = useRef<number | undefined>(undefined);

  const publish = useCallback((wallet?: WalletState) => {
    current.current = wallet;
    setWallet(wallet);
  }, []);

  useEffect(() => {
    const provider = injectedProvider();
    let disposed = false;
    async function sync(replace = false) {
      if (!following.current || connectingRef.current || (!replace && syncing.current !== undefined)) return;
      const revision = ++generation.current;
      syncing.current = revision;
      if (replace) { publish(); setWalletError(""); }
      try {
        const address = await shopWalletAddress();
        if (disposed || generation.current !== revision) return;
        if (!address) { publish(); return; }
        if (current.current?.address.toLowerCase() === address.toLowerCase()) return;
        publish();
        const wallet = await readShopWallet(address);
        if (disposed || generation.current !== revision) return;
        const authorized = await shopWalletAddress();
        if (!disposed && generation.current === revision && authorized?.toLowerCase() === address.toLowerCase()) {
          publish(wallet);
          setWalletError("");
        }
      } catch {
        if (!disposed && generation.current === revision) publish();
      } finally {
        if (syncing.current === revision) syncing.current = undefined;
      }
    }
    const changed = () => { void sync(true); };
    const checkVisible = () => { if (document.visibilityState === "visible") void sync(); };
    const events = ["accountsChanged", "chainChanged", "disconnect"];
    for (const event of events) provider?.on?.(event, changed);
    window.addEventListener("focus", checkVisible);
    document.addEventListener("visibilitychange", checkVisible);
    const interval = window.setInterval(checkVisible, 2000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkVisible);
      document.removeEventListener("visibilitychange", checkVisible);
      for (const event of events) provider?.removeListener?.(event, changed);
    };
  }, [publish]);

  async function connect(chooseAccount = false) {
    if (connectingRef.current) return;
    const revision = ++generation.current;
    const wasConnected = Boolean(current.current);
    following.current = true;
    connectingRef.current = true;
    setConnecting(true);
    setWalletError("");
    try {
      const wallet = await connectShopWallet(chooseAccount);
      const address = await shopWalletAddress();
      if (address?.toLowerCase() !== wallet.address.toLowerCase()) throw new Error("Wallet account or network changed. Connect again.");
      if (generation.current === revision) {
        publish(wallet);
        if (!wasConnected) toast.success("Wallet connected", { description: "Whitechain Sepolia · Ready for test USDT checkout" });
      }
    } catch (error) {
      if (generation.current === revision) {
        if (chooseAccount) {
          const address = await shopWalletAddress().catch(() => undefined);
          if (generation.current !== revision) return;
          if (!address || address.toLowerCase() !== current.current?.address.toLowerCase()) publish();
        } else {
          publish();
        }
        if (!wasConnected) following.current = false;
        setWalletError(error instanceof Error ? error.message : "Couldn’t connect your wallet.");
      }
    } finally {
      connectingRef.current = false;
      setConnecting(false);
    }
  }

  function disconnect() {
    generation.current++;
    following.current = false;
    publish();
    setWalletError("");
  }

  function setConnected(wallet: WalletState) {
    if (current.current?.address.toLowerCase() === wallet.address.toLowerCase()) publish(wallet);
  }

  return <WalletContext.Provider value={{ connected, setConnected, disconnect, connect, connecting, walletError }}>{children}</WalletContext.Provider>;
}

export function useShopWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useShopWallet requires WalletProvider");
  return context;
}
