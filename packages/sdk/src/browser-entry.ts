/**
 * Standalone browser entry point — produces whitechain-checkout.global.js.
 * Included via <script src=".../whitechain-checkout.global.js"></script>.
 * Drops a global `WhitechainCheckout` object on `window` with an `open()` method.
 *
 * Usage (no build tool required — works on plain HTML, WordPress, Shopify):
 *   <script src="https://your-gateway.com/sdk/whitechain-checkout.global.js"></script>
 *   <script>
 *     WhitechainCheckout.open({
 *       checkoutSlug: "ck_abc123",
 *       apiUrl: "https://your-gateway.com",
 *       onSuccess: function(r) { window.location = "/thankyou?paymentId=" + r.paymentIntentId; }
 *     });
 *   </script>
 *
 * This entry does NOT include React. It renders a minimal checkout UI into a
 * container div using DOM APIs. For the full React widget experience, use the
 * npm package (@ezpayz/sdk) with a React app.
 */

export interface BrowserCheckoutOptions {
  checkoutSlug: string;
  apiUrl: string;
  clientSecret?: string;
  onSuccess?: (result: { paymentIntentId: string; txRef?: string }) => void;
  onError?: (error: Error) => void;
}

/** Minimal wallet signer — uses window.ethereum (MetaMask injected provider). */
async function signTypedDataWithMetaMask(params: {
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}): Promise<string> {
  const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params: unknown[] }) => Promise<string> } }).ethereum;
  if (!eth) throw new Error("No wallet detected. Install MetaMask or another EVM wallet.");
  const accounts = await eth.request({ method: "eth_requestAccounts", params: [] });
  const from = accounts[0];
  const sig = await eth.request({
    method: "eth_signTypedData_v4",
    params: [from, JSON.stringify(params)],
  });
  return sig;
}

/** Opens a checkout modal. Returns a close function. */
export function open(opts: BrowserCheckoutOptions): () => void {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-family:sans-serif";
  const modal = document.createElement("div");
  modal.style.cssText = "background:#fff;border-radius:12px;padding:1.5rem;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2)";
  container.appendChild(modal);
  document.body.appendChild(container);

  const close = () => { document.body.removeChild(container); };

  container.addEventListener("click", (e) => { if (e.target === container) close(); });

  modal.innerHTML = '<p style="margin:0;color:#666;font-size:14px">Loading checkout…</p>';

  void (async () => {
    try {
      const res = await fetch(`${opts.apiUrl}/v1/checkout/${opts.checkoutSlug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Checkout not found");

      const amount = data.displayAmount ?? data.amount;
      modal.innerHTML = `
        <h2 style="margin:0 0 8px;font-size:18px">${data.merchant.displayName}</h2>
        <p style="color:#666;font-size:14px;margin:0 0 16px">${data.description}</p>
        <div style="padding:12px;background:#f5f5f5;border-radius:8px;margin-bottom:16px">
          <p style="font-size:12px;color:#666;margin:0">Amount due</p>
          <p style="font-size:24px;font-weight:600;margin:4px 0 0">${amount} ${data.token.symbol}</p>
        </div>
        <p style="font-size:12px;color:#666;margin:0 0 16px">To: ${data.merchant.payoutWallet.slice(0,10)}…${data.merchant.payoutWallet.slice(-4)}</p>
        <button id="wcp-pay" style="width:100%;padding:12px;font-size:15px;cursor:pointer;border-radius:8pxborder:none;background:#0ea5e9;color:#fff">Pay ${amount} USDT (gasless)</button>
        <p style="font-size:11px;color:#999;margin:12px 0 0;text-align:center">Gasless: the relayer pays WBT gas. You only sign the authorization.</p>
      `;
      const payBtn = modal.querySelector("#wcp-pay") as HTMLButtonElement;
      payBtn.style.borderRadius = "8px";
      payBtn.addEventListener("click", async () => {
        payBtn.disabled = true;
        payBtn.textContent = "Sign in wallet…";
        try {
          const now = Math.floor(Date.now() / 1000);
          const nonce = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("");
          const signature = await signTypedDataWithMetaMask({
            domain: { name: "Tether USD", version: "1", chainId: data.chainId, verifyingContract: data.token.address },
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
              from: (await (window as unknown as { ethereum: { request: (a: { method: string; params: unknown[] }) => Promise<string[]> } }).ethereum.request({ method: "eth_requestAccounts", params: [] }))[0],
              to: data.merchant.payoutWallet,
              value: String(BigInt(data.amount)),
              validAfter: String(now - 60),
              validBefore: String(now + 600),
              nonce,
            },
          });
          payBtn.textContent = "Submitting…";
          await fetch(`${opts.apiUrl}/v1/checkout/${opts.checkoutSlug}/authorize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: signature, to: data.merchant.payoutWallet, value: data.amount, validAfter: String(now - 60), validBefore: String(now + 600), nonce, signature }),
          });
          payBtn.textContent = "Confirming on-chain…";
          // Poll for settlement.
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const sr = await fetch(`${opts.apiUrl}/v1/payment-intents/${data.paymentIntentId}`).then((r) => r.json());
            if (sr.paymentIntent?.status === "succeeded") {
              modal.innerHTML = `
                <div style="text-align:center">
                  <div style="width:48px;height:48px;margin:0 auto 12px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px">✓</div>
                  <h2 style="margin:0;font-size:20px">Payment succeeded</h2>
                  <p style="color:#666;font-size:14px;margin:4px 0 16px">${amount} ${data.token.symbol}</p>
                  ${sr.paymentIntent.txRef ? `<a href="https://explorer.testnet.whitechain.io/tx/${sr.paymentIntent.txRef}" target="_blank" style="font-size:13px;color:#0ea5e9">View transaction →</a>` : ""}
                  <br><br>
                  ${data.successUrl ? `<button id="wcp-return" style="padding:10px 20px;font-size:14px;cursor:pointer;border-radius:8px;border:none;background:#0ea5e9;color:#fff">Return to merchant</button>` : ""}
                </div>
              `;
              if (data.successUrl) {
                const retBtn = modal.querySelector("#wcp-return") as HTMLButtonElement;
                retBtn?.addEventListener("click", () => {
                  window.location.href = `${data.successUrl}${data.successUrl.includes("?") ? "&" : "?"}paymentIntentId=${data.paymentIntentId}&status=succeeded`;
                });
              }
              opts.onSuccess?.({ paymentIntentId: data.paymentIntentId, txRef: sr.paymentIntent.txRef });
              return;
            }
            if (sr.paymentIntent?.status === "failed") throw new Error("Payment failed on-chain");
          }
          throw new Error("Payment timed out");
        } catch (e) {
          payBtn.textContent = "Pay " + amount + " USDT (gasless)";
          payBtn.disabled = false;
          modal.querySelector("p:last-child")?.insertAdjacentHTML("beforebegin", `<p style="color:red;font-size:13px;margin:8px 0">${(e as Error).message}</p>`);
          opts.onError?.(e as Error);
        }
      });
    } catch (e) {
      modal.innerHTML = `<p style="color:red;font-size:14px">${(e as Error).message}</p><button id="wcp-close" style="margin-top:12px;padding:8px 16px;cursor:pointer">Close</button>`;
      (modal.querySelector("#wcp-close") as HTMLButtonElement)?.addEventListener("click", close);
      opts.onError?.(e as Error);
    }
  })();

  return close;
}
