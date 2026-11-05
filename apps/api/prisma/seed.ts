import { PrismaClient } from "../src/db/generated";

const prisma = new PrismaClient();

/**
 * Seed: two merchants (A and B) for the cross-tenant isolation demo (PRD §24.4),
 * plus demo products, a subscription plan, a webhook endpoint, a GasGuard policy,
 * and a global relayer budget.
 *
 * Run: pnpm --filter @ezpayz/api exec prisma db seed
 * (requires DATABASE_URL pointing at Neon Postgres)
 */
async function main() {
  // ----- Merchant A (Acme) -----
  const acme = await prisma.merchant.create({
    data: {
      businessName: "Acme Inc",
      displayName: "Acme",
      website: "https://acme.example",
      businessEmail: "owner@acme.example",
      supportEmail: "support@acme.example",
      description: "Digital goods merchant",
      payoutWallet: "0xa201EEE38742FE108556089F1F330dcC3944071A",
      walletVerified: true,
      walletVerifiedAt: new Date(),
      environment: "testnet",
      onboardingComplete: true,
      country: "US",
      passwordHash: "$2a$10$placeholderhash_acme_not_real",
    },
  });

  await prisma.product.create({
    data: {
      merchantId: acme.id,
      name: "Pro Subscription",
      description: "Monthly pro plan",
      imageGlyph: "P",
      price: "10000000", // 10 USDT (6 decimals)
      currency: "USDT",
      billingMode: "fixed",
      active: true,
    },
  });

  await prisma.subscriptionPlan.create({
    data: {
      merchantId: acme.id,
      name: "Pro Monthly",
      description: "10 USDT / month, capped at 100 USDT",
      amount: "10000000",
      maxChargePerCycle: "10000000",
      cumulativeLimit: "100000000",
      interval: "monthly",
      planExpiryMonths: 12,
      retryPolicyJson: { maxAttempts: 3, backoff: "exponential", intervalMinutes: 60, gracePeriodMinutes: 1440 },
      notifyCustomer: true,
      active: true,
    },
  });

  await prisma.webhookEndpoint.create({
    data: {
      merchantId: acme.id,
      url: "https://demo.acme.example/webhooks/whitechain",
      description: "Acme demo webhook",
      eventTypes: ["payment.succeeded", "payment.failed", "refund.succeeded", "subscription.renewed"],
      active: true,
      signingSecretHash: "$2a$10$placeholder_signing_secret_acme",
      signingSecretLast4: "abcd",
    },
  });

  await prisma.gasGuardPolicy.create({
    data: {
      merchantId: acme.id,
      merchantBudgetWbt: "1000000000000000000", // 1 WBT
      dailyLimitWbt: "100000000000000000",
      allowedContract: "0x0b8Da2EE37f3599141aFD500b1e2699D5A6bCdbB",
      allowedFunctions: ["transferWithAuthorization", "charge"],
    },
  });

  // ----- Merchant B (Globex) — for isolation testing -----
  const globex = await prisma.merchant.create({
    data: {
      businessName: "Globex Corp",
      displayName: "Globex",
      website: "https://globex.example",
      businessEmail: "owner@globex.example",
      supportEmail: "support@globex.example",
      description: "SaaS platform",
      payoutWallet: "0x116B846282713aa64d33DD4cA56157704Cba6279",
      walletVerified: true,
      walletVerifiedAt: new Date(),
      environment: "testnet",
      onboardingComplete: true,
      country: "US",
      passwordHash: "$2a$10$placeholderhash_globex_not_real",
    },
  });

  await prisma.product.create({
    data: {
      merchantId: globex.id,
      name: "Starter Plan",
      price: "5000000", // 5 USDT
      currency: "USDT",
      billingMode: "fixed",
      active: true,
    },
  });

  // ----- Global relayer budget -----
  await prisma.relayerBudget.create({
    data: {
      scope: "global",
      maxSpendWbt: "10000000000000000000", // 10 WBT
      dailyLimitWbt: "1000000000000000000", // 1 WBT
    },
  });

  console.log("Seeded merchants:", acme.id, globex.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
