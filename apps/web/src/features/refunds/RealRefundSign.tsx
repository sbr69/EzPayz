import { useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { apiFetch } from "@/services/api/http";
import { fmtAmount } from "@/lib/money";

const USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";
const CHAIN_ID = 1874;

/**
 * Real refund signing — the merchant connects their payout wallet in the dashboard
 * and signs an EIP-3009 TransferWithAuthorization for the refund (merchant → payer).
 * The gateway relayer then submits it on-chain and pays WBT gas.
 *
 * PRD §12.3.1, FLOW §11.2 — MVP signing path: browser (Wagmi) in the dashboard.
 */
export function RealRefundSign({ refundId, amount, payerWallet, merchantPayoutWallet }: {
  refundId: string;
  amount: string;       // base units
  payerWallet: string;
  merchantPayoutWallet: string;
}) {
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [status, setStatus] = useState<"idle" | "signing" | "submitting" | "succeeded" | "failed">("idle");
  const [error, setError] = useState("");

  const wrongNetwork = chainId !== undefined && chainId !== CHAIN_ID;
  const wrongWallet = address !== undefined && address.toLowerCase() !== merchantPayoutWallet.toLowerCase();

  const handleSign = async () => {
    if (!address) return;
    setStatus("signing");
    setError("");
    try {
      const now = Math.floor(Date.now() / 1000);
      const nonce = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("") as `0x${string}`;
      const signature = await signTypedDataAsync({
        domain: { name: "Tether USD", version: "1", chainId: CHAIN_ID, verifyingContract: USDT },
        types: {
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        primaryType: "TransferWithAuthorization",
        message: {
          from: address as `0x${string}`,
          to: payerWallet as `0x${string}`,
          value: BigInt(amount),
          validAfter: BigInt(now - 60),
          validBefore: BigInt(now + 600),
          nonce,
        },
      });

      setStatus("submitting");
      await apiFetch(`/v1/refunds/${refundId}/authorize`, {
        method: "POST",
        body: JSON.stringify({
          from: address,
          to: payerWallet,
          value: amount,
          validAfter: String(now - 60),
          validBefore: String(now + 600),
          nonce,
          signature,
        }),
      });
      setStatus("succeeded");
    } catch (e) {
      setError((e as Error).message);
      setStatus("failed");
    }
  };

  if (status === "succeeded") {
    return (
      <div style={{ padding: "1rem", border: "1px solid #22c55e", borderRadius: 8, background: "#f0fdf4", fontFamily: "sans-serif" }}>
        <p style={{ margin: 0, color: "#16a34a", fontWeight: 600 }}>✓ Refund authorization submitted</p>
        <p style={{ margin: "8px 0 0", fontSize: 15, color: "#666" }}>The relayer is submitting the refund on-chain. Check the refund status for the tx hash.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: "sans-serif" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>Authorize refund (gasless)</h3>
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 15, color: "#666", margin: 0 }}>Refund amount: <strong>{fmtAmount(amount)} USDT</strong></p>
        <p style={{ fontSize: 15, color: "#666", margin: "4px 0 0" }}>To (original payer): {payerWallet.slice(0, 10)}…{payerWallet.slice(-4)}</p>
        <p style={{ fontSize: 15, color: "#666", margin: "4px 0 0" }}>From (your payout wallet): {merchantPayoutWallet.slice(0, 10)}…{merchantPayoutWallet.slice(-4)}</p>
      </div>
      <div style={{ marginBottom: 12 }}>
        <ConnectButton />
      </div>
      {address && wrongWallet && (
        <p style={{ color: "red", fontSize: 15, marginBottom: 12 }}>
          Connected wallet does not match the merchant payout wallet. Connect {merchantPayoutWallet.slice(0, 10)}…
        </p>
      )}
      {address && wrongNetwork && !wrongWallet && (
        <p style={{ color: "orange", fontSize: 15, marginBottom: 12 }}>Wrong network — switch to Whitechain Sepolia (chain 1874).</p>
      )}
      {error && <p style={{ color: "red", fontSize: 15, marginBottom: 12 }}>{error}</p>}
      <button
        onClick={handleSign}
        disabled={!address || wrongWallet || wrongNetwork || status === "signing" || status === "submitting"}
        style={{ width: "100%", padding: "10px", fontSize: 16, cursor: "pointer", borderRadius: 8, border: "none", background: "#0ea5e9", color: "#fff", opacity: !address || wrongWallet || wrongNetwork ? 0.5 : 1 }}
      >
        {status === "signing" ? "Sign in wallet…" : status === "submitting" ? "Submitting to relayer…" : `Sign refund authorization (${fmtAmount(amount)} USDT)`}
      </button>
      <p style={{ fontSize: 13, color: "#999", marginTop: 8 }}>
        The relayer pays WBT gas. You only sign the EIP-3009 authorization.
      </p>
    </div>
  );
}
