-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('testnet', 'mainnet');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('created', 'requires_authorization', 'authorized', 'submitted', 'pending_confirmation', 'succeeded', 'underpaid', 'overpaid', 'expired', 'failed', 'cancelled', 'partially_refunded', 'refunded', 'exception');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('one_time', 'payment_link', 'invoice', 'subscription', 'usage');

-- CreateEnum
CREATE TYPE "PaymentSourceKind" AS ENUM ('checkout_session', 'payment_link', 'invoice', 'subscription');

-- CreateEnum
CREATE TYPE "EmailDeliveryState" AS ENUM ('not_applicable', 'queued', 'sent', 'delivered', 'failed', 'suppressed');

-- CreateEnum
CREATE TYPE "PayeeShieldStatus" AS ENUM ('verified', 'verification_pending', 'invalid_signature', 'tampered', 'expired', 'signing_key_revoked');

-- CreateEnum
CREATE TYPE "SigningKeyStatus" AS ENUM ('active', 'rotating', 'revoked');

-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('fixed', 'usage');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('fixed', 'customer_amount', 'reusable');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'open', 'paid', 'partially_paid', 'overpaid', 'uncollectible', 'void', 'expired');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('created', 'awaiting_authorization', 'authorized', 'submitted', 'pending_confirmation', 'succeeded', 'failed', 'exception');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('hourly', 'daily', 'monthly');

-- CreateEnum
CREATE TYPE "RetryBackoff" AS ENUM ('fixed', 'linear', 'exponential');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('pending_authorization', 'pending_activation', 'active', 'renewal_due', 'processing', 'past_due', 'paused', 'cancelled', 'expired', 'failed');

-- CreateEnum
CREATE TYPE "RenewalAttemptStatus" AS ENUM ('scheduled', 'submitted', 'succeeded', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "FulfilmentStatus" AS ENUM ('not_started', 'processing', 'fulfilled', 'cancelled', 'return_requested', 'refund_initiated', 'refunded');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('underpayment', 'overpayment', 'duplicate_payment', 'expired_invoice_paid_late', 'failed_transaction', 'transaction_reverted', 'insufficient_subscription_balance', 'insufficient_allowance', 'relayer_failure', 'refund_failure', 'webhook_delivery_failure', 'email_delivery_failure', 'unconfirmed_payment', 'reconciliation_mismatch');

-- CreateEnum
CREATE TYPE "ExceptionSeverity" AS ENUM ('critical', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('open', 'investigating', 'action_required', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ExceptionActionId" AS ENUM ('retry_webhook', 'replay_event', 'recheck_transaction', 'mark_for_review', 'create_balance_due_request', 'initiate_refund', 'resolve', 'dismiss');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "WebhookHealth" AS ENUM ('healthy', 'degraded', 'failing', 'untested');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('pending', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "RelayerOperation" AS ENUM ('payment_relay', 'refund_relay', 'subscription_renewal', 'subscription_activation');

-- CreateEnum
CREATE TYPE "RelayerTxStatus" AS ENUM ('submitted', 'confirmed', 'failed', 'rejected', 'pending');

-- CreateEnum
CREATE TYPE "BudgetScope" AS ENUM ('merchant', 'global');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('payment', 'refund', 'subscription', 'exception', 'system');

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "website" TEXT NOT NULL DEFAULT '',
    "businessEmail" TEXT NOT NULL,
    "supportEmail" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "logoText" TEXT NOT NULL DEFAULT 'W',
    "accentColor" TEXT NOT NULL DEFAULT '#0ea5e9',
    "payoutWallet" TEXT NOT NULL,
    "walletVerified" BOOLEAN NOT NULL DEFAULT false,
    "walletVerifiedAt" TIMESTAMP(3),
    "environment" "Environment" NOT NULL DEFAULT 'testnet',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantApiKey" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "publishable" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "secretLast4" TEXT NOT NULL,
    "permissions" TEXT[],
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "MerchantApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "wallet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPaymentAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageGlyph" TEXT NOT NULL DEFAULT '$',
    "price" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDT',
    "billingMode" "BillingMode" NOT NULL DEFAULT 'fixed',
    "unitLabel" TEXT,
    "unitPrice" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" TEXT NOT NULL,
    "receivedAmount" TEXT,
    "refundedAmount" TEXT NOT NULL DEFAULT '0',
    "token" TEXT NOT NULL DEFAULT 'USDT',
    "network" TEXT NOT NULL DEFAULT 'whitechain-sepolia',
    "kind" "PaymentKind" NOT NULL DEFAULT 'one_time',
    "sourceKind" "PaymentSourceKind",
    "sourceId" TEXT,
    "sourceLabel" TEXT,
    "payerWallet" TEXT,
    "payoutWallet" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'created',
    "txRef" TEXT,
    "authorizationRef" TEXT,
    "gasSponsored" BOOLEAN NOT NULL DEFAULT true,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "invoiceId" TEXT,
    "paymentLinkId" TEXT,
    "subscriptionId" TEXT,
    "fulfilmentId" TEXT,
    "checkoutUrl" TEXT NOT NULL DEFAULT '',
    "receiptEmail" "EmailDeliveryState" NOT NULL DEFAULT 'not_applicable',
    "payeeShieldJson" JSONB,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTimelineEntry" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simulated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PaymentTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "hostedSlug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "linkType" "LinkType" NOT NULL DEFAULT 'fixed',
    "amount" TEXT,
    "minAmount" TEXT,
    "maxAmount" TEXT,
    "productId" TEXT,
    "reference" TEXT,
    "returnUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "totalCollected" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "total" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "orderReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "receiptEmailedAt" TIMESTAMP(3),
    "tampered" BOOLEAN NOT NULL DEFAULT false,
    "payeeShieldJson" JSONB,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" TEXT NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnChainTransaction" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 1874,
    "txHash" TEXT NOT NULL,
    "tokenContract" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "blockNumber" BIGINT,
    "receiptStatus" TEXT,
    "paymentId" TEXT,
    "refundId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnChainTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "customerId" TEXT,
    "amount" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" "RefundStatus" NOT NULL DEFAULT 'created',
    "gasSponsored" BOOLEAN NOT NULL DEFAULT true,
    "authorizationRef" TEXT,
    "txRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "customerNotified" "EmailDeliveryState" NOT NULL DEFAULT 'not_applicable',

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundTimelineEntry" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simulated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RefundTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDT',
    "billingMode" "BillingMode" NOT NULL DEFAULT 'fixed',
    "unitLabel" TEXT,
    "unitPrice" TEXT,
    "interval" "BillingInterval" NOT NULL DEFAULT 'monthly',
    "maxChargePerCycle" TEXT NOT NULL,
    "cumulativeLimit" TEXT NOT NULL,
    "planExpiryMonths" INTEGER,
    "retryPolicyJson" JSONB NOT NULL,
    "notifyCustomer" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "onChainSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'pending_authorization',
    "amount" TEXT NOT NULL,
    "interval" "BillingInterval" NOT NULL DEFAULT 'monthly',
    "maxChargePerCycle" TEXT NOT NULL,
    "cumulativeLimit" TEXT NOT NULL,
    "spent" TEXT NOT NULL DEFAULT '0',
    "allowanceRemaining" TEXT NOT NULL,
    "nextBillingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "allowanceRevokedAt" TIMESTAMP(3),
    "activationTxRef" TEXT,
    "approvalTxRef" TEXT,
    "retryPolicyJson" JSONB NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenewalAttempt" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "status" "RenewalAttemptStatus" NOT NULL DEFAULT 'scheduled',
    "amount" TEXT NOT NULL,
    "reason" TEXT,
    "txRef" TEXT,
    "billingSequence" TEXT,

    CONSTRAINT "RenewalAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionBillingHistory" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,

    CONSTRAINT "SubscriptionBillingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "unitPrice" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "merchantReference" TEXT NOT NULL,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "billedPaymentId" TEXT,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfilmentOrder" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT,
    "orderReference" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "status" "FulfilmentStatus" NOT NULL DEFAULT 'not_started',
    "trackingNumber" TEXT,
    "completionUrl" TEXT,
    "merchantNotes" TEXT NOT NULL DEFAULT '',
    "customerNotes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FulfilmentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfilmentEvent" (
    "id" TEXT NOT NULL,
    "fulfilmentId" TEXT NOT NULL,
    "status" "FulfilmentStatus" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL DEFAULT 'merchant',
    "customerVisible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FulfilmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "eventTypes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "signingSecretHash" TEXT NOT NULL,
    "signingSecretLast4" TEXT NOT NULL,
    "health" "WebhookHealth" NOT NULL DEFAULT 'untested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDeliveryAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "payloadSummary" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "responseStatus" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "relatedPaymentId" TEXT,
    "relatedSubscriptionId" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentException" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" "ExceptionType" NOT NULL,
    "severity" "ExceptionSeverity" NOT NULL DEFAULT 'medium',
    "status" "ExceptionStatus" NOT NULL DEFAULT 'open',
    "paymentId" TEXT,
    "customerId" TEXT,
    "subscriptionId" TEXT,
    "amount" TEXT,
    "webhookEventId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "whatHappened" TEXT NOT NULL,
    "whyItHappened" TEXT NOT NULL DEFAULT '',
    "suggestedAction" TEXT NOT NULL DEFAULT '',
    "recommendedAction" "ExceptionActionId" NOT NULL DEFAULT 'mark_for_review',

    CONSTRAINT "PaymentException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionAttempt" (
    "id" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT NOT NULL DEFAULT '',
    "succeeded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResolutionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelayerTransaction" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "operation" "RelayerOperation" NOT NULL,
    "gasSponsored" TEXT NOT NULL DEFAULT 'true',
    "wbtCost" TEXT NOT NULL DEFAULT '0',
    "status" "RelayerTxStatus" NOT NULL DEFAULT 'pending',
    "txRef" TEXT NOT NULL,
    "paymentId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelayerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelayerBudget" (
    "id" TEXT NOT NULL,
    "scope" "BudgetScope" NOT NULL,
    "merchantId" TEXT,
    "maxSpendWbt" TEXT NOT NULL,
    "currentUsageWbt" TEXT NOT NULL DEFAULT '0',
    "dailyLimitWbt" TEXT NOT NULL,
    "dailySpentWbt" TEXT NOT NULL DEFAULT '0',
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paused" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RelayerBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GasGuardPolicy" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "maxGasPerTxGwei" INTEGER NOT NULL DEFAULT 100,
    "merchantBudgetWbt" TEXT NOT NULL,
    "merchantSpentWbt" TEXT NOT NULL DEFAULT '0',
    "dailyLimitWbt" TEXT NOT NULL,
    "dailySpentWbt" TEXT NOT NULL DEFAULT '0',
    "allowedNetwork" TEXT NOT NULL DEFAULT 'whitechain-sepolia',
    "allowedToken" TEXT NOT NULL DEFAULT '0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7',
    "allowedContract" TEXT NOT NULL,
    "allowedFunctions" TEXT[],
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "authorizationExpiryCheck" BOOLEAN NOT NULL DEFAULT true,
    "replayProtection" BOOLEAN NOT NULL DEFAULT true,
    "emergencyPaused" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GasGuardPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "requestBodyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyJson" JSONB NOT NULL,
    "status" "EmailDeliveryState" NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "relatedPaymentId" TEXT,
    "relatedRefundId" TEXT,
    "relatedSubscriptionId" TEXT,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppNotification" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "kind" "NotificationKind" NOT NULL,
    "link" TEXT,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Merchant_environment_idx" ON "Merchant"("environment");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_businessEmail_key" ON "Merchant"("businessEmail");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantApiKey_publishable_key" ON "MerchantApiKey"("publishable");

-- CreateIndex
CREATE INDEX "MerchantApiKey_merchantId_idx" ON "MerchantApiKey"("merchantId");

-- CreateIndex
CREATE INDEX "Customer_merchantId_idx" ON "Customer"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_merchantId_email_key" ON "Customer"("merchantId", "email");

-- CreateIndex
CREATE INDEX "CustomerNote_customerId_idx" ON "CustomerNote"("customerId");

-- CreateIndex
CREATE INDEX "Product_merchantId_active_idx" ON "Product"("merchantId", "active");

-- CreateIndex
CREATE INDEX "PaymentIntent_merchantId_status_idx" ON "PaymentIntent"("merchantId", "status");

-- CreateIndex
CREATE INDEX "PaymentIntent_merchantId_createdAt_idx" ON "PaymentIntent"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentIntent_txRef_idx" ON "PaymentIntent"("txRef");

-- CreateIndex
CREATE INDEX "PaymentIntent_authorizationRef_idx" ON "PaymentIntent"("authorizationRef");

-- CreateIndex
CREATE INDEX "PaymentTimelineEntry_paymentId_at_idx" ON "PaymentTimelineEntry"("paymentId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_hostedSlug_key" ON "CheckoutSession"("hostedSlug");

-- CreateIndex
CREATE INDEX "CheckoutSession_paymentId_idx" ON "CheckoutSession"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLink_slug_key" ON "PaymentLink"("slug");

-- CreateIndex
CREATE INDEX "PaymentLink_merchantId_active_idx" ON "PaymentLink"("merchantId", "active");

-- CreateIndex
CREATE INDEX "Invoice_merchantId_status_idx" ON "Invoice"("merchantId", "status");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "OnChainTransaction_txHash_key" ON "OnChainTransaction"("txHash");

-- CreateIndex
CREATE INDEX "OnChainTransaction_paymentId_idx" ON "OnChainTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "OnChainTransaction_tokenContract_to_idx" ON "OnChainTransaction"("tokenContract", "to");

-- CreateIndex
CREATE INDEX "Refund_merchantId_paymentId_idx" ON "Refund"("merchantId", "paymentId");

-- CreateIndex
CREATE INDEX "Refund_txRef_idx" ON "Refund"("txRef");

-- CreateIndex
CREATE INDEX "RefundTimelineEntry_refundId_at_idx" ON "RefundTimelineEntry"("refundId", "at");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_merchantId_active_idx" ON "SubscriptionPlan"("merchantId", "active");

-- CreateIndex
CREATE INDEX "Subscription_merchantId_status_idx" ON "Subscription"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Subscription_customerId_idx" ON "Subscription"("customerId");

-- CreateIndex
CREATE INDEX "Subscription_nextBillingAt_idx" ON "Subscription"("nextBillingAt");

-- CreateIndex
CREATE INDEX "RenewalAttempt_subscriptionId_scheduledFor_idx" ON "RenewalAttempt"("subscriptionId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "RenewalAttempt_subscriptionId_billingSequence_key" ON "RenewalAttempt"("subscriptionId", "billingSequence");

-- CreateIndex
CREATE INDEX "SubscriptionBillingHistory_subscriptionId_at_idx" ON "SubscriptionBillingHistory"("subscriptionId", "at");

-- CreateIndex
CREATE INDEX "UsageRecord_subscriptionId_billed_idx" ON "UsageRecord"("subscriptionId", "billed");

-- CreateIndex
CREATE INDEX "FulfilmentOrder_merchantId_status_idx" ON "FulfilmentOrder"("merchantId", "status");

-- CreateIndex
CREATE INDEX "FulfilmentOrder_paymentId_idx" ON "FulfilmentOrder"("paymentId");

-- CreateIndex
CREATE INDEX "FulfilmentEvent_fulfilmentId_at_idx" ON "FulfilmentEvent"("fulfilmentId", "at");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_merchantId_active_idx" ON "WebhookEndpoint"("merchantId", "active");

-- CreateIndex
CREATE INDEX "WebhookEvent_merchantId_status_idx" ON "WebhookEvent"("merchantId", "status");

-- CreateIndex
CREATE INDEX "WebhookEvent_nextRetryAt_idx" ON "WebhookEvent"("nextRetryAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_endpointId_idx" ON "WebhookEvent"("endpointId");

-- CreateIndex
CREATE INDEX "PaymentException_merchantId_status_idx" ON "PaymentException"("merchantId", "status");

-- CreateIndex
CREATE INDEX "PaymentException_paymentId_idx" ON "PaymentException"("paymentId");

-- CreateIndex
CREATE INDEX "ResolutionAttempt_exceptionId_at_idx" ON "ResolutionAttempt"("exceptionId", "at");

-- CreateIndex
CREATE INDEX "RelayerTransaction_merchantId_status_idx" ON "RelayerTransaction"("merchantId", "status");

-- CreateIndex
CREATE INDEX "RelayerTransaction_txRef_idx" ON "RelayerTransaction"("txRef");

-- CreateIndex
CREATE INDEX "RelayerBudget_merchantId_idx" ON "RelayerBudget"("merchantId");

-- CreateIndex
CREATE INDEX "GasGuardPolicy_merchantId_idx" ON "GasGuardPolicy"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_merchantId_key_key" ON "IdempotencyRecord"("merchantId", "key");

-- CreateIndex
CREATE INDEX "OutboxEvent_merchantId_processedAt_idx" ON "OutboxEvent"("merchantId", "processedAt");

-- CreateIndex
CREATE INDEX "EmailLog_merchantId_status_idx" ON "EmailLog"("merchantId", "status");

-- CreateIndex
CREATE INDEX "AppNotification_merchantId_read_at_idx" ON "AppNotification"("merchantId", "read", "at");

-- CreateIndex
CREATE INDEX "SecurityEvent_merchantId_at_idx" ON "SecurityEvent"("merchantId", "at");

-- AddForeignKey
ALTER TABLE "PaymentTimelineEntry" ADD CONSTRAINT "PaymentTimelineEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundTimelineEntry" ADD CONSTRAINT "RefundTimelineEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalAttempt" ADD CONSTRAINT "RenewalAttempt_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionBillingHistory" ADD CONSTRAINT "SubscriptionBillingHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfilmentEvent" ADD CONSTRAINT "FulfilmentEvent_fulfilmentId_fkey" FOREIGN KEY ("fulfilmentId") REFERENCES "FulfilmentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionAttempt" ADD CONSTRAINT "ResolutionAttempt_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "PaymentException"("id") ON DELETE CASCADE ON UPDATE CASCADE;
