import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { gatewayFetch, type GatewayError } from "../client.js";

/**
 * Error formatter — converts a GatewayError into an MCP tool error result
 * (isError: true + human-readable text). This lets the LLM self-correct.
 */
function toolError(e: unknown) {
  const err = e as GatewayError;
  return {
    content: [{ type: "text" as const, text: `Error: ${err.message ?? String(e)}` }],
    isError: true,
  };
}

/** Success result — JSON in a text block + structuredContent for typed clients. */
function toolSuccess(data: unknown) {
  const json = JSON.stringify(data, null, 2);
  return {
    content: [{ type: "text" as const, text: json }],
    structuredContent: data as Record<string, unknown>,
  };
}

/**
 * Registers all gateway tools on the MCP server.
 * Tools are model-controlled — the AI can invoke them autonomously.
 */
export function registerTools(server: McpServer): void {

  // --- Payments ---

  server.registerTool(
    "create_payment_intent",
    {
      title: "Create Payment Intent",
      description: "Create a gasless USDT payment intent on Whitechain Sepolia. Returns a checkoutSlug + clientSecret for the checkout widget. Amount is human-readable (e.g. \"10.00\"). Requires GATEWAY_SECRET_KEY.",
      inputSchema: {
        amount: z.string().describe('Human-readable USDT amount, e.g. "10.00"'),
        description: z.string().describe("Payment description shown to the customer"),
        customerEmail: z.string().email().optional().describe("Optional customer email"),
        successUrl: z.string().url().optional().describe("URL to redirect the customer after successful payment"),
        cancelUrl: z.string().url().optional().describe("URL to redirect on failure/cancel"),
        idempotencyKey: z.string().optional().describe("Optional idempotency key (auto-generated if omitted)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const result = await gatewayFetch("/v1/payment-intents", {
          method: "POST",
          body: { amount: args.amount, description: args.description, customerEmail: args.customerEmail, successUrl: args.successUrl, cancelUrl: args.cancelUrl },
          idempotencyKey: args.idempotencyKey ?? `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
        return toolSuccess(result);
      } catch (e) { return toolError(e); }
    }
  );

  server.registerTool(
    "list_payments",
    {
      title: "List Payments",
      description: "List payment intents with cursor pagination. Returns recent payments (amount, status, description, tx hash). Filter by status or date range.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe("Page size (default 20, max 100)"),
        cursor: z.string().optional().describe("Cursor from the previous page's nextCursor"),
        status: z.string().optional().describe('Filter by status: created, requires_authorization, authorized, processing, succeeded, failed'),
        from: z.string().optional().describe('ISO date — payments created after this date'),
        to: z.string().optional().describe('ISO date — payments created before this date'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      try {
        const params = new URLSearchParams();
        if (args.limit) params.set("limit", String(args.limit));
        if (args.cursor) params.set("cursor", args.cursor);
        if (args.status) params.set("status", args.status);
        if (args.from) params.set("from", args.from);
        if (args.to) params.set("to", args.to);
        const result = await gatewayFetch(`/v1/payment-intents?${params}`);
        return toolSuccess(result);
      } catch (e) { return toolError(e); }
    }
  );

  server.registerTool(
    "get_payment",
    {
      title: "Get Payment",
      description: "Get a single payment intent by ID. Returns full details including status, amount, tx hash, payer wallet, PayeeShield signature.",
      inputSchema: {
        paymentIntentId: z.string().describe("The payment intent ID (e.g. cmvwr...)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      try {
        const result = await gatewayFetch(`/v1/payment-intents/${args.paymentIntentId}`);
        return toolSuccess(result);
      } catch (e) { return toolError(e); }
    }
  );

  // --- Payment Links ---

  server.registerTool(
    "create_payment_link",
    {
      title: "Create Payment Link",
      description: "Create a reusable payment link. For fixed-amount links, the customer pays a set amount. For customer-amount links, the customer enters their own amount. The link URL is /l/<slug>.",
      inputSchema: {
        title: z.string().describe("Link title shown to the customer"),
        linkType: z.enum(["fixed", "customer_amount", "reusable"]).optional().describe("Link type (default: fixed)"),
        amount: z.string().optional().describe('Amount for fixed links, e.g. "10.00"'),
        minAmount: z.string().optional().describe('Minimum amount for customer_amount links'),
        maxAmount: z.string().optional().describe('Maximum amount for customer_amount links'),
        description: z.string().optional().describe("Optional description"),
        idempotencyKey: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const result = await gatewayFetch("/v1/payment-links", {
          method: "POST",
          body: { title: args.title, linkType: args.linkType ?? "fixed", amount: args.amount, minAmount: args.minAmount, maxAmount: args.maxAmount, description: args.description ?? "" },
          idempotencyKey: args.idempotencyKey ?? `mcp-${Date.now()}`,
        });
        return toolSuccess(result);
      } catch (e) { return toolError(e); }
    }
  );

  // --- Refunds ---

  server.registerTool(
    "create_refund",
    {
      title: "Create Refund",
      description: "Create a full or partial refund for a succeeded payment. The refund amount is human-readable (e.g. \"5.00\"). After creating, the merchant must sign the EIP-3009 authorization in the dashboard (POST /v1/refunds/:id/authorize).",
      inputSchema: {
        paymentId: z.string().describe("The payment intent ID to refund"),
        amount: z.string().describe('Refund amount in human-readable USDT, e.g. "5.00"'),
        reason: z.string().optional().describe("Optional reason for the refund"),
        idempotencyKey: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const result = await gatewayFetch("/v1/refunds", {
          method: "POST",
          body: { paymentId: args.paymentId, amount: args.amount, reason: args.reason ?? "" },
          idempotencyKey: args.idempotencyKey ?? `mcp-${Date.now()}`,
        });
        return toolSuccess(result);
      } catch (e) { return toolError(e); }
    }
  );

  server.registerTool(
    "list_refunds",
    {
      title: "List Refunds",
      description: "List refunds with cursor pagination.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      try {
        const params = new URLSearchParams();
        if (args.limit) params.set("limit", String(args.limit));
        if (args.cursor) params.set("cursor", args.cursor);
        const result = await gatewayFetch(`/v1/refunds?${params}`);
        return toolSuccess(result);
      } catch (e) { return toolError(e); }
    }
  );

  // --- Customers ---

  server.registerTool(
    "list_customers",
    {
      title: "List Customers",
      description: "List customers with cursor pagination. Optionally search by email.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
        email: z.string().optional().describe("Search by email (partial match)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      try {
        const params = new URLSearchParams();
        if (args.limit) params.set("limit", String(args.limit));
        if (args.cursor) params.set("cursor", args.cursor);
        if (args.email) params.set("email", args.email);
        const result = await gatewayFetch(`/v1/customers?${params}`);
        return toolSuccess(result);
      } catch (e) { return toolError(e); }
    }
  );

  // --- Subscriptions ---

  server.registerTool(
    "list_subscriptions",
    {
      title: "List Subscriptions",
      description: "List subscriptions with cursor pagination.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      try {
        const params = new URLSearchParams();
        if (args.limit) params.set("limit", String(args.limit));
        if (args.cursor) params.set("cursor", args.cursor);
        const result = await gatewayFetch(`/v1/subscriptions?${params}`);
        return toolSuccess(result);
      } catch (e) { return toolError(e); }
    }
  );

  server.registerTool(
    "create_plan",
    {
      title: "Create Subscription Plan",
      description: "Create a subscription plan. Amounts are human-readable (e.g. \"10.00\"). The plan defines the recurring charge amount, interval, and cumulative limits.",
      inputSchema: {
        name: z.string().describe("Plan name"),
        amount: z.string().describe('Charge amount per cycle, e.g. "10.00"'),
        interval: z.enum(["hourly", "daily", "monthly"]).optional().describe("Billing interval (default: monthly)"),
        maxChargePerCycle: z.string().describe('Maximum charge per cycle, e.g. "10.00"'),
        cumulativeLimit: z.string().describe('Cumulative spending cap, e.g. "120.00"'),
        description: z.string().optional(),
        idempotencyKey: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const result = await gatewayFetch("/v1/plans", {
          method: "POST",
          body: { name: args.name, amount: args.amount, interval: args.interval ?? "monthly", maxChargePerCycle: args.maxChargePerCycle, cumulativeLimit: args.cumulativeLimit, description: args.description ?? "" },
          idempotencyKey: args.idempotencyKey ?? `mcp-${Date.now()}`,
        });
        return toolSuccess(result);
      } catch (e) { return toolError(e); }
    }
  );

  // --- Analytics ---

  server.registerTool(
    "get_analytics",
    {
      title: "Get Analytics Overview",
      description: "Get the merchant's analytics summary — total volume, success rate, recent transactions, refund totals.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async () => {
      try {
        const result = await gatewayFetch("/v1/analytics/overview");
        return toolSuccess(result);
      } catch (e) { return toolError(e); }
    }
  );

  // --- Webhook Verification ---

  server.registerTool(
    "verify_webhook_signature",
    {
      title: "Verify Webhook Signature",
      description: "Verify a webhook event signature (HMAC-SHA256). The merchant's webhook signing secret is used with the raw request body + the x-whitechain-signature header. Returns true/false.",
      inputSchema: {
        signingSecret: z.string().describe("The webhook endpoint's signing secret (shown once on creation)"),
        rawBody: z.string().describe("The raw request body string"),
        signature: z.string().describe("The x-whitechain-signature header value"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const { createHmac, timingSafeEqual } = await import("node:crypto");
        const expected = createHmac("sha256", args.signingSecret).update(args.rawBody).digest("hex");
        const a = Buffer.from(args.signature);
        const b = Buffer.from(expected);
        const valid = a.length === b.length && timingSafeEqual(a, b);
        return toolSuccess({ valid });
      } catch (e) { return toolError(e); }
    }
  );
}
