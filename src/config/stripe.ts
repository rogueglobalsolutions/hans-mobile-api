import Stripe from "stripe";
import { TrainingLevel } from "../generated/prisma/enums";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

function getPriceId(envKey: string, fallback: string) {
  return process.env[envKey] || fallback;
}

export const TRAINING_LEVEL_STRIPE_PRICES: Record<TrainingLevel, string> = {
  MINT_LIFT_GROUP_TRAINING: getPriceId("STRIPE_PRICE_MINT_LIFT_GROUP_TRAINING", "price_1TRushFuRxYezPHDAIujLRGU"),
  SUPPLEMENTAL:             getPriceId("STRIPE_PRICE_SUPPLEMENTAL", "price_1TRutDFuRxYezPHDFmJUYBdB"),
  ADVANCED:                 getPriceId("STRIPE_PRICE_ADVANCED", "price_1TRutgFuRxYezPHDoqyEPn0L"),
  PACKAGE_BUNDLE_1:         getPriceId("STRIPE_PRICE_PACKAGE_BUNDLE_1", "price_1TRuuCFuRxYezPHDW8qw7LPD"),
  PACKAGE_BUNDLE_2:         getPriceId("STRIPE_PRICE_PACKAGE_BUNDLE_2", "price_1TRuupFuRxYezPHD5ClaxvmF"),
};

// Observer one-time price id
export const OBSERVER_STRIPE_PRICE_ID = getPriceId("STRIPE_PRICE_OBSERVER", "price_1TRuvMFuRxYezPHDRvWZ5UZP");
