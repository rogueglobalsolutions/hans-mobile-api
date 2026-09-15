-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancellationRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cancellationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "cancellationRequestReason" TEXT;

-- CreateIndex
CREATE INDEX "Order_cancellationRequested_idx" ON "Order"("cancellationRequested");
