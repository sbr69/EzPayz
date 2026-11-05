-- AlterTable
ALTER TABLE "PaymentIntent" ADD COLUMN     "cancelUrl" TEXT,
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "successUrl" TEXT;
