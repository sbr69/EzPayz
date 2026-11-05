import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import { gatewayFetch } from "../client.js";

/**
 * Registers all documentation resources on the MCP server.
 * These give AI agents full context about the gateway — how to integrate, how it works,
 * API reference, EIP-3009 verification, etc.
 *
 * Resources are read-only (application-driven) — the host app reads them and includes
 * them in the LLM context. The AI doesn't "call" resources; it reads them.
 */
export function registerDocsResources(server: McpServer): void {
  // Helper: read a doc file from the repo (works when running from source or dist).
  function readDoc(filename: string): string {
    const paths = [
      resolve(process.cwd(), filename),
      resolve(process.cwd(), `../${filename}`),
      resolve(process.cwd(), `../../${filename}`),
      resolve(__dirname, `../../../${filename}`),
      resolve(__dirname, `../../../../${filename}`),
    ];
    for (const p of paths) {
      try {
        return readFileSync(p, "utf-8");
      } catch {
        // try next path
      }
    }
    return `# ${filename} not found\n\nThe file could not be located. If running from source, ensure you're in the repo root or packages/mcp directory.`;
  }

  // --- How to Use guide ---
  server.registerResource(
    "how-to-use",
    "whitechain://docs/how-to-use",
    { title: "How to Use the Gateway", mimeType: "text/markdown", description: "Complete developer integration guide — server-side setup, SDK usage, checkout widget, webhooks, refunds, subscriptions, payment links." },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: readDoc("HOW_TO_USE.md") }],
    })
  );

  // --- PRD ---
  server.registerResource(
    "prd",
    "whitechain://docs/prd",
    { title: "Product Requirements Document", mimeType: "text/markdown", description: "Full PRD — scope, goals, architecture, refund/subscription/invoice flows, security model, API requirements." },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: readDoc("docs/WHITECHAIN_PAYMENT_GATEWAY_PRD.md") }],
    })
  );

  // --- Payment Flow ---
  server.registerResource(
    "flow",
    "whitechain://docs/flow",
    { title: "Payment Flow Document", mimeType: "text/markdown", description: "End-to-end payment flow — intent creation, PayeeShield signing, EIP-3009 authorization, relayer submission, settlement, webhooks, refunds, subscriptions." },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: readDoc("docs/WHITECHAIN_PAYMENT_GATEWAY_FLOW.md") }],
    })
  );

  // --- EIP-3009 Verification ---
  server.registerResource(
    "eip-3009",
    "whitechain://docs/eip-3009",
    { title: "EIP-3009 Verification Report", mimeType: "text/markdown", description: "Verification that the Whitechain Sepolia USDT contract supports EIP-3009 (gasless TransferWithAuthorization). Includes live test transaction, domain separator, type hashes." },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: readDoc("docs/EIP3009_VERIFICATION.md") }],
    })
  );

  // --- API Reference (auto-generated from the status + known endpoints) ---
  server.registerResource(
    "api-reference",
    "whitechain://docs/api-reference",
    {
      title: "REST API Reference",
      mimeType: "text/markdown",
      description: "Complete REST API reference — all endpoints, parameters, auth requirements, response formats. Includes cursor pagination, idempotency, and the credential model (secret/publishable/clientSecret).",
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: "text/markdown",
        text: `# EzPayz — REST API Reference

## Authentication

All requests require \`Authorization: Bearer <token>\` where token is:
- **JWT** (dashboard login via POST /v1/auth/login)
- **Secret key** (\`wcp_sec_...\`, server-only, full write access)
- **Publishable key** (\`wcp_pub_...\`, browser-safe, read-only)

Write routes (POST/PATCH) require a secret key or JWT — publishable keys are blocked.

## Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/auth/register | Register a new merchant → { merchantId, token } |
| POST | /v1/auth/login | Login → { merchantId, token } |

### Merchants
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /v1/merchants/me | Any | Get merchant profile |
| PATCH | /v1/merchants/me | Secret/JWT | Update profile (name, logo, payout wallet, branding) |
| GET | /v1/merchants/wallet/challenge | Any | Get a wallet verification challenge |
| POST | /v1/merchants/wallet/verify | Secret/JWT | Verify wallet ownership (personal_sign) |

### API Keys
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /v1/api-keys | Secret/JWT | Create publishable + secret key pair |
| GET | /v1/api-keys | Any | List keys (includes lastUsedAt) |
| POST | /v1/api-keys/:id/revoke | Secret/JWT | Revoke a key |

### Payment Intents
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /v1/payment-intents | Secret + idempotency | Create a payment intent → { id, clientSecret, checkoutSlug, payeeShield } |
| GET | /v1/payment-intents | Any | List (cursor pagination: ?limit=20&cursor=<id>&status=succeeded&from=ISO&to=ISO) |
| GET | /v1/payment-intents/:id | Any | Get a specific payment intent |
| GET | /v1/payment-intents/:id/receipt.pdf | Any | Download receipt PDF |

### Checkout (public — no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | /v1/checkout/:slug | Get checkout session details (merchant, amount, PayeeShield, status) |
| POST | /v1/checkout/:slug/authorize | Submit EIP-3009 TransferWithAuthorization signature |
| GET | /v1/checkout/:slug/receipt.pdf | Download receipt PDF (public, only if succeeded) |
| GET | /v1/checkout/subscription/:slug | Get subscription checkout session details |

### Payment Links
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /v1/payment-links | Secret + idempotency | Create a payment link |
| GET | /v1/payment-links | Any | List (paginated) |
| GET | /v1/payment-links/:slug | Public | Resolve link details |
| POST | /v1/payment-links/:slug/checkout | Public | Create a payment intent from a link |
| POST | /v1/payment-links/:id/disable | Secret/JWT | Disable a link |

### Invoices
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /v1/invoices | Secret + idempotency | Create an invoice |
| GET | /v1/invoices | Any | List (paginated) |
| GET | /v1/invoices/:id | Any | Get an invoice |
| GET | /v1/invoices/:id/pdf | Any | Download invoice PDF |

### Refunds
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /v1/refunds | Secret + idempotency | Create a refund |
| GET | /v1/refunds | Any | List (paginated) |
| GET | /v1/refunds/:id | Any | Get a refund |
| POST | /v1/refunds/:id/authorize | Secret/JWT | Submit merchant-signed EIP-3009 refund authorization |

### Subscriptions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /v1/plans | Secret + idempotency | Create a subscription plan |
| GET | /v1/plans | Any | List plans (paginated) |
| POST | /v1/subscriptions/checkout | Secret + idempotency | Create a subscription checkout session |
| POST | /v1/subscriptions | Secret + idempotency | Record an on-chain subscription |
| GET | /v1/subscriptions | Any | List (paginated) |
| GET | /v1/subscriptions/:id | Any | Get a subscription |
| POST | /v1/subscriptions/:id/cancel | Secret/JWT | Cancel a subscription |
| POST | /v1/subscriptions/:id/renew-now | Secret/JWT | Trigger immediate renewal |

### Customers
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /v1/customers | Secret/JWT | Create a customer |
| GET | /v1/customers | Any | List (paginated + email search) |
| GET | /v1/customers/:id | Any | Get a customer |

### Webhooks
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /v1/webhooks | Secret + idempotency | Create a webhook endpoint |
| GET | /v1/webhooks | Any | List endpoints (paginated) |
| GET | /v1/webhooks/events | Any | List delivery events (paginated) |
| POST | /v1/webhooks/events/:id/replay | Secret/JWT | Replay a failed delivery |

### Other
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /v1/analytics/overview | Any | Analytics summary |
| GET | /v1/exceptions | Any | List payment exceptions (paginated) |
| GET | /v1/fulfilment | Any | List fulfilment orders (paginated) |
| GET | /health | None | Health check |
| GET | /v1/status | None | Gateway status (chain, token, capabilities) |

## Amounts

All amount fields accept **human-readable decimal strings** (e.g. \`"10.00"\` for 10 USDT). The gateway converts to base units (USDT has 6 decimals) internally.

## Idempotency

All POST routes accept an \`Idempotency-Key\` header. If the same key is sent twice, the gateway returns the original response (no duplicate). Auto-generated by the SDK if omitted.

## Cursor Pagination

All list endpoints support \`?limit=20&cursor=<lastItemId>\`. Response: \`{ data: [...], hasMore: boolean, nextCursor: string | null }\`.

## Webhook Verification

\`\`\`ts
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyWebhookSignature(secret: string, rawBody: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
// Header: x-whitechain-signature
\`\`\`
`,
      }],
    })
  );

  // --- SDK Guide ---
  server.registerResource(
    "sdk-guide",
    "whitechain://docs/sdk-guide",
    {
      title: "SDK Integration Guide",
      mimeType: "text/markdown",
      description: "How to install + use the @ezpayz/sdk npm package + standalone browser bundle. Includes server-side client, React checkout widget, subscription widget, amount helpers, webhook verification.",
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: "text/markdown",
        text: readDoc("packages/sdk/README.md"),
      }],
    })
  );

  // --- Gateway status (live) ---
  server.registerResource(
    "status",
    "whitechain://status",
    { title: "Gateway Status", mimeType: "application/json", description: "Live gateway status — network, chain ID, USDT token address, capabilities (EIP-3009, subscriptions)." },
    async (uri) => {
      let statusText: string;
      try {
        const status = await gatewayFetch<{ network: string; chainId: number; token: { symbol: string; address: string; decimals: number }; capabilities: Record<string, boolean>; subscriptionContract: string }>("/v1/status");
        statusText = JSON.stringify(status, null, 2);
      } catch {
        statusText = JSON.stringify({ error: "Could not reach the gateway API. Is it running? Check GATEWAY_API_URL." }, null, 2);
      }
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: statusText }] };
    }
  );
}
