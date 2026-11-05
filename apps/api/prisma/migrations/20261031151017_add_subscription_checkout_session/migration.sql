-- CreateTable
CREATE TABLE "SubscriptionCheckoutSession" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "hostedSlug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionCheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCheckoutSession_hostedSlug_key" ON "SubscriptionCheckoutSession"("hostedSlug");

-- CreateIndex
CREATE INDEX "SubscriptionCheckoutSession_planId_idx" ON "SubscriptionCheckoutSession"("planId");

-- CreateIndex
CREATE INDEX "SubscriptionCheckoutSession_merchantId_idx" ON "SubscriptionCheckoutSession"("merchantId");
