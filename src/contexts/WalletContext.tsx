import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_NETWORK, DEMO } from "@/config/app";
import { sleep } from "@/lib/money";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

export type WalletStatus =
  | "disconnected"
  | "requesting"
  | "connected"
  | "rejected"
  | "unsupported"
  | "wrong_network"
  | "switching"
  | "disconnected_unexpectedly";

export interface WalletState {
  status: WalletStatus;
  address: string | null;
  chainId: number | null;
  /** true when no injected provider exists and we fell back to simulation. */
  simulated: boolean;
  providerName: string;
  error: string | null;
  busy: boolean;
}

interface WalletApi extends WalletState {
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  /**
   * Returns a demo authorization reference. This NEVER asks the browser wallet
   * for a signature — signature requests are disabled until a working backend
   * and contract integration exists.
   */
  requestAuthorizationLabel: () => string;
  resetStatus: () => void;
}

const DEMO_ADDRESS = "0xd3000000000000000000000000000000000000c1a";

const WalletCtx = createContext<WalletApi | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    status: "disconnected",
    address: null,
    chainId: null,
    simulated: false,
    providerName: "Demo wallet (simulated)",
    error: null,
    busy: false,
  });
  const [hasProvider, setHasProvider] = useState(false);

  useEffect(() => {
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    setHasProvider(Boolean(provider));
    if (provider?.on) {
      const handler = (..._args: unknown[]) => {
        setState((s) =>
          s.status === "connected"
            ? { ...s, status: "disconnected_unexpectedly", address: null, error: "Wallet reported accounts changed or disconnected." }
            : s,
        );
      };
      provider.on("accountsChanged", handler);
      provider.on("disconnect", handler);
      return () => {
        provider.removeListener?.("accountsChanged", handler);
        provider.removeListener?.("disconnect", handler);
      };
    }
  }, []);

  const connect = useCallback(async () => {
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    setState((s) => ({ ...s, busy: true, error: null }));
    await sleep(DEMO.delays.medium);
    if (!provider) {
      // Clearly-labelled simulation fallback.
      setState({
        status: "connected",
        address: DEMO_ADDRESS,
        chainId: DEFAULT_NETWORK.chainId,
        simulated: true,
        providerName: "Demo wallet (simulated)",
        error: null,
        busy: false,
      });
      return;
    }
    try {
      setState((s) => ({ ...s, status: "requesting" }));
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts?.length) {
        setState((s) => ({ ...s, status: "rejected", busy: false, error: "No accounts were shared with this page." }));
        return;
      }
      const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
      const chainId = parseInt(chainHex, 16);
      setState({
        status: chainId === DEFAULT_NETWORK.chainId ? "connected" : "wrong_network",
        address: accounts[0],
        chainId,
        simulated: false,
        providerName: provider.isMetaMask ? "MetaMask" : "Injected EVM wallet",
        error: null,
        busy: false,
      });
    } catch {
      setState((s) => ({
        ...s,
        status: "rejected",
        busy: false,
        error: "The wallet request was rejected or no compatible wallet was found.",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      status: "disconnected",
      address: null,
      chainId: null,
      simulated: false,
      providerName: "Demo wallet (simulated)",
      error: null,
      busy: false,
    });
  }, []);

  const switchNetwork = useCallback(async () => {
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    setState((s) => ({ ...s, status: "switching", busy: true, error: null }));
    await sleep(DEMO.delays.medium);
    if (!provider) {
      setState((s) => ({ ...s, status: "connected", chainId: DEFAULT_NETWORK.chainId, busy: false }));
      return;
    }
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: DEFAULT_NETWORK.chainIdHex }],
      });
      const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
      const chainId = parseInt(chainHex, 16);
      setState((s) => ({
        ...s,
        status: chainId === DEFAULT_NETWORK.chainId ? "connected" : "wrong_network",
        chainId,
        busy: false,
      }));
    } catch {
      setState((s) => ({
        ...s,
        status: "wrong_network",
        busy: false,
        error: `Network switch was not completed. Switch to ${DEFAULT_NETWORK.name} (chain ${DEFAULT_NETWORK.chainId}) in your wallet.`,
      }));
    }
  }, []);

  const requestAuthorizationLabel = useCallback(() => "Simulated EIP-3009 authorization (demo mode)", []);

  const resetStatus = useCallback(() => {
    setState((s) => ({ ...s, status: s.address ? "connected" : "disconnected", error: null }));
  }, []);

  const value = useMemo<WalletApi>(
    () => ({ ...state, hasProvider, connect, disconnect, switchNetwork, requestAuthorizationLabel, resetStatus }),
    [state, hasProvider, connect, disconnect, switchNetwork, requestAuthorizationLabel, resetStatus],
  );

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet(): WalletApi {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
