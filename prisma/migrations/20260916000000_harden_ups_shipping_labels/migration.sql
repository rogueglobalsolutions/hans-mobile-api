ALTER TABLE "ShippingLabel"
ADD COLUMN "activeKey" TEXT,
ADD COLUMN "errorMessage" TEXT;

CREATE UNIQUE INDEX "ShippingLabel_activeKey_key" ON "ShippingLabel"("activeKey");
