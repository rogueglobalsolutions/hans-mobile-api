-- Persist training application drafts and participant completion.
CREATE TYPE "TrainingApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "EnrollmentAttendanceStatus" AS ENUM ('PENDING', 'COMPLETED', 'NO_SHOW');
CREATE TYPE "CreditReservationStatus" AS ENUM ('RESERVED', 'APPLIED', 'RELEASED');

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Enrollment"
ADD COLUMN "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN "attendanceStatus" "EnrollmentAttendanceStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "completedBy" TEXT;

ALTER TABLE "Product" ADD COLUMN "creditEligible" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order"
ADD COLUMN "creditAppliedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "creditRefundedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cardAmountCents" INTEGER;

UPDATE "Order" SET "cardAmountCents" = "totalAmountCents" WHERE "cardAmountCents" IS NULL;

CREATE TABLE "TrainingApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "trainingId" TEXT NOT NULL,
  "salesRepId" TEXT,
  "prequalificationAnswers" JSONB,
  "registrationDetails" JSONB,
  "backgroundCheckAnswers" JSONB,
  "termsVersion" TEXT,
  "termsAcceptedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "status" "TrainingApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnrollmentPaymentAttempt" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "stripePaymentIntentId" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnrollmentPaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditReservation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" "CreditReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "appliedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingApplication_userId_trainingId_key" ON "TrainingApplication"("userId", "trainingId");
CREATE INDEX "TrainingApplication_trainingId_status_idx" ON "TrainingApplication"("trainingId", "status");
CREATE INDEX "TrainingApplication_salesRepId_idx" ON "TrainingApplication"("salesRepId");
CREATE UNIQUE INDEX "EnrollmentPaymentAttempt_stripePaymentIntentId_key" ON "EnrollmentPaymentAttempt"("stripePaymentIntentId");
CREATE INDEX "EnrollmentPaymentAttempt_enrollmentId_status_idx" ON "EnrollmentPaymentAttempt"("enrollmentId", "status");
CREATE UNIQUE INDEX "CreditReservation_orderId_key" ON "CreditReservation"("orderId");
CREATE INDEX "CreditReservation_userId_status_idx" ON "CreditReservation"("userId", "status");

ALTER TABLE "TrainingApplication" ADD CONSTRAINT "TrainingApplication_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingApplication" ADD CONSTRAINT "TrainingApplication_trainingId_fkey"
FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingApplication" ADD CONSTRAINT "TrainingApplication_salesRepId_fkey"
FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnrollmentPaymentAttempt" ADD CONSTRAINT "EnrollmentPaymentAttempt_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing catalog entries under the MINT vendor are eligible for product credits.
UPDATE "Product" SET "creditEligible" = true WHERE lower(COALESCE("vendor", '')) = 'mint';
