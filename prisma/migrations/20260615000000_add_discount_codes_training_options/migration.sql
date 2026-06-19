-- Add training special offers/sub-options and discount code support.
ALTER TYPE "TrainingLevel" ADD VALUE IF NOT EXISTS 'SPECIAL_OFFER';

ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "subOptions" JSONB;

DO $$
BEGIN
  CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DiscountApplicableTo" AS ENUM ('TRAINING', 'PRODUCTS', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DiscountCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "DiscountType" NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "applicableTo" "DiscountApplicableTo" NOT NULL DEFAULT 'BOTH',
  "maxUses" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DiscountCode_code_key" ON "DiscountCode"("code");
CREATE INDEX IF NOT EXISTS "DiscountCode_code_idx" ON "DiscountCode"("code");
CREATE INDEX IF NOT EXISTS "DiscountCode_isActive_idx" ON "DiscountCode"("isActive");
