-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MED', 'ADMIN', 'SALES_REP');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'PENDING_VERIFICATION', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TrainingType" AS ENUM ('ONLINE', 'HANDS_ON');

-- CreateEnum
CREATE TYPE "TrainingBrand" AS ENUM ('MINT_LIFT_PDO_THREADS', 'MINT_MICROCANNULA', 'KLARDIE', 'TARGETCOOL', 'EZ_TCON');

-- CreateEnum
CREATE TYPE "TrainingLevel" AS ENUM ('MINT_LIFT_GROUP_TRAINING', 'SUPPLEMENTAL', 'ADVANCED', 'PACKAGE_BUNDLE_1', 'PACKAGE_BUNDLE_2');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('ENROLLEE', 'OBSERVER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('EARNED', 'SPENT');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MediaSection" AS ENUM ('BEFORE', 'AFTER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "hasSubmittedVerification" BOOLEAN NOT NULL DEFAULT false,
    "medicalLicenseNumber" TEXT,
    "idDocumentFrontPath" TEXT,
    "idDocumentBackPath" TEXT,
    "verificationNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "profilePicturePath" TEXT,
    "country" TEXT,
    "city" TEXT,
    "stateProvince" TEXT,
    "zipCode" TEXT,
    "address" TEXT,
    "medDirectorFullName" TEXT,
    "medDirectorTitle" TEXT,
    "medDirectorTitleOther" TEXT,
    "practiceName" TEXT,
    "practiceAddressLine1" TEXT,
    "practiceAddressLine2" TEXT,
    "practiceCity" TEXT,
    "practiceState" TEXT,
    "practiceZipCode" TEXT,
    "practicePhone" TEXT,
    "isExistingCustomer" BOOLEAN,
    "agreedToTerms" BOOLEAN NOT NULL DEFAULT false,
    "subscribedToUpdates" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "type" "TrainingType" NOT NULL,
    "brand" "TrainingBrand" NOT NULL,
    "level" "TrainingLevel" NOT NULL,
    "learningFormats" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "speakerIntro" TEXT NOT NULL,
    "productsUsed" TEXT,
    "areasCovered" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "backgroundImagePath" TEXT,
    "location" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "price" INTEGER NOT NULL,
    "creditScore" INTEGER NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxEnrollees" INTEGER NOT NULL DEFAULT 4,
    "maxObservers" INTEGER NOT NULL DEFAULT 2,
    "observerPrice" INTEGER NOT NULL DEFAULT 500,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "type" "EnrollmentType" NOT NULL DEFAULT 'ENROLLEE',
    "salesRepId" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentIntentId" TEXT,
    "stripeRefundId" TEXT,
    "paidAmount" INTEGER,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "medUserId" TEXT NOT NULL,
    "salesRepId" TEXT,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "notes" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "zoomLink" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingFolder" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingDocument" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeforeAndAfterEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeforeAndAfterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeforeAndAfterMedia" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "section" "MediaSection" NOT NULL,
    "label" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,

    CONSTRAINT "BeforeAndAfterMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestEntryMedia" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "section" "MediaSection" NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL DEFAULT 'image',

    CONSTRAINT "ContestEntryMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestLike" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_trainingId_key" ON "Enrollment"("userId", "trainingId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestLike_entryId_adminId_key" ON "ContestLike"("entryId", "adminId");

-- AddForeignKey
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_medUserId_fkey" FOREIGN KEY ("medUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingFolder" ADD CONSTRAINT "TrainingFolder_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingFolder" ADD CONSTRAINT "TrainingFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TrainingFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDocument" ADD CONSTRAINT "TrainingDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "TrainingFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeforeAndAfterEntry" ADD CONSTRAINT "BeforeAndAfterEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeforeAndAfterMedia" ADD CONSTRAINT "BeforeAndAfterMedia_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "BeforeAndAfterEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestEntry" ADD CONSTRAINT "ContestEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestEntryMedia" ADD CONSTRAINT "ContestEntryMedia_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestLike" ADD CONSTRAINT "ContestLike_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestLike" ADD CONSTRAINT "ContestLike_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
