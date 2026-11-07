import { Link } from "react-router-dom";
import { ArrowRight, Code2, BookOpen } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { CodeBlock } from "@/components/ui/display";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { GATEWAY } from "@/config/app";
import { PageHero } from "./MarketingLayout";

const STEPS = [
  {
    title: "Create an account",
    body: "Connect your payout wallet and configure checkout in a guided onboarding flow.",
  },
  {
    title: "Drop in the SDK",
    body: "Create a payment intent server-side and render the checkout widget with your publishable key.",
  },
  {
    title: "Get notified",
    body: "Subscribe to webhook events and reconcile settlement, refunds and renewals.",
  },
  {
    title: "Operate after payment",
    body: "Track fulfilment, resolve exceptions and analyse volume from one dashboard.",
  },
];

export function BuildPage() {
  return (
    <div>
      <PageHero
        title={
          <>
            Built for <span className="italic text-accent">developers</span> first.
          </>
        }
        lede={`A typed SDK (${GATEWAY.sdkPackage}), predictable resources, signed webhooks and x402 rails for AI-agent payments. The integration below is the whole checkout surface.`}
      />

      {/* Code */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid w-full gap-6 px-5 py-16 lg:grid-cols-2 sm:px-8 lg:px-10 2xl:px-16">
          <Reveal>
            <CodeBlock
              dense
              language="ts"
              filename="server/create-intent.ts"
              caption="Provisional API surface — the backend contract is not finalised."
              code={`import { EzPayz } from "@whitepay/usdt-sdk";

const wp = new EzPayz({ secretKey: process.env.SECRET_KEY! });

const session = await wp.checkout.sessions.create({
  amount: "1600.00",
  token: "USDT",
  network: "whitechain-sepolia",
  description: "Audit sprint — balance",
  expiresInHours: 72,
  successUrl: "https://example.com/thanks",
});

console.log(session.url);`}
            />
          </Reveal>
          <Reveal delay={0.15}>
            <CodeBlock
              dense
              language="tsx"
              filename="app/checkout.tsx"
              code={`import { EzPayzProvider, Checkout } from "@whitepay/usdt-sdk";

export default function Pay() {
  return (
    <EzPayzProvider publishableKey={process.env.PUBLIC_KEY!}>
      <Checkout
        sessionId={session.id}
        onSuccess={(payment) => router.push("/receipt/" + payment.id)}
      />
    </EzPayzProvider>
  );
}`}
            />
          </Reveal>
        </div>
      </section>

      {/* Steps */}
      <section className="border-b border-line">
        <div className="mx-auto w-full px-5 py-16 sm:px-8 lg:px-12 2xl:px-20">
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" gap={0.07}>
            {STEPS.map((s, i) => (
              <StaggerItem key={s.title}>
                <Card className="h-full p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[14px] font-bold text-accent tnum">
                    {i + 1}
                  </span>
                  <h3 className="mt-2.5 text-[20px] font-semibold tracking-[-0.01em] text-ink">{s.title}</h3>
                  <p className="mt-1 text-[16px] leading-relaxed text-ink-3">{s.body}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Docs CTA */}
      <section className="bg-surface">
        <div className="mx-auto w-full px-5 py-16 sm:px-8 lg:px-12 2xl:px-20">
          <Reveal>
            <Card className="flex flex-wrap items-center justify-between gap-5 p-6 sm:p-8">
              <div>
                <h2 className="font-display text-[30px] leading-tight text-ink sm:text-[36px]">
                  The full guides live in the <span className="italic text-accent">dashboard</span>.
                </h2>
                <p className="mt-2 max-w-xl text-[17px] leading-relaxed text-ink-3">
                  Sign in to the merchant workspace to explore the SDK quickstart and the searchable
                  API reference with seeded data.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link to="/developers/quickstart">
                  <Button variant="primary" icon={<Code2 className="h-4 w-4" />}>
                    SDK quickstart
                  </Button>
                </Link>
                <Link to="/developers/api-reference">
                  <Button variant="secondary" icon={<BookOpen className="h-4 w-4" />}>
                    API reference
                  </Button>
                </Link>
                <Link to="/sign-up">
                  <Button variant="ghost" iconRight={<ArrowRight className="h-4 w-4" />}>
                    Create an account
                  </Button>
                </Link>
              </div>
            </Card>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

export default BuildPage;
