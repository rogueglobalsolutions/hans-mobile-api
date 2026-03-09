import { Router } from "express";
import * as creditController from "../controllers/credit.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";

const router = Router();

// All credit routes require authentication and MED role
router.use(authenticateToken);
router.use(requireRole(Role.MED));

// Get the authenticated user's credit balance + full transaction history
router.get("/", creditController.getCreditSummary);

export default router;
