-- Refund restorations are not newly earned training credits.
UPDATE "CreditTransaction"
SET "type" = 'RESTORED'
WHERE "type" = 'EARNED'
  AND "description" LIKE 'Credit restored from refund for order %'
  AND "referenceId" IN (SELECT "id" FROM "Order");

-- Historic full refunds did not record the credit that could not be restored.
-- Attribute only the known unreturned credit to the most recent successful refund.
WITH refund_totals AS (
  SELECT
    o."id" AS "orderId",
    LEAST(
      GREATEST(o."creditAppliedCents" - o."creditRefundedCents", 0),
      GREATEST(o."totalAmountCents" - SUM(r."amountCents"), 0)
    ) AS "unrestoredCents"
  FROM "Order" o
  JOIN "OrderRefund" r ON r."orderId" = o."id" AND r."status" = 'SUCCEEDED'
  WHERE o."paymentStatus" = 'REFUNDED'
  GROUP BY o."id"
), latest_refund AS (
  SELECT DISTINCT ON (r."orderId") r."id", r."orderId"
  FROM "OrderRefund" r
  WHERE r."status" = 'SUCCEEDED'
  ORDER BY r."orderId", r."createdAt" DESC, r."id" DESC
)
UPDATE "OrderRefund" r
SET "forfeitedCreditCents" = t."unrestoredCents"
FROM refund_totals t
JOIN latest_refund l ON l."orderId" = t."orderId"
WHERE r."id" = l."id" AND t."unrestoredCents" > 0;
