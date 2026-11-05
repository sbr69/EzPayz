/**
 * Amount conversion helpers for the browser/merchant app.
 *
 * The public API accepts human-readable decimal strings (e.g. "10.00").
 * Internally and on-chain, USDT uses 6 decimal base-unit integers (e.g. "10000000").
 * These helpers let the merchant's frontend format display amounts from the base-unit
 * values returned by the checkout/payment APIs.
 */

export const USDT_DECIMALS = 6;

/**
 * Formats a base-unit integer string as a human-readable decimal string.
 * @example formatBaseUnits("10000000") → "10.00"
 * @example formatBaseUnits("10000")    → "0.01"
 */
export function formatBaseUnits(baseUnits: string, decimals: number = USDT_DECIMALS): string {
  const v = BigInt(baseUnits || "0");
  const factor = 10n ** BigInt(decimals);
  const intPart = v / factor;
  const fracPart = v % factor;
  const fracStr = fracPart.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr.length === 0 ? `${intPart}.00` : `${intPart}.${fracStr.length < 2 ? fracStr.padEnd(2, "0") : fracStr}`;
}

/**
 * Parses a human-readable decimal amount into a base-unit integer string.
 * @example parseHumanAmount("10.00") → "10000000"
 * @example parseHumanAmount("0.01")  → "10000"
 * @throws if the input is invalid or has more than `decimals` fractional digits.
 */
export function parseHumanAmount(input: string, decimals: number = USDT_DECIMALS): string {
  if (typeof input !== "string" || !/^\d+(\.\d+)?$/.test(input)) {
    throw new Error(`Amount must be a decimal string like "10.00" (got "${input}")`);
  }
  const [intPart, fracPart = ""] = input.split(".");
  if (fracPart.length > decimals) {
    throw new Error(`Amount has more than ${decimals} decimal places (got "${input}")`);
  }
  const factor = 10n ** BigInt(decimals);
  const intUnits = BigInt(intPart) * factor;
  const fracPadded = fracPart.padEnd(decimals, "0");
  const fracUnits = fracPadded === "" ? 0n : BigInt(fracPadded);
  return (intUnits + fracUnits).toString();
}
