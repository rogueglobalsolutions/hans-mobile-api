export const FREE_SHIPPING_THRESHOLD_CENTS = 250_000;

export function shippingFeeCents(upsRateUsd: number, cardMerchandiseCents: number): number {
  if (!Number.isFinite(upsRateUsd) || upsRateUsd < 0) {
    throw new Error("Unable to calculate shipping cost");
  }
  if (cardMerchandiseCents >= FREE_SHIPPING_THRESHOLD_CENTS) return 0;

  const upsRateCents = Math.round(upsRateUsd * 100);
  return Math.round(upsRateCents * 1.1);
}
