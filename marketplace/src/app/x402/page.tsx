import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AgentChat } from "./agent-chat";
import { ShoppingChat } from "./shopping-chat";

const steps = [
  ["Request", "An agent requests a paid resource. The server replies with HTTP 402 and the payment requirements."],
  ["Authorize", "A wallet signs an authorization for the quoted amount in test USDT on Whitechain Sepolia."],
  ["Settle", "EzPayz verifies and submits the authorization. The resource can return the result after settlement."],
];

export default function X402Page() {
  return (
    <>
      <section className="protocol-hero">
        <div className="site-width">
          <p className="eyebrow">Personal shopping / x402</p>
          <h1 className="display">Tell us what <em>you need.</em></h1>
          <p>Find something in the collection, review its price, and pay with test USDT when you’re ready.</p>
        </div>
      </section>
      <section className="site-width protocol-body">
        <div className="mb-12"><ShoppingChat /></div>
        <p className="eyebrow">How it works</p>
        <ol>{steps.map(([title, description], index) => (
          <li key={title}><span className="eyebrow">0{index + 1}</span><h2 className="display">{title}</h2><p>{description}</p></li>
        ))}</ol>
        <Link href="/items" className="text-link">Back to the shop <ArrowRight size={16} aria-hidden /></Link>
        <details className="mt-8 border-t border-[#D6CCBD] pt-4">
          <summary className="cursor-pointer font-medium">Developer x402 lab</summary>
          <div className="mt-4"><AgentChat /></div>
        </details>
      </section>
    </>
  );
}
