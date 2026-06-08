import { Router } from "express";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";
import * as discountController from "../controllers/discount.controller";

const router = Router();

// ─── Admin only ───────────────────────────────────────────────────────────────

router.post(
  "/",
  authenticateToken,
  requireRole(Role.ADMIN),
  discountController.createDiscountCode,
);

router.get(
  "/",
  authenticateToken,
  requireRole(Role.ADMIN),
  discountController.listDiscountCodes,
);

router.patch(
  "/:id/toggle",
  authenticateToken,
  requireRole(Role.ADMIN),
  discountController.toggleDiscountCode,
);

router.delete(
  "/:id",
  authenticateToken,
  requireRole(Role.ADMIN),
  discountController.deleteDiscountCode,
);

// ─── MED — validate a code before payment ─────────────────────────────────────

router.post(
  "/validate",
  authenticateToken,
  requireRole(Role.MED),
  discountController.validateDiscountCode,
);

export default router;