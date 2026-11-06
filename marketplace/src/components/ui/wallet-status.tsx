import { Check, LoaderCircle } from "lucide-react";

export function WalletStatus({ connected, connecting }: { connected: boolean; connecting: boolean }) {
  return (
    <span className="wallet-status" data-wallet-state={connecting ? "connecting" : connected ? "connected" : "idle"} role="status">
      {connecting ? <LoaderCircle size={13} className="animate-spin" aria-hidden /> : connected ? <Check size={13} aria-hidden /> : null}
      {connecting ? "Connecting…" : connected ? "Connected" : "Not connected"}
    </span>
  );
}
