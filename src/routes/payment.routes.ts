import { Router, raw } from "express";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";
import * as paymentController from "../controllers/payment.controller";

const router = Router();

// Public — frontend needs publishable key
router.get("/config", paymentController.getConfig);

// Stripe webhook — raw body required for signature verification
router.post(
  "/webhook",
  raw({ type: "application/json" }),
  paymentController.handleWebhook,
);

// MED-only — create payment intent + pending enrollment
router.post(
  "/create-intent",
  authenticateToken,
  requireRole(Role.MED),
  paymentController.createPaymentIntent,
);

// MED-only — confirm enrollment after successful payment
router.post(
  "/confirm",
  authenticateToken,
  requireRole(Role.MED),
  paymentController.confirmPayment,
);

export default router;
