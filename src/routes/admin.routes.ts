import { Router } from "express";
import * as verificationController from "../controllers/verification.controller";
import * as trainingController from "../controllers/training.controller";
import * as appointmentController from "../controllers/appointment.controller";
import * as baController from "../controllers/ba.controller";
import * as salesRepController from "../controllers/salesRep.controller";
import * as trainingDocController from "../controllers/trainingDoc.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";
import { uploadTrainingBg, uploadTrainingDocs } from "../middleware/upload";

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authenticateToken);
router.use(requireRole(Role.ADMIN));

// ─── Verification management ──────────────────────────────────────────────────

router.get("/verifications", verificationController.getMedUsers);
router.get("/verifications/pending", verificationController.getPendingVerifications);
router.get("/verifications/:userId", verificationController.getMedUserById);
router.post("/verifications/:userId/approve", verificationController.approveVerification);
router.post("/verifications/:userId/reject", verificationController.rejectVerification);

// ─── Training management ──────────────────────────────────────────────────────

router.post(
  "/trainings",
  uploadTrainingBg.fields([{ name: "backgroundImage", maxCount: 1 }]),
  trainingController.createTraining,
);
router.post("/trainings/:id/cancel", trainingController.cancelTraining);
router.get("/trainings/:id/enrollees", trainingController.getTrainingEnrollees);

// Training document management
router.get("/trainings/:id/folders", trainingDocController.getFolders);
router.post("/trainings/:id/folders", trainingDocController.createFolder);
router.post(
  "/trainings/:id/folders/:folderId/upload",
  uploadTrainingDocs.single("file"),
  trainingDocController.uploadDocument,
);
router.delete("/trainings/:id/folders/:folderId", trainingDocController.deleteFolder);
router.delete("/trainings/:id/documents/:docId", trainingDocController.deleteDocument);

// File download (any uploaded file)
router.get("/download", trainingDocController.downloadFile);

// ─── Appointment management ───────────────────────────────────────────────────

router.get("/appointments", appointmentController.getAppointmentRequests);
router.post("/appointments/:id/approve", appointmentController.approveAppointment);
router.post("/appointments/:id/reject", appointmentController.rejectAppointment);
router.post("/appointments/:id/complete", appointmentController.completeAppointment);

// ─── Before & After management ───────────────────────────────────────────────

router.get("/ba/entries", baController.getAllEntries);
router.get("/ba/entries/:id", baController.getEntryByIdAdmin);
router.get("/ba/contest", baController.getAllContestEntries);
router.get("/ba/contest/:id", baController.getContestEntryByIdAdmin);
router.post("/ba/contest/:id/like", baController.toggleContestLike);
router.get("/ba/stats", baController.getBAStats);

// ─── Sales Rep management ─────────────────────────────────────────────────────

router.post("/sales-reps", salesRepController.createSalesRep);

export default router;
