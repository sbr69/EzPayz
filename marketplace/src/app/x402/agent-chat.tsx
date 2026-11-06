"use client";

import { useState, type FormEvent } from "react";
import { formatUsdt } from "@/features/storefront/cart";
import { Button } from "@/components/ui/button";

type Reply = {
  id?: string;
  message?: string;
  error?: string;
  payTo?: string;
  txHash?: string;
  report?: { name: string; price: number; category: string }[];
};

export function AgentChat() {
  const [token, setToken] = useState("");
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<Reply>({});
  const [busy, setBusy] = useState(false);
  async function send(action: "propose" | "approve") {
    setBusy(true);
    const id = reply.id;
    setReply({});
    try {
      const response = await fetch("/api/x402/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(action === "propose" ? { action, prompt } : { action, id }),
      });
      setReply(await response.json());
    } catch {
      setReply({ error: action === "approve" ? "Connection interrupted. Check EzPayz before approving another payment." : "Could not reach the agent." });
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send("propose");
  }
  return (
    <section className="work-panel mb-10 max-w-2xl" aria-labelledby="agent-heading">
      <h2 id="agent-heading">Agent chat</h2>
      <p className="my-3 text-sm">Ask Groq for the catalog report. The agent proposes the purchase, and you authorize it separately.</p>
      <form onSubmit={submit} className="grid gap-3">
        <label htmlFor="operator-token" className="text-sm font-medium">Operator token</label>
        <input id="operator-token" type="password" value={token} onChange={event => setToken(event.target.value)} required minLength={32} maxLength={128} autoComplete="off" className="rounded-lg border border-[#D6CCBD] bg-white p-3" />
        <label htmlFor="agent-prompt" className="text-sm font-medium">Message</label>
        <textarea id="agent-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} required maxLength={1000} placeholder="Buy the catalog report" className="rounded-lg border border-[#D6CCBD] bg-white p-3" />
        <Button disabled={busy} className="justify-self-start">{busy ? "Working…" : "Ask agent"}</Button>
      </form>
      <div role="status" className="mt-4 text-sm">{reply.error || reply.message}</div>
      {reply.id && (
        <div className="mt-4 rounded-lg border border-[#D6CCBD] p-4">
          <p className="break-all text-sm">Recipient {reply.payTo}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void send("approve")}>Confirm 0.01 test USDT</Button>
            <Button variant="outline" onClick={() => setReply({ message: "Cancelled. No payment was submitted." })}>Cancel</Button>
          </div>
        </div>
      )}
      {reply.txHash && (
        <div className="mt-4">
          <p className="font-semibold">Settled on Whitechain Sepolia</p>
          <a className="text-link break-all" href={"https://explorer.testnet.whitechain.io/tx/" + reply.txHash}>View transaction</a>
          <ul className="mt-3 space-y-2 text-sm">{reply.report?.map((item) => <li key={item.name}>{item.name} · {item.category} · {formatUsdt(item.price)}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
