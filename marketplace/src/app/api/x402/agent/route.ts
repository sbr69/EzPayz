import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/server/db";
import { listProducts } from "@/lib/server/store";
import { agentConfig, operatorAuthorized, priceUnits, requestCatalogPayment } from "@/lib/server/x402";

export const maxDuration = 90;

export async function POST(request: Request) {
  if (!operatorAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Enter the configured operator token." }, { status: 401 });
  }
  const config = agentConfig();
  if (!config) return Response.json({ error: "Complete the x402 environment setup first." }, { status: 503 });
  if (request.headers.get("origin") !== config.origin) {
    return Response.json({ error: "Open the app at the configured APP_ORIGIN." }, { status: 403 });
  }
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid agent request." }, { status: 400 });

  if (input.action === "propose" && typeof input.prompt === "string" && input.prompt.trim() && input.prompt.length <= 1000) {
    try {
      const reply = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { Authorization: "Bearer " + config.groqKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: "You can propose purchasing the Sill & Shelf catalog report for 0.01 test USDT. Only call the available tool if the user requests the report. A separate human approval is required before signing. Otherwise reply briefly." },
            { role: "user", content: input.prompt },
          ],
          tools: [{ type: "function", function: { name: "propose_catalog_report", description: "Propose buying the fixed testnet catalog report", parameters: { type: "object", properties: {}, additionalProperties: false } } }],
        }),
      });
      if (!reply.ok) return Response.json({ error: reply.status === 429 ? "Groq rate limit reached. Try again later." : "Groq rejected the request. Check the API key and model." }, { status: 502 });
      const message = (await reply.json()).choices?.[0]?.message;
      if (!message?.tool_calls?.some((call: { function?: { name?: string } }) => call.function?.name === "propose_catalog_report")) {
        return Response.json({ message: typeof message?.content === "string" ? message.content.slice(0, 1200) : "Ask for the paid catalog report." });
      }
      const id = randomUUID();
      await getSql()`INSERT INTO marketplace_x402_runs (id, pay_to) VALUES (${id}, ${config.payTo})`;
      return Response.json({ id, message: "Groq proposed the catalog report. Confirm 0.01 test USDT to continue.", payTo: config.payTo });
    } catch {
      return Response.json({ error: "Could not create an agent proposal. Check Groq and the database migration." }, { status: 502 });
    }
  }

  if (input.action === "approve" && typeof input.id === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input.id)) {
    try {
      const sql = getSql();
      const products = await listProducts();
      const [reservation] = await sql`
        WITH claimed AS (
          UPDATE marketplace_x402_runs SET approved_at = now()
          WHERE id = ${input.id} AND pay_to = ${config.payTo} AND approved_at IS NULL
            AND created_at > now() - interval '10 minutes'
          RETURNING id
        )
        INSERT INTO marketplace_x402_budget (day, spent)
        SELECT (now() AT TIME ZONE 'UTC')::date, ${priceUnits} FROM claimed
        ON CONFLICT (day) DO UPDATE SET spent = marketplace_x402_budget.spent + EXCLUDED.spent
        WHERE marketplace_x402_budget.spent + EXCLUDED.spent <= 100000
        RETURNING spent, day::text AS budget_day`;
      if (!reservation) return Response.json({ error: "Proposal expired, was already used, or reached the daily limit." }, { status: 409 });
      const txHash = await requestCatalogPayment(config, reservation.budget_day);
      await sql`UPDATE marketplace_x402_runs SET tx_hash = ${txHash} WHERE id = ${input.id}`;
      return Response.json({ txHash, report: products.map(({ name, price, category }) => ({ name, price, category })) });
    } catch {
      return Response.json({ error: "Settlement could not be confirmed. Check EzPayz before approving another payment." }, { status: 502 });
    }
  }
  return Response.json({ error: "Invalid agent request." }, { status: 400 });
}
