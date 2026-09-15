-- Bring previously committed product-weight and ad models under migration control.
ALTER TABLE "Product" ADD COLUMN "weightLbs" DOUBLE PRECISION;

CREATE TABLE "AdConfig" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdSlide" (
    "id" TEXT NOT NULL,
    "adConfigId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "redirectUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdSlide_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdSlide_adConfigId_idx" ON "AdSlide"("adConfigId");

ALTER TABLE "AdSlide" ADD CONSTRAINT "AdSlide_adConfigId_fkey"
FOREIGN KEY ("adConfigId") REFERENCES "AdConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
