import { generatePaymentRequirements, USDT_ADDRESS, WHITECHAIN_NETWORK } from "@ezpayz/x402";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const catalogPath = "/api/x402/catalog";
export const priceUnits = 10_000;

export function makeOffer(payTo: string, resource: string) {
  return { ...generatePaymentRequirements({ price: "0.01", payTo, description: "Sill & Shelf catalog report" }), resource };
}

export function validateOffer(offer: unknown, payTo: string, resource: string) {
  if (typeof offer !== "object" || !offer) return false;
  const actual = offer as Record<string, unknown>;
  return Object.entries(makeOffer(payTo, resource)).every(([key, value]) => actual[key] === value);
}

export function settledHash(receipt: unknown): string | null {
  const result = receipt as { success?: unknown; txHash?: unknown } | null;
  return result?.success === true && typeof result.txHash === "string" && /^0x[a-f\d]{64}$/i.test(result.txHash)
    ? result.txHash : null;
}

export function operatorAuthorized(header: string | null) {
  const token = process.env.X402_OPERATOR_TOKEN;
  if (!token || token.length < 32 || !header?.startsWith("Bearer ")) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(header.slice(7)), hash(token));
}

export function agentConfig() {
  const origin = URL.parse(process.env.APP_ORIGIN ?? "");
  const api = URL.parse(process.env.EZPAYZ_API_URL ?? "");
  const payTo = process.env.EZPAYZ_PAYOUT_WALLET;
  const privateKey = process.env.X402_AGENT_PRIVATE_KEY;
  const merchantKey = process.env.EZPAYZ_SECRET_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;
  if (!origin || (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) ||
      !api || (api.protocol !== "https:" && !(api.protocol === "http:" && ["localhost", "127.0.0.1"].includes(api.hostname))) ||
      api.username || api.password || origin.username || origin.password ||
      !payTo || !isAddress(payTo) || !privateKey || !/^0x[a-f\d]{64}$/i.test(privateKey) ||
      !merchantKey || !groqKey || !model || !process.env.DATABASE_URL) return null;
  return { origin: origin.origin, api: api.origin, payTo, privateKey: privateKey as Hex, merchantKey, groqKey, model };
}

export async function requestCatalogPayment(config: NonNullable<ReturnType<typeof agentConfig>>, budgetDay: string) {
  const resource = config.origin + catalogPath;
  const challenge = await fetch(resource, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
  const encoded = challenge.headers.get("X-PAYMENT-REQUIREMENTS");
  if (challenge.status !== 402 || !encoded) throw new Error("Resource did not issue an x402 challenge");
  const offer: unknown = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  if (!validateOffer(offer, config.payTo, resource)) throw new Error("Payment challenge did not match the approved offer");
  const supported = await fetch(config.api + "/v1/x402/supported", { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!supported.ok) throw new Error("Facilitator discovery failed");
  const capabilities = await supported.json();
  if (!capabilities.schemes?.includes("exact") || !capabilities.networks?.includes(WHITECHAIN_NETWORK) ||
      capabilities.assets?.[WHITECHAIN_NETWORK]?.address?.toLowerCase() !== USDT_ADDRESS.toLowerCase()) {
    throw new Error("Facilitator does not advertise Whitechain Sepolia USDT");
  }
  const payer = privateKeyToAccount(config.privateKey);
  if (payer.address.toLowerCase() === config.payTo.toLowerCase()) throw new Error("Use a separate test buyer wallet");
  const now = Math.floor(Date.now() / 1000);
  if (new Date(now * 1000).toISOString().slice(0, 10) !== budgetDay) throw new Error("Daily reservation expired");
  const validBefore = BigInt(Math.min(now + 180, (Math.floor(now / 86400) + 1) * 86400));
  const message = { from: payer.address, to: config.payTo as Address, value: BigInt(priceUnits),
    validAfter: BigInt(now - 10), validBefore, nonce: `0x${randomBytes(32).toString("hex")}` as Hex };
  const signature = await payer.signTypedData({
    domain: { name: "Tether USD", version: "1", chainId: 1874, verifyingContract: USDT_ADDRESS },
    primaryType: "TransferWithAuthorization",
    types: { TransferWithAuthorization: [
      { name: "from", type: "address" }, { name: "to", type: "address" },
      { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
    ] },
    message,
  });
  const body = JSON.stringify({ paymentRequirements: offer, paymentPayload: {
    ...message, value: String(message.value), validAfter: String(message.validAfter), validBefore: String(message.validBefore), signature,
  } });
  const request = async (path: string) => {
    const response = await fetch(config.api + "/v1/x402/" + path, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(30000),
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + config.merchantKey }, body,
    });
    if (!response.ok) throw new Error("Facilitator request failed");
    return response.json();
  };
  if ((await request("verify"))?.isValid !== true) throw new Error("Facilitator rejected the authorization");
  const txHash = settledHash(await request("settle"));
  if (!txHash) throw new Error("Settlement was not confirmed");
  return txHash;
}
