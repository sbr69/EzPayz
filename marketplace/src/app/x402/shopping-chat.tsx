"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUp, ShoppingBag, Wallet } from "lucide-react";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import { WalletStatus } from "@/components/ui/wallet-status";
import { buyerPaymentPath, matchesBuyerOffer, paymentDomain, paymentMessage, paymentTypes, walletErrorMessage, type BuyerQuote } from "@/lib/agent-purchase";
import { formatUsdt } from "@/features/storefront/cart";
import { browserWallet, checkShopWallet, readShopWallet } from "./shop-wallet";
import { useShopWallet } from "@/features/storefront/wallet-context";

type Item = { slug: string; name: string; image: string; price: number; category: string; description: string };
type Message = { role: "assistant" | "buyer"; text: string; items?: Item[] };

async function request(payload: object, payment?: string) {
  return fetch(buyerPaymentPath, {
    method: "POST", headers: { "Content-Type": "application/json", ...(payment ? { "X-PAYMENT": payment } : {}) },
    body: JSON.stringify(payload),
  });
}

export function ShoppingChat() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [started, setStarted] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [quote, setQuote] = useState<BuyerQuote>();
  const [receipt, setReceipt] = useState<{ id: string; txHash: string }>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reviewId, setReviewId] = useState("");
  const { connected, setConnected, connect, connecting, walletError } = useShopWallet();
  const transcript = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const log = transcript.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  function connectFromChat() {
    setError("");
    void connect();
  }

  function begin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStarted(true);
    setMessages([{ role: "assistant", text: `Hi ${name.trim()}. What are you shopping for today?` }]);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    setQuote(undefined);
    setPrompt("");
    setError("");
    setBusy("Searching the collection…");
    setMessages((previous) => [...previous, { role: "buyer", text }]);
    try {
      const query = [...messages.filter((message) => message.role === "buyer").slice(-2).map((message) => message.text), text].join("\n").slice(-600);
      const response = await request({ action: "search", query });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessages((previous) => [...previous, { role: "assistant", text: data.message, items: data.items }]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t search the collection.");
    } finally { setBusy(""); }
  }

  async function choose(item: Item) {
    setError("");
    setReceipt(undefined);
    setBusy("Preparing your quote…");
    try {
      const response = await request({ action: "quote", name, email, slug: item.slug });
      const data = await response.json();
      const encoded = response.headers.get("X-PAYMENT-REQUIREMENTS");
      if (response.status !== 402 || !encoded || !data.quote) throw new Error(data.error || "The store couldn’t issue a quote.");
      if (!matchesBuyerOffer(data.quote, JSON.parse(atob(encoded)))) throw new Error("The quote does not match the payment request.");
      setQuote(data.quote);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t prepare checkout.");
    } finally { setBusy(""); }
  }

  async function pay() {
    if (!quote || !connected || busy) return;
    setError("");
    setBusy("Waiting for your wallet…");
    let submitted = false;
    try {
      if (Date.now() >= quote.validBefore * 1000) {
        setQuote(undefined);
        throw new Error("Quote expired. Review the item again for a new quote.");
      }
      const wallet = browserWallet();
      const current = await checkShopWallet(connected.address);
      const { address: from, balance } = current;
      setConnected(current);
      if (balance < BigInt(quote.amount)) throw new Error(`Insufficient test USDT. This order needs ${formatUsdt(quote.amount)}.`);
      const signature = await wallet.signTypedData({ account: from, domain: paymentDomain,
        types: paymentTypes, primaryType: "TransferWithAuthorization", message: paymentMessage(quote, from) })
        .catch((error) => { throw new Error(walletErrorMessage(error, "sign")); });
      setBusy("Verifying and settling with EzPayz…");
      submitted = true;
      const response = await request({ action: "pay", id: quote.id }, btoa(JSON.stringify({ from, signature })));
      const data = await response.json();
      if (!response.ok) {
        submitted = Boolean(data.reviewRequired);
        if (response.status === 409) setQuote(undefined);
        throw new Error(data.error || "EzPayz couldn’t process the payment.");
      }
      setReceipt(data);
      setQuote(undefined);
      const refreshed = await readShopWallet(from).catch(() => undefined);
      if (refreshed) setConnected(refreshed);
    } catch (failure) {
      if (submitted) {
        setReviewId(quote.id);
        setQuote(undefined);
      }
      setError(submitted ? "Payment status is uncertain. Check the order before paying again." :
        failure instanceof Error ? failure.message : "Payment could not be completed.");
    } finally { setBusy(""); }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#D6CCBD] bg-[#fffdf8] shadow-sm" aria-label="Shopping assistant">
      <div className="flex items-center gap-3 border-b border-[#D6CCBD] p-4 sm:p-6">
        <ShoppingBag size={22} aria-hidden />
        <div><h2 className="font-semibold">Sill &amp; Shelf assistant</h2><p className="text-sm text-[#565A64]">Shop the collection · Test USDT</p></div>
      </div>
      {!started ? (
        <form onSubmit={begin} className="mx-auto grid max-w-md gap-3 p-5 sm:p-8">
          <p className="mb-2 text-sm">Tell us your name and email to start. You’ll connect a wallet only if you choose to pay.</p>
          <label htmlFor="shop-name" className="text-sm font-medium">Name</label>
          <input id="shop-name" required maxLength={100} autoComplete="name" className="rounded-lg border border-[#D6CCBD] p-3" value={name} onChange={(event) => setName(event.target.value)} />
          <label htmlFor="shop-email" className="text-sm font-medium">Email</label>
          <input id="shop-email" required type="email" maxLength={100} autoComplete="email" className="rounded-lg border border-[#D6CCBD] p-3" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Button disabled={!name.trim()}>Start shopping</Button>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D6CCBD] px-4 py-3 text-xs sm:px-6">
            <WalletStatus connected={Boolean(connected)} connecting={connecting} />
            <p>{connected ? <><strong>Whitechain Sepolia</strong> · {connected.address.slice(0, 6)}…{connected.address.slice(-4)} · {formatUnits(connected.balance, 6)} test USDT</> : "Connect a funded Whitechain Sepolia wallet to pay."}</p>
            <Button type="button" variant="outline" disabled={Boolean(busy) || connecting} onClick={connectFromChat}>
              <Wallet size={16} aria-hidden /> {connecting ? "Connecting…" : connected ? "Refresh wallet" : "Connect wallet"}
            </Button>
          </div>
          <div ref={transcript} role="log" className="max-h-[32rem] min-h-44 space-y-4 overflow-y-auto p-4 sm:p-6">
            {messages.map((message, index) => (
              <div key={index} className={message.role === "buyer" ? "ml-auto w-fit max-w-[85%]" : "max-w-full"}>
                <p className={message.role === "buyer" ? "rounded-2xl bg-[#28334B] px-4 py-3 text-sm text-white" : "inline-block rounded-2xl bg-[#F2EBDD] px-4 py-3 text-sm"}>{message.text}</p>
                {message.items?.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {message.items.map((item) => (
                    <article key={item.slug} className="overflow-hidden rounded-xl border border-[#D6CCBD] bg-white">
                      <div className="relative aspect-[3/2] overflow-hidden"><Image src={item.image} fill sizes="(max-width: 640px) 100vw, 40vw" alt={item.name} className="object-cover" /></div>
                      <div className="space-y-2 p-3">
                        <p className="text-xs text-[#565A64]">{item.category}</p>
                        <h3 className="text-sm font-semibold">{item.name}</h3>
                        <p className="text-sm font-semibold">{formatUsdt(item.price)}</p>
                        <p className="line-clamp-2 text-xs text-[#565A64]">{item.description}</p>
                        <details className="text-xs">
                          <summary className="cursor-pointer font-semibold">Show more details</summary>
                          <p className="mt-2 leading-relaxed">{item.description}</p>
                        </details>
                        <Button type="button" variant="outline" disabled={Boolean(busy) || Boolean(reviewId)} onClick={() => void choose(item)}>Review purchase</Button>
                      </div>
                    </article>
                  ))}
                </div> : null}
              </div>
            ))}
          </div>
          {quote && (
            <div className="mx-4 mb-4 rounded-xl border border-[#D6CCBD] bg-[#FAF7F0] p-4 sm:mx-6">
              <p className="font-semibold">{quote.item} · {formatUsdt(quote.amount)}</p>
              <p className="mt-1 break-all text-xs">Whitechain Sepolia · Recipient {quote.payTo}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {connected ? (
                  <Button disabled={Boolean(busy) || connected.balance < BigInt(quote.amount)} onClick={() => void pay()}>Confirm with wallet</Button>
                ) : <Button disabled={Boolean(busy) || connecting} onClick={connectFromChat}>Connect wallet to continue</Button>}
                <Button variant="outline" disabled={Boolean(busy)} onClick={() => setQuote(undefined)}>Cancel</Button>
              </div>
              {connected && connected.balance < BigInt(quote.amount) && <p className="mt-2 text-sm">Insufficient test USDT for this quote. Fund the connected wallet, then refresh its balance.</p>}
            </div>
          )}
          <div role="status" className="px-4 text-sm sm:px-6">
            {busy || error || walletError}
            {reviewId && <Link className="ml-2 underline" href={`/orders/${reviewId}`}>View order for review</Link>}
            {receipt && <p>Paid. <Link className="underline" href={`/orders/${receipt.id}`}>View your order</Link> · <a className="underline" href={`https://explorer.testnet.whitechain.io/tx/${receipt.txHash}`}>View transaction</a></p>}
          </div>
          <form onSubmit={send} className="flex gap-2 p-4 sm:p-6">
            <input aria-label="Describe what you want" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={600} placeholder="A gift for someone who loves coffee…" className="min-w-0 flex-1 rounded-lg border border-[#D6CCBD] px-3 text-sm" />
            <Button size="icon" disabled={Boolean(busy) || !prompt.trim()} aria-label="Send message"><ArrowUp size={18} aria-hidden /></Button>
          </form>
        </>
      )}
    </section>
  );
}
