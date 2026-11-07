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

/**
 * Session persistence — a connected wallet survives page refreshes.
 * Simulated (demo) sessions restore as-is; real wallets are passively
 * re-verified via `eth_accounts` (never prompts).
 */
const WALLET_STORAGE_KEY = "wcp_wallet";

interface PersistedWallet {
  address: string;
  chainId: number | null;
  simulated: boolean;
  providerName: string;
}

function persistWallet(state: WalletState) {
  try {
    if ((state.status === "connected" || state.status === "wrong_network" || state.status === "switching") && state.address) {
      const payload: PersistedWallet = {
        address: state.address,
        chainId: state.chainId,
        simulated: state.simulated,
        providerName: state.providerName,
      };
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(payload));
    } else if (state.status === "disconnected" || state.status === "disconnected_unexpectedly") {
      localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable — session simply won't persist */
  }
}

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

  // Restore a persisted connection on mount.
  useEffect(() => {
    let saved: PersistedWallet | null = null;
    try {
      const raw = localStorage.getItem(WALLET_STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) as PersistedWallet;
    } catch {
      return;
    }
    if (!saved?.address) return;
    // A simulated session only exists in demo mode — never carry it into a real build.
    if (saved.simulated && !DEMO.demoMode) {
      localStorage.removeItem(WALLET_STORAGE_KEY);
      return;
    }
    const restore = (status: WalletStatus): void => {
      setState({
        status,
        address: saved!.address,
        chainId: saved!.chainId,
        simulated: saved!.simulated,
        providerName: saved!.providerName,
        error: null,
        busy: false,
      });
    };
    if (saved.simulated || typeof window === "undefined" || !window.ethereum) {
      restore(saved.chainId === DEFAULT_NETWORK.chainId ? "connected" : "wrong_network");
      return;
    }
    // Real wallet — silently confirm the saved address is still authorized.
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list?.includes(saved!.address)) {
          restore(saved!.chainId === DEFAULT_NETWORK.chainId ? "connected" : "wrong_network");
        } else {
          localStorage.removeItem(WALLET_STORAGE_KEY);
        }
      })
      .catch(() => localStorage.removeItem(WALLET_STORAGE_KEY));
  }, []);

  // Keep storage in sync with connection state.
  useEffect(() => {
    persistWallet(state);
  }, [state]);


  useEffect(() => {
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    setHasProvider(Boolean(provider));
    if (provider?.on) {
      const accountsChanged = (...args: unknown[]) => {
        const accounts = args[0] as string[] | undefined;
        setState((s) =>
          accounts?.[0]
            ? {
                ...s,
                address: accounts[0],
                status: s.chainId === DEFAULT_NETWORK.chainId ? "connected" : "wrong_network",
                error: null,
              }
            : { ...s, status: "disconnected_unexpectedly", address: null, error: "Wallet disconnected from this page." },
        );
      };
      const chainChanged = (...args: unknown[]) => {
        const chainId = parseInt(String(args[0]), 16);
        setState((s) => ({
          ...s,
          chainId,
          status: s.address ? (chainId === DEFAULT_NETWORK.chainId ? "connected" : "wrong_network") : "disconnected",
          error: chainId === DEFAULT_NETWORK.chainId ? null : `Switch to ${DEFAULT_NETWORK.name} (chain ${DEFAULT_NETWORK.chainId}) to continue.`,
        }));
      };
      const disconnected = () => {
        setState((s) => ({ ...s, status: "disconnected_unexpectedly", address: null, error: "Wallet disconnected from this page." }));
      };
      provider.on("accountsChanged", accountsChanged);
      provider.on("chainChanged", chainChanged);
      provider.on("disconnect", disconnected);
      return () => {
        provider.removeListener?.("accountsChanged", accountsChanged);
        provider.removeListener?.("chainChanged", chainChanged);
        provider.removeListener?.("disconnect", disconnected);
      };
    }
  }, []);

  const connect = useCallback(async () => {
    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    setState((s) => ({ ...s, busy: true, error: null }));
    await sleep(DEMO.delays.medium);
    if (!provider) {
      if (!DEMO.demoMode) {
        // Real build with no injected wallet — fail honestly instead of simulating.
        setState((s) => ({
          ...s,
          busy: false,
          status: "unsupported",
          error: "No EVM wallet detected in this browser. Install MetaMask (or another injected wallet) to connect.",
        }));
        return;
      }
      // Clearly-labelled simulation fallback (demo mode only).
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
    } catch (error) {
      setState((s) => ({
        ...s,
        status: "rejected",
        busy: false,
        error: error instanceof Error ? error.message : "The wallet request was rejected or no compatible wallet was found.",
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
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: DEFAULT_NETWORK.chainIdHex }],
        });
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === 4902)) throw error;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: DEFAULT_NETWORK.chainIdHex,
              chainName: DEFAULT_NETWORK.name,
              nativeCurrency: DEFAULT_NETWORK.currency,
              rpcUrls: [DEFAULT_NETWORK.rpcUrl],
              blockExplorerUrls: DEFAULT_NETWORK.explorerUrl ? [DEFAULT_NETWORK.explorerUrl] : undefined,
            },
          ],
        });
      }
      const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
      const chainId = parseInt(chainHex, 16);
      setState((s) => ({
        ...s,
        status: chainId === DEFAULT_NETWORK.chainId ? "connected" : "wrong_network",
        chainId,
        busy: false,
      }));
    } catch (error) {
      setState((s) => ({
        ...s,
        status: "wrong_network",
        busy: false,
        error:
          error instanceof Error
            ? error.message
            : `Network switch was not completed. Switch to ${DEFAULT_NETWORK.name} (chain ${DEFAULT_NETWORK.chainId}) in your wallet.`,
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
