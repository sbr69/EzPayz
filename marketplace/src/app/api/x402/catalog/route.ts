import { isAddress } from "viem";
import { catalogPath, makeOffer } from "@/lib/server/x402";

export function GET() {
  const origin = URL.parse(process.env.APP_ORIGIN ?? "");
  const payTo = process.env.EZPAYZ_PAYOUT_WALLET;
  if (!origin || !payTo || !isAddress(payTo)) return Response.json({ error: "x402 resource is not configured" }, { status: 503 });
  const offer = makeOffer(payTo, origin.origin + catalogPath);
  return Response.json({ error: "Payment Required", accepts: [offer] }, {
    status: 402,
    headers: { "X-PAYMENT-REQUIREMENTS": Buffer.from(JSON.stringify(offer)).toString("base64"), "Cache-Control": "no-store" },
  });
}
