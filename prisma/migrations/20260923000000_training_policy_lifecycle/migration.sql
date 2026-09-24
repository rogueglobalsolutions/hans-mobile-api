-- Preserve existing enum values while extending the training lifecycle.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'RESCHEDULED');
CREATE TYPE "TrainingRequestType" AS ENUM ('CANCELLATION', 'RESCHEDULE');
CREATE TYPE "TrainingRequestStatus" AS ENUM ('PENDING', 'PAYMENT_REQUIRED', 'APPROVED', 'DECLINED', 'CANCELLED');

ALTER TABLE "Training"
  ADD COLUMN "endsAt" TIMESTAMP(3);

-- Existing trainings are single-day unless an Admin explicitly sets a final date.
UPDATE "Training" SET "endsAt" = "scheduledAt" WHERE "endsAt" IS NULL;

ALTER TABLE "Enrollment"
  ADD COLUMN "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "creditAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "creditIssuedAt" TIMESTAMP(3),
  ADD COLUMN "creditExpiresAt" TIMESTAMP(3),
  ADD COLUMN "trainingPriceAmount" INTEGER,
  ADD COLUMN "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "noShowFeeAmount" INTEGER,
  ADD COLUMN "noShowFeeStatus" "PaymentStatus",
  ADD COLUMN "noShowStripePaymentIntentId" TEXT;

-- Paid legacy enrollments keep their configured award snapshot without receiving it again.
UPDATE "Enrollment" e
SET
  "creditAmount" = CASE WHEN e."type" = 'ENROLLEE' THEN t."creditScore" ELSE 0 END,
  "trainingPriceAmount" = COALESCE(e."paidAmount", t."price")
FROM "Training" t
WHERE e."trainingId" = t."id";

CREATE TABLE "CreditGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enrollmentId" TEXT,
  "sourceKey" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "remainingAmount" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditGrant_enrollmentId_key" ON "CreditGrant"("enrollmentId");
CREATE UNIQUE INDEX "CreditGrant_sourceKey_key" ON "CreditGrant"("sourceKey");
CREATE INDEX "CreditGrant_userId_expiresAt_idx" ON "CreditGrant"("userId", "expiresAt");
CREATE INDEX "CreditGrant_userId_remainingAmount_idx" ON "CreditGrant"("userId", "remainingAmount");

ALTER TABLE "CreditGrant"
  ADD CONSTRAINT "CreditGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditGrant"
  ADD CONSTRAINT "CreditGrant_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing balances cannot be assigned a reliable historic expiry. Preserve them
-- as legacy grants; every new training grant receives a concrete expiry.
INSERT INTO "CreditGrant" (
  "id", "userId", "sourceKey", "amount", "remainingAmount", "expiresAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  "id",
  'legacy:' || "id",
  "creditBalance",
  "creditBalance",
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User"
WHERE "creditBalance" > 0;

CREATE TABLE "TrainingChangeRequest" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "originalTrainingId" TEXT NOT NULL,
  "requestedTrainingId" TEXT,
  "type" "TrainingRequestType" NOT NULL,
  "status" "TrainingRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "emergencyDetails" TEXT,
  "supportingDocumentPath" TEXT,
  "feeAmount" INTEGER NOT NULL DEFAULT 0,
  "feePaymentStatus" "PaymentStatus",
  "stripePaymentIntentId" TEXT,
  "stripeRefundId" TEXT,
  "refundAmount" INTEGER,
  "penaltyAmount" INTEGER,
  "emergencyWaived" BOOLEAN NOT NULL DEFAULT false,
  "adminNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingChangeRequest_stripePaymentIntentId_key"
  ON "TrainingChangeRequest"("stripePaymentIntentId");
CREATE INDEX "TrainingChangeRequest_enrollmentId_status_idx"
  ON "TrainingChangeRequest"("enrollmentId", "status");
CREATE INDEX "TrainingChangeRequest_originalTrainingId_status_idx"
  ON "TrainingChangeRequest"("originalTrainingId", "status");
CREATE INDEX "TrainingChangeRequest_requestedTrainingId_idx"
  ON "TrainingChangeRequest"("requestedTrainingId");

ALTER TABLE "TrainingChangeRequest"
  ADD CONSTRAINT "TrainingChangeRequest_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingChangeRequest"
  ADD CONSTRAINT "TrainingChangeRequest_originalTrainingId_fkey"
  FOREIGN KEY ("originalTrainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingChangeRequest"
  ADD CONSTRAINT "TrainingChangeRequest_requestedTrainingId_fkey"
  FOREIGN KEY ("requestedTrainingId") REFERENCES "Training"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingChangeRequest"
  ADD CONSTRAINT "TrainingChangeRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CreditReservationAllocation" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "grantId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "refundedAmount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditReservationAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditReservationAllocation_reservationId_grantId_key"
  ON "CreditReservationAllocation"("reservationId", "grantId");
CREATE INDEX "CreditReservationAllocation_grantId_idx"
  ON "CreditReservationAllocation"("grantId");

ALTER TABLE "CreditReservationAllocation"
  ADD CONSTRAINT "CreditReservationAllocation_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "CreditReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditReservationAllocation"
  ADD CONSTRAINT "CreditReservationAllocation_grantId_fkey"
  FOREIGN KEY ("grantId") REFERENCES "CreditGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
