import { Router } from "express";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";
import * as paymentController from "../controllers/payment.controller";

const router = Router();

// Public — frontend needs publishable key
router.get("/config", paymentController.getConfig);

// MED-only — create payment intent + pending enrollment
router.post(
  "/create-intent",
  authenticateToken,
  requireRole(Role.MED),
  paymentController.createPaymentIntent,
);

// MED-only — confirm enrollment after successful payment
router.post(
  "/fail",
  authenticateToken,
  requireRole(Role.MED),
  paymentController.failPayment,
);

router.post(
  "/confirm",
  authenticateToken,
  requireRole(Role.MED),
  paymentController.confirmPayment,
);

export default router;
