-- CreateEnum
CREATE TYPE "DraftOrderStatus" AS ENUM ('OPEN', 'INVOICE_SENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "DraftOrder" (
    "id" TEXT NOT NULL,
    "draftNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "DraftOrderStatus" NOT NULL DEFAULT 'OPEN',
    "shippingAddress1" TEXT,
    "shippingAddress2" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingZipCode" TEXT,
    "shippingCountry" TEXT,
    "shippingMethod" "ShippingMethod" NOT NULL DEFAULT 'GROUND',
    "notes" TEXT,
    "subtotalCents" INTEGER,
    "shippingFeeCents" INTEGER,
    "totalAmountCents" INTEGER,
    "orderId" TEXT,
    "checkoutUrl" TEXT,
    "checkoutExpiresAt" TIMESTAMP(3),
    "invoiceSentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftOrderItem" (
    "id" TEXT NOT NULL,
    "draftOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DraftOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DraftOrder_draftNumber_key" ON "DraftOrder"("draftNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DraftOrder_orderId_key" ON "DraftOrder"("orderId");

-- CreateIndex
CREATE INDEX "DraftOrder_customerId_idx" ON "DraftOrder"("customerId");

-- CreateIndex
CREATE INDEX "DraftOrder_createdById_idx" ON "DraftOrder"("createdById");

-- CreateIndex
CREATE INDEX "DraftOrder_status_idx" ON "DraftOrder"("status");

-- CreateIndex
CREATE INDEX "DraftOrder_createdAt_idx" ON "DraftOrder"("createdAt");

-- CreateIndex
CREATE INDEX "DraftOrderItem_draftOrderId_idx" ON "DraftOrderItem"("draftOrderId");

-- AddForeignKey
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrderItem" ADD CONSTRAINT "DraftOrderItem_draftOrderId_fkey" FOREIGN KEY ("draftOrderId") REFERENCES "DraftOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
