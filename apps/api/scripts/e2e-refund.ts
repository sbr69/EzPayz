import { privateKeyToAccount } from "viem/accounts";
const PK = (process.env.PK || "").startsWith("0x") ? process.env.PK : "0x" + process.env.PK;
const WALLET = process.env.WALLET!;
const REFUND_ID = process.env.RID!;
const PAYER = process.env.PAYER!;
const AMOUNT = process.env.AMOUNT!;
const SECRET = process.env.SECRET!;
const USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";
const account = privateKeyToAccount(PK as `0x${string}`);
async function main() {
  const now = Math.floor(Date.now() / 1000);
  const nonce = "0x" + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
  const signature = await account.signTypedData({
    domain: { name: "Tether USD", version: "1", chainId: 1874, verifyingContract: USDT as `0x${string}` },
    types: { TransferWithAuthorization: [
      { name: "from", type: "address" }, { name: "to", type: "address" },
      { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
    ]},
    primaryType: "TransferWithAuthorization",
    message: { from: WALLET as `0x${string}`, to: PAYER as `0x${string}`, value: BigInt(AMOUNT), validAfter: BigInt(now-60), validBefore: BigInt(now+600), nonce: nonce as `0x${string}` },
  });
  console.error("Signed: " + signature.slice(0,20) + "...");
  const res = await fetch(`http://localhost:3000/v1/refunds/${REFUND_ID}/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SECRET}` },
    body: JSON.stringify({ from: WALLET, to: PAYER, value: AMOUNT, validAfter: String(now-60), validBefore: String(now+600), nonce, signature }),
  });
  const body = await res.json();
  console.error("Authorize: " + res.status + " " + JSON.stringify(body));
  if (!res.ok) { console.log(JSON.stringify({error: body})); return; }
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pr = await fetch(`http://localhost:3000/v1/refunds/${REFUND_ID}`, { headers: { Authorization: `Bearer ${SECRET}` } });
    const pb = await pr.json();
    const status = pb.refund?.status || pb.status;
    console.error("  [" + i + "] refund=" + status);
    if (status === "succeeded") { console.log(JSON.stringify({status:"succeeded"})); return; }
    if (status === "failed") { console.log(JSON.stringify({status:"failed"})); return; }
  }
  console.log(JSON.stringify({status:"timeout"}));
}
main().catch(e => console.log(JSON.stringify({error: e.message})));
