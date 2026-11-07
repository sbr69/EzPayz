import { useState } from "react";
import { Copy, Plus, Trash2, Zap } from "lucide-react";
import { useDemo } from "@/store/demoStore";
import { fmtAmount } from "@/lib/money";
import { Button, Callout, EmptyState, Field, Input, PageHeader } from "@/components/ui";

interface RouteConfig {
  method: string;
  path: string;
  price: string;
  description: string;
}

export function X402Page() {
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [routes, setRoutes] = useState<RouteConfig[]>([
    { method: "GET", path: "/api/data", price: "0.01", description: "Premium API data" },
  ]);
  const [newRoute, setNewRoute] = useState<RouteConfig>({ method: "GET", path: "", price: "0.01", description: "" });
  const [showSnippet, setShowSnippet] = useState(false);

  const payoutWallet = data.merchant?.payoutWallet ?? "0xYourWallet";
  /**
   * The snippet MUST carry a secret key (wcp_sec_…) — settlement requires one and
   * publishable keys (wcp_pub_…) are rejected with 403 by requireSecretKey. Secrets
   * are shown once at creation and never stored client-side, so the snippet uses a
   * placeholder the merchant replaces themselves.
   */
  const secretKey = "wcp_sec_PASTE_YOUR_SECRET_KEY";
  const facilitatorUrl = "https://ezpayz-api.onrender.com/v1/x402";
  const x402Payments = (data.payments ?? []).filter((p: any) => p.checkoutUrl === "" && p.payerWallet);

  const addRoute = () => {
    if (!newRoute.path || !newRoute.price) return;
    setRoutes([...routes, { ...newRoute }]);
    setNewRoute({ method: "GET", path: "", price: "0.01", description: "" });
  };

  const removeRoute = (i: number) => setRoutes(routes.filter((_, idx) => idx !== i));

  const generateSnippet = () => {
    const routesObj = routes.map((r) => `    "${r.method} ${r.path}": { price: "${r.price}", payTo: "${payoutWallet}"${r.description ? `, description: "${r.description}"` : ""} },`);
    return `import express from "express";
import { ezPayzPaymentMiddleware } from "@ezpayz/x402";

const app = express();

app.use(ezPayzPaymentMiddleware({
  facilitatorUrl: "${facilitatorUrl}",
  secretKey: "${secretKey}",
  routes: {
${routesObj.join("\n")}
  },
}));

${routes.map((r) => `app.${r.method.toLowerCase()}("${r.path}", (req, res) => {
  res.json({ data: "Your paid content" });
});`).join("\n\n")}

app.listen(4021);`;
  };

  const copySnippet = () => {
    navigator.clipboard.writeText(generateSnippet());
    pushToast({ title: "Copied!", body: "Code snippet copied to clipboard", tone: "success" });
  };

  return (
    <div>
      <PageHeader title="x402 Agent Payments" description="Accept gasless USDT micropayments from AI agents via HTTP 402" />

      <Callout tone="info" title="How x402 works">
        <div className="space-y-1 text-[15px] leading-relaxed">
          <p>1. AI agent requests your API → gets <strong>402 Payment Required</strong></p>
          <p>2. Agent signs EIP-3009 (gasless, no WBT needed) → retries with payment proof</p>
          <p>3. EzPayz facilitator verifies → you serve content → relayer settles on-chain</p>
          <p>4. You receive USDT to your payout wallet. Webhook emitted.</p>
        </div>
      </Callout>

      <div className="mt-6 space-y-6">
        {/* Route configuration */}
        <div className="rounded-lg border border-line bg-surface p-5">
          <h3 className="text-[17px] font-semibold text-ink">Protected Routes</h3>
          <p className="text-[13px] text-ink-3 mt-0.5">Configure which endpoints require payment + pricing</p>

          <div className="mt-4 space-y-3">
            {routes.length === 0 ? (
              <EmptyState title="No routes configured" description="Add a route to start accepting x402 payments" />
            ) : (
              routes.map((route, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border border-line p-3">
                  <span className="text-[13px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">{route.method}</span>
                  <span className="text-[15px] font-mono flex-1">{route.path}</span>
                  <span className="text-[15px] font-semibold">${route.price}</span>
                  <span className="text-[13px] text-ink-3">{route.description}</span>
                  <button onClick={() => removeRoute(i)} className="text-danger hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 items-end gap-2 sm:flex sm:items-end sm:gap-2">
            <Field label="Method"><select value={newRoute.method} onChange={(e) => setNewRoute({ ...newRoute, method: e.target.value })} className="w-full px-2 py-2 rounded-md border border-line text-[14px]"><option>GET</option><option>POST</option></select></Field>
            <Field label="Path"><Input value={newRoute.path} onChange={(e) => setNewRoute({ ...newRoute, path: e.target.value })} placeholder="/api/weather" /></Field>
            <Field label="Price (USD)"><Input value={newRoute.price} onChange={(e) => setNewRoute({ ...newRoute, price: e.target.value })} placeholder="0.01" /></Field>
            <Field label="Description"><Input value={newRoute.description} onChange={(e) => setNewRoute({ ...newRoute, description: e.target.value })} placeholder="Weather data" /></Field>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={addRoute}>Add</Button>
          </div>
        </div>

        {/* Code snippet */}
        <div className="rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[17px] font-semibold text-ink">Integration Code</h3>
              <p className="text-[13px] text-ink-3 mt-0.5">Copy this into your server</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowSnippet(!showSnippet)}>{showSnippet ? "Hide" : "Show"} Code</Button>
              {showSnippet && <Button variant="primary" size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={copySnippet}>Copy</Button>}
            </div>
          </div>
          {showSnippet && (
            <>
              <Callout tone="warn" title="Paste your secret key before running">
                Replace <code className="font-mono">wcp_sec_PASTE_YOUR_SECRET_KEY</code> with the
                <strong> secret key</strong> (wcp_sec_…) you received when creating an API key — it is
                shown <strong>only once</strong> at creation. Publishable keys (wcp_pub_…) are
                read-only and will be <strong>rejected (403)</strong> when settling payments.
              </Callout>
              <pre className="mt-4 bg-slate-900 text-slate-100 p-5 rounded-lg text-[13px] overflow-auto leading-relaxed"><code>{generateSnippet()}</code></pre>
            </>
          )}
        </div>

        {/* AI agent side */}
        <div className="rounded-lg border border-line bg-surface p-5">
          <h3 className="text-[17px] font-semibold text-ink">AI Agent Side</h3>
          <p className="text-[13px] text-ink-3 mt-0.5">Agents use x402Fetch — automatic payment, no manual steps</p>
          <pre className="mt-4 bg-slate-900 text-slate-100 p-5 rounded-lg text-[13px] overflow-auto"><code>{`import { x402Fetch } from "@ezpayz/sdk";

const res = await x402Fetch("https://your-api.com/api/data", {
  privateKey: "0x...",
});
const data = await res.json();`}</code></pre>
        </div>

        {/* Recent x402 payments */}
        <div className="rounded-lg border border-line bg-surface p-5">
          <h3 className="text-[17px] font-semibold text-ink flex items-center gap-2"><Zap className="h-4 w-4" /> Recent x402 Payments</h3>
          <p className="text-[13px] text-ink-3 mt-0.5">Payments from AI agents via HTTP 402</p>
          <div className="mt-4">
            {x402Payments.length === 0 ? (
              <EmptyState title="No x402 payments yet" description="AI agent payments will appear here once they pay for your API" />
            ) : (
              <div className="space-y-2">
                {x402Payments.slice(0, 10).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 py-2 px-3 border-b border-line/50">
                    <span className="text-[13px] font-semibold text-success">{fmtAmount(p.amount)} USDT</span>
                    <span className="text-[13px] text-ink-3 font-mono">{p.payerWallet?.slice(0, 10)}…</span>
                    <span className="text-[13px] text-ink-3">{p.description}</span>
                    <span className="flex-1" />
                    <span className="text-[12px] px-2 py-0.5 rounded" style={{ background: p.status === "succeeded" ? "#dcfce7" : "#fee2e2", color: p.status === "succeeded" ? "#166534" : "#991b1b" }}>{p.status}</span>
                    {p.txRef && <a href={`https://explorer.testnet.whitechain.io/tx/${p.txRef}`} target="_blank" rel="noreferrer" className="text-[12px] text-accent">tx →</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
