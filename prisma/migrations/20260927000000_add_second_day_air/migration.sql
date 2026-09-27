ALTER TYPE "ShippingMethod" ADD VALUE 'SECOND_DAY_AIR';

UPDATE "Product" SET "groundShippingOnly" = false WHERE "groundShippingOnly" = true;
