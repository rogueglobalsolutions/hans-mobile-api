import { Router } from "express";
import * as trainingController from "../controllers/training.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";
import * as trainingApplicationController from "../controllers/trainingApplication.controller";
import * as trainingLifecycleController from "../controllers/trainingLifecycle.controller";
import { uploadTrainingRequestDocument } from "../middleware/upload";

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
router.get(
  "/:id/enrollment",
  requireRole(Role.MED),
  trainingLifecycleController.getMyEnrollment,
);
router.post(
  "/:id/cancellation-request",
  requireRole(Role.MED),
  uploadTrainingRequestDocument.single("supportingDocument"),
  trainingLifecycleController.requestCancellation,
);
router.post(
  "/:id/reschedule-request",
  requireRole(Role.MED),
  trainingLifecycleController.requestReschedule,
);
router.post(
  "/requests/:requestId/fee-intent",
  requireRole(Role.MED),
  trainingLifecycleController.createRescheduleFeeIntent,
);
router.post(
  "/requests/:requestId/confirm-fee",
  requireRole(Role.MED),
  trainingLifecycleController.confirmRescheduleFee,
);
router.post(
  "/enrollments/:enrollmentId/no-show-fee-intent",
  requireRole(Role.MED),
  trainingLifecycleController.createNoShowFeeIntent,
);
router.post(
  "/enrollments/:enrollmentId/confirm-no-show-fee",
  requireRole(Role.MED),
  trainingLifecycleController.confirmNoShowFee,
);

// ─── Read routes — accessible to both MED and ADMIN ──────────────────────────

// List all trainings (summary)
router.get("/", requireRole(Role.MED, Role.ADMIN), trainingController.getTrainings);

// Get full details of a specific training (includes isEnrolled for the requester)
router.get("/:id", requireRole(Role.MED, Role.ADMIN), trainingController.getTrainingById);

export default router;
