import { Router } from "express";
import * as verificationController from "../controllers/verification.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authenticateToken);
router.use(requireRole(Role.ADMIN));

// MED user list and detail
router.get("/verifications", verificationController.getMedUsers);
router.get("/verifications/pending", verificationController.getPendingVerifications);
router.get("/verifications/:userId", verificationController.getMedUserById);

// Approve / reject actions on a specific user
router.post("/verifications/:userId/approve", verificationController.approveVerification);
router.post("/verifications/:userId/reject", verificationController.rejectVerification);

export default router;
