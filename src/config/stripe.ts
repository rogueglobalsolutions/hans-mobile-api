import Stripe from "stripe";
import { TrainingLevel } from "../generated/prisma/enums";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export const TRAINING_LEVEL_STRIPE_PRICES: Record<TrainingLevel, string> = {
  MINT_LIFT_GROUP_TRAINING: "price_1TEuYgFuRxYezPHDKiwUoYfO",
  SUPPLEMENTAL:             "price_1TEubYFuRxYezPHDzl24GJFB",
  ADVANCED:                 "price_1TEv3BFuRxYezPHDzvHfAep6",
  PACKAGE_BUNDLE_1:         "price_1TEv4qFuRxYezPHD6IBlbWMW",
  PACKAGE_BUNDLE_2:         "price_1TEv5WFuRxYezPHD96NPzQnW",
};

// Observer price in cents ($500)
export const OBSERVER_PRICE_CENTS = 50000;
