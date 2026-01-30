import { Router } from "express";
import * as verificationController from "../controllers/verification.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authenticateToken);
router.use(requireRole(Role.ADMIN));

// Verification management
router.get("/verifications/pending", verificationController.getPendingVerifications);
router.post("/verifications/approve", verificationController.approveVerification);
router.post("/verifications/reject", verificationController.rejectVerification);

export default router;
