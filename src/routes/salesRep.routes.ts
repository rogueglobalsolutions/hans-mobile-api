import { Router } from "express";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";
import * as salesRepController from "../controllers/salesRep.controller";

const router = Router();

// SALES_REP-only routes
router.get(
  "/transactions",
  authenticateToken,
  requireRole(Role.SALES_REP),
  salesRepController.getTransactions,
);

router.get(
  "/enrollees",
  authenticateToken,
  requireRole(Role.SALES_REP),
  salesRepController.getEnrollees,
);

export default router;
