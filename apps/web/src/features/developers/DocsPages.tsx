import { useMemo, useState } from "react";
import { BookOpen, Code2, Search } from "lucide-react";
import { DEFAULT_NETWORK, GATEWAY, TOKEN } from "@/config/app";
import { Button, Callout, Card, CardHeader, Divider, Input, PageHeader, Pill } from "@/components/ui";
import { CodeBlock } from "@/components/ui/display";

const install = `npm install ${GATEWAY.sdkPackage}`;

const serverInit = `import { EzPayz } from "${GATEWAY.sdkPackage}";

export const wp = new EzPayz({
  secretKey: process.env.WHITEPAY_SECRET_KEY!,
  network: "${DEFAULT_NETWORK.id}",
  token: "${TOKEN.symbol}",
});`;

const createIntent = `const session = await wp.checkout.sessions.create({
  amount: "1600.00",           // display string, converted to base units server-side
  description: "Audit sprint — balance",
  expiresInHours: 72,
  successUrl: "https://example.com/thanks",
  metadata: { orderId: "ORD-9042" },
});

console.log(session.id, session.url);`;

const widget = `import { EzPayzProvider, Checkout } from "${GATEWAY.sdkPackage}";

export default function Pay({ sessionId }: { sessionId: string }) {
  return (
    <EzPayzProvider publishableKey={process.env.NEXT_PUBLIC_KEY!}>
      <Checkout
        sessionId={sessionId}
        onSuccess={(payment) => router.push("/receipt/" + payment.id)}
        onError={(error) => setError(error.message)}
      />
    </EzPayzProvider>
  );
}`;

const fullExample = `import { EzPayz, EzPayzProvider, Checkout } from "${GATEWAY.sdkPackage}";

const wp = new EzPayz({ secretKey: process.env.SECRET_KEY! });

export async function POST(req) {
  const { amount, orderId } = await req.json();
  const session = await wp.checkout.sessions.create({
    amount, description: "Order " + orderId, expiresInHours: 24,
  });
  return Response.json({ id: session.id, url: session.url });
}

export function Pay({ sessionId }) {
  return (
    <EzPayzProvider publishableKey={process.env.PUBLIC_KEY!}>
      <Checkout sessionId={sessionId} />
    </EzPayzProvider>
  );
}`;

const linkExample = `const link = await wp.paymentLinks.create({
  title: "Support the open-source kit",
  linkType: "customer_amount",
  minAmount: "5.00",
  maxAmount: "500.00",
});

// link.url -> hosted checkout, link.qrUrl -> PNG QR code`;

const invoiceExample = `const invoice = await wp.invoices.create({
  customerEmail: "finance@elliotandco.example",
  title: "Reconciliation services Q1",
  lineItems: [
    { description: "Entity reconciliation", quantity: 3, unitPrice: "180.00" },
    { description: "Reporting pack", quantity: 1, unitPrice: "640.00" },
  ],
  expiresInHours: 336,
});

// invoice.payeeShield.status === "verified"`;

const subscriptionExample = `const plan = await wp.subscriptionPlans.create({
  name: "Northwind Pro",
  amount: "129.00",
  interval: "monthly",
  maxChargePerCycle: "129.00",
  cumulativeLimit: "1548.00",
  retryPolicy: { maxAttempts: 3, backoff: "exponential", intervalMinutes: 60, gracePeriodMinutes: 1440 },
});

const subscription = await wp.subscriptions.create({ planId: plan.id, customerId: "cus_9f21ac" });`;

const usageExample = `await wp.usageRecords.create({
  subscriptionId: "sub_3003",
  units: 1200,
  merchantReference: "api/requests-week-12",
});`;

const webhookExample = `import { Webhook } from "${GATEWAY.sdkPackage}";

export async function POST(req) {
  const raw = await req.text();
  const event = Webhook.constructEvent(raw, req.headers.get("X-EzPayz-Signature"), process.env.WEBHOOK_SECRET!);

  switch (event.type) {
    case "payment.succeeded": return provision(event.data.object);
    case "payment.underpaid": return flagForReview(event.data.object);
    case "subscription.renewal_failed": return notifyCustomer(event.data.object);
    default: return Response.ok();
  }
}`;

const statusExample = `const payment = await wp.paymentIntents.retrieve("pay_8201");

payment.status;             // "succeeded"
payment.settlement.status;  // settlement record, verified independently
payment.receipt.email;      // "delivered" — separate from settlement
payment.webhooks.delivered; // 1 — separate from settlement`;

export function Quickstart() {
  const steps = [
    { id: "install", title: "1. Install the SDK", code: install, caption: "The SDK ships server and browser entry points." },
    { id: "init", title: "2. Configure the client", code: serverInit, caption: "Never import the server client in browser code." },
    { id: "intent", title: "3. Create a payment intent", code: createIntent, caption: "Amounts are accepted as display strings and converted to base units server-side." },
    { id: "widget", title: "4. Render checkout", code: widget, caption: "The widget handles wallet connection, network checks, authorization and relayer submission." },
    { id: "full", title: "5. Complete integration", code: fullExample, caption: "About 20 lines: one API route and one component." },
    { id: "link", title: "6. Payment links", code: linkExample },
    { id: "invoice", title: "7. Invoices", code: invoiceExample, caption: "Invoices are signed by the gateway before they are shared." },
    { id: "subscription", title: "8. Subscriptions", code: subscriptionExample, caption: "Customers must authorise the per-cycle cap and cumulative limit." },
    { id: "usage", title: "9. Usage records", code: usageExample, caption: "Metering is submitted by your application." },
    { id: "webhook", title: "10. Verify webhooks", code: webhookExample, caption: "Always verify the signature header before trusting a payload." },
    { id: "status", title: "11. Handle payment status", code: statusExample, caption: "Settlement, receipt email and webhook delivery are separate states." },
  ];
  const [active, setActive] = useState("install");

  return (
    <>
      <PageHeader
        title="SDK and integration guide"
        description={`Get from zero to a working USDT checkout on ${DEFAULT_NETWORK.name}.`}
        meta={
          <>
            <Pill tone="neutral">{GATEWAY.docsVersion}</Pill>
            <Pill tone="warn">Provisional</Pill>
          </>
        }
        actions={
          <a href="#/developers/api-reference">
            <Button variant="secondary" icon={<BookOpen className="h-4 w-4" />}>
              API reference
            </Button>
          </a>
        }
      />

      <Callout tone="warn" title="Documentation is provisional">
        The SDK package, method names and payloads below are an illustrative frontend specification. The
        backend contract is not finalised, and delegated transfer support for the configured{" "}
        {TOKEN.symbol} contract is not yet verified. Nothing here should be treated as a working
        integration until those dependencies are confirmed.
      </Callout>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit">
          <CardHeader title="Steps" />
          <nav className="p-2">
            {steps.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`block w-full rounded-md px-3 py-2 text-left text-[12.5px] transition-colors ${
                  active === s.id ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-canvas-alt"
                }`}
              >
                {s.title}
              </button>
            ))}
          </nav>
        </Card>

        <div className="space-y-4">
          {steps
            .filter((s) => s.id === active)
            .map((s) => (
              <Card key={s.id}>
                <CardHeader title={s.title} />
                <div className="space-y-3 px-5 py-4">
                  <CodeBlock language="ts" filename={`${s.id}.ts`} code={s.code} caption={s.caption} />
                </div>
              </Card>
            ))}
        </div>
      </div>

      <Card>
        <CardHeader title="Environment variables" description="Secrets stay server-side" />
        <div className="space-y-3 px-5 py-4">
          <CodeBlock
            language="bash"
            filename=".env"
            caption="Publishable keys are safe in the browser. Secret keys and webhook signing secrets are not."
            code={`WHITEPAY_SECRET_KEY=sk_test_...          # server only
WHITEPAY_WEBHOOK_SECRET=whsec_...       # server only
NEXT_PUBLIC_WHITEPAY_KEY=pk_test_...    # browser safe`}
          />
          <Divider />
          <CodeBlock
            language="bash"
            filename="network.config"
            code={`WHITEPAY_NETWORK=${DEFAULT_NETWORK.id}
WHITEPAY_CHAIN_ID=${DEFAULT_NETWORK.chainId}
WHITEPAY_TOKEN=${TOKEN.symbol}
WHITEPAY_TOKEN_CONTRACT=${TOKEN.contract}`}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Error handling" />
        <div className="space-y-3 px-5 py-4">
          <CodeBlock
            language="ts"
            code={`try {
  const payment = await wp.paymentIntents.confirm(id, { authorization });
} catch (err) {
  switch (err.code) {
    case "authorization_rejected":  // customer rejected the signature
    case "insufficient_balance":    // not enough USDT
    case "wrong_network":          // wallet on a different chain
    case "payeesield_failed":      // request failed verification
    case "relayer_rejected":       // GasGuard policy blocked submission
    default:                       // unexpected
  }
}`}
            caption="Every failure mode in the checkout has a distinct code, and none of them mark a payment successful."
          />
        </div>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* API reference                                                       */
/* ------------------------------------------------------------------ */

interface EndpointDoc {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  params?: { name: string; type: string; description: string }[];
  request?: string;
  response?: string;
}

const resources: { name: string; description: string; endpoints: EndpointDoc[] }[] = [
  {
    name: "Payment Intents",
    description: "Create and inspect one-time USDT payment requests.",
    endpoints: [
      {
        method: "POST",
        path: "/payment_intents",
        summary: "Create a payment intent and a hosted checkout session.",
        params: [
          { name: "amount", type: "string", description: "Display amount, converted to base units server-side." },
          { name: "description", type: "string", description: "Shown to the customer on checkout." },
          { name: "expires_in_hours", type: "integer", description: "Request validity window." },
          { name: "metadata", type: "object", description: "Merchant-defined key/value pairs." },
        ],
        request: `{ "amount": "1600.00", "description": "Audit sprint", "expires_in_hours": 72 }`,
        response: `{ "id": "pay_8201", "status": "requires_authorization", "checkout_url": "https://…" }`,
      },
      {
        method: "GET",
        path: "/payment_intents/:id",
        summary: "Retrieve a payment intent with its settlement, receipt and webhook state.",
        response: `{ "id": "pay_8201", "status": "succeeded", "settlement": { "status": "verified", "reference": "demo-tx-…" } }`,
      },
      {
        method: "POST",
        path: "/payment_intents/:id/cancel",
        summary: "Cancel an unauthorised payment intent.",
      },
    ],
  },
  {
    name: "Checkout Sessions",
    description: "Hosted checkout pages rendered by the gateway.",
    endpoints: [
      {
        method: "POST",
        path: "/checkout/sessions",
        summary: "Create a hosted checkout session.",
        request: `{ "payment_intent": "pay_8201", "success_url": "https://example.com/thanks" }`,
        response: `{ "id": "ses_8201", "url": "https://checkout…/ses_8201" }`,
      },
      { method: "GET", path: "/checkout/sessions/:id", summary: "Retrieve a session and its current payment state." },
    ],
  },
  {
    name: "Payment Links",
    description: "Shareable fixed, customer-amount and reusable links.",
    endpoints: [
      {
        method: "POST",
        path: "/payment_links",
        summary: "Create a payment link.",
        request: `{ "title": "Templates", "link_type": "reusable", "amount": "79.00" }`,
      },
      { method: "POST", path: "/payment_links/:id/deactivate", summary: "Stop accepting new checkouts." },
      { method: "GET", path: "/payment_links/:id/qr", summary: "Fetch a PNG QR code that encodes the checkout URL." },
    ],
  },
  {
    name: "Invoices",
    description: "Signed payment requests with line items.",
    endpoints: [
      {
        method: "POST",
        path: "/invoices",
        summary: "Create and sign an invoice.",
        request: `{ "customer_email": "finance@…", "line_items": [{ "quantity": 3, "unit_price": "180.00" }] }`,
        response: `{ "id": "inv_7101", "payee_shield": { "status": "verified", "signing_key_id": "gwk_2F91A" } }`,
      },
      { method: "POST", path: "/invoices/:id/void", summary: "Void an unpaid invoice." },
      { method: "GET", path: "/invoices/:id/receipt", summary: "Fetch the paid receipt after settlement." },
    ],
  },
  {
    name: "Refunds",
    description: "Full and partial refunds of settled payments.",
    endpoints: [
      {
        method: "POST",
        path: "/refunds",
        summary: "Create a refund. Fails if the cumulative refund exceeds the settled amount.",
        request: `{ "payment_intent": "pay_8203", "amount": "320.00", "reason": "Scope reduced" }`,
      },
      { method: "GET", path: "/refunds/:id", summary: "Retrieve refund state including gas attribution." },
    ],
  },
  {
    name: "Products",
    description: "Reusable catalogue items.",
    endpoints: [
      { method: "POST", path: "/products", summary: "Create a one-time or usage-priced product." },
      { method: "POST", path: "/products/:id/archive", summary: "Archive a product." },
    ],
  },
  {
    name: "Subscription Plans",
    description: "Recurring billing configuration.",
    endpoints: [
      {
        method: "POST",
        path: "/subscription_plans",
        summary: "Create a plan with per-cycle and cumulative limits and a retry policy.",
        request: `{ "amount": "129.00", "interval": "monthly", "max_charge_per_cycle": "129.00", "cumulative_limit": "1548.00" }`,
      },
    ],
  },
  {
    name: "Subscriptions",
    description: "Customer subscriptions and renewals.",
    endpoints: [
      { method: "POST", path: "/subscriptions", summary: "Create a subscription for a customer and plan." },
      { method: "POST", path: "/subscriptions/:id/activate", summary: "Activate after the allowance approval is confirmed." },
      { method: "POST", path: "/subscriptions/:id/cancel", summary: "Cancel future charges. Does not revoke allowance." },
      { method: "POST", path: "/subscriptions/:id/revoke_allowance", summary: "Revoke the remaining ERC-20 allowance." },
    ],
  },
  {
    name: "Usage Records",
    description: "Metered usage submitted by the merchant application.",
    endpoints: [
      {
        method: "POST",
        path: "/usage_records",
        summary: "Record usage. Charges are capped by the subscription authorization.",
        request: `{ "subscription": "sub_3003", "units": 1200, "merchant_reference": "api/week-12" }`,
      },
    ],
  },
  {
    name: "Customers",
    description: "Customer records scoped to a single merchant workspace.",
    endpoints: [
      { method: "POST", path: "/customers", summary: "Create a customer record." },
      { method: "GET", path: "/customers/:id", summary: "Retrieve a customer with payments, invoices and subscriptions." },
    ],
  },
  {
    name: "Webhooks",
    description: "Endpoint configuration and event delivery.",
    endpoints: [
      { method: "POST", path: "/webhook_endpoints", summary: "Register an endpoint and select events." },
      { method: "POST", path: "/webhook_endpoints/:id/test", summary: "Send a signed test event." },
      { method: "GET", path: "/events", summary: "List delivery attempts with response codes." },
    ],
  },
];

const methodTone: Record<EndpointDoc["method"], string> = {
  GET: "bg-info-soft text-info border-info-line",
  POST: "bg-positive-soft text-positive border-positive-line",
  PATCH: "bg-warn-soft text-warn border-warn-line",
  DELETE: "bg-danger-soft text-danger border-danger-line",
};

export function ApiReference() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(resources[0].name);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources
      .map((r) => ({
        ...r,
        endpoints: r.endpoints.filter(
          (e) =>
            e.path.toLowerCase().includes(q) ||
            e.summary.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q),
        ),
      }))
      .filter((r) => r.endpoints.length > 0 || r.name.toLowerCase().includes(q));
  }, [query]);

  const current = filtered.find((r) => r.name === active) ?? filtered[0];

  return (
    <>
      <PageHeader
        title="API reference"
        description={`Provisional REST surface for ${GATEWAY.productName} on ${DEFAULT_NETWORK.name}.`}
        meta={
          <>
            <Pill tone="neutral">Base URL: {GATEWAY.apiBase}</Pill>
            <Pill tone="warn">Mock documentation</Pill>
          </>
        }
        actions={
          <a href="#/developers/quickstart">
            <Button variant="secondary" icon={<Code2 className="h-4 w-4" />}>
              SDK quickstart
            </Button>
          </a>
        }
      />

      <Callout tone="warn" title="Illustrative specification">
        These endpoints, parameters and responses are a frontend specification, not a deployed API. They
        will change when the backend contract is finalised.
      </Callout>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit">
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search endpoints…"
                className="h-8 pl-8 text-[13px]"
                aria-label="Search API reference"
              />
            </div>
          </div>
          <nav className="p-2">
            {filtered.map((r) => (
              <button
                key={r.name}
                onClick={() => setActive(r.name)}
                className={`block w-full rounded-md px-3 py-2 text-left text-[12.5px] transition-colors ${
                  current?.name === r.name ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-canvas-alt"
                }`}
              >
                {r.name}
                <span className="ml-1.5 text-[11px] text-ink-4">{r.endpoints.length}</span>
              </button>
            ))}
          </nav>
        </Card>

        <div className="space-y-4">
          {current ? (
            <>
              <Card>
                <CardHeader title={current.name} description={current.description} />
                <div className="divide-y divide-line">
                  {current.endpoints.map((e) => (
                    <div key={`${e.method}${e.path}`} className="space-y-3 px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${methodTone[e.method]}`}>
                          {e.method}
                        </span>
                        <code className="font-mono text-[12.5px] text-ink">{e.path}</code>
                      </div>
                      <p className="text-[12.5px] leading-relaxed text-ink-3">{e.summary}</p>
                      {e.params?.length ? (
                        <div className="overflow-x-auto rounded-md border border-line">
                          <table className="w-full min-w-[420px] text-left text-[12px]">
                            <thead>
                              <tr className="border-b border-line bg-canvas/60 text-[11px] uppercase tracking-wide text-ink-4">
                                <th className="px-3 py-2 font-semibold">Parameter</th>
                                <th className="px-3 py-2 font-semibold">Type</th>
                                <th className="px-3 py-2 font-semibold">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {e.params.map((p) => (
                                <tr key={p.name}>
                                  <td className="px-3 py-2 font-mono text-[11.5px] text-ink">{p.name}</td>
                                  <td className="px-3 py-2 text-ink-3">{p.type}</td>
                                  <td className="px-3 py-2 text-ink-3">{p.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                      {e.request ? <CodeBlock language="json" filename="request" code={e.request} /> : null}
                      {e.response ? <CodeBlock language="json" filename="response" code={e.response} /> : null}
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader title="Authentication" />
                <div className="space-y-3 px-5 py-4">
                  <CodeBlock
                    language="bash"
                    filename="curl"
                    code={`curl ${GATEWAY.apiBase}/payment_intents \\
  -H "Authorization: Bearer $WHITEPAY_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":"1600.00","description":"Audit sprint"}'`}
                  />
                  <p className="text-[12px] leading-relaxed text-ink-3">
                    Secret keys authenticate server-to-server requests. Publishable keys are only accepted by
                    the hosted checkout widget. Amounts are always transmitted as base-unit integers in
                    responses.
                  </p>
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <div className="px-5 py-10 text-center text-[13px] text-ink-4">
                No endpoints match “{query}”.
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
