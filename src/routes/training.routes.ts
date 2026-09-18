import { Router } from "express";
import * as trainingController from "../controllers/training.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";
import * as trainingApplicationController from "../controllers/trainingApplication.controller";

const router = Router();

// All training routes require authentication
router.use(authenticateToken);

router.get(
  "/:id/application",
  requireRole(Role.MED),
  trainingApplicationController.getApplication,
);
router.put(
  "/:id/application",
  requireRole(Role.MED),
  trainingApplicationController.saveApplication,
);
router.post(
  "/:id/application/submit",
  requireRole(Role.MED),
  trainingApplicationController.submitApplication,
);

// ─── Read routes — accessible to both MED and ADMIN ──────────────────────────

// List all trainings (summary)
router.get("/", requireRole(Role.MED, Role.ADMIN), trainingController.getTrainings);

// Get full details of a specific training (includes isEnrolled for the requester)
router.get("/:id", requireRole(Role.MED, Role.ADMIN), trainingController.getTrainingById);

export default router;
