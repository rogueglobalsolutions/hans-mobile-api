import { Router } from "express";
import * as verificationController from "../controllers/verification.controller";
import * as trainingController from "../controllers/training.controller";
import * as appointmentController from "../controllers/appointment.controller";
import * as baController from "../controllers/ba.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";
import { uploadTrainingBg } from "../middleware/upload";

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authenticateToken);
router.use(requireRole(Role.ADMIN));

// ─── Verification management ──────────────────────────────────────────────────

// MED user list and detail
router.get("/verifications", verificationController.getMedUsers);
router.get("/verifications/pending", verificationController.getPendingVerifications);
router.get("/verifications/:userId", verificationController.getMedUserById);

// Approve / reject actions on a specific user
router.post("/verifications/:userId/approve", verificationController.approveVerification);
router.post("/verifications/:userId/reject", verificationController.rejectVerification);

// ─── Training management ──────────────────────────────────────────────────────

// Create a new training (optional background image upload)
router.post(
  "/trainings",
  uploadTrainingBg.fields([{ name: "backgroundImage", maxCount: 1 }]),
  trainingController.createTraining,
);

// ─── Appointment management ───────────────────────────────────────────────────

router.get("/appointments", appointmentController.getAppointmentRequests);
router.post("/appointments/:id/approve", appointmentController.approveAppointment);
router.post("/appointments/:id/reject", appointmentController.rejectAppointment);
router.post("/appointments/:id/complete", appointmentController.completeAppointment);

// ─── Before & After management ───────────────────────────────────────────────

// B&A entries (view only for admin)
router.get("/ba/entries", baController.getAllEntries);
router.get("/ba/entries/:id", baController.getEntryByIdAdmin);

// Contest entries (view + like)
router.get("/ba/contest", baController.getAllContestEntries);
router.get("/ba/contest/:id", baController.getContestEntryByIdAdmin);
router.post("/ba/contest/:id/like", baController.toggleContestLike);

// Dashboard stats
router.get("/ba/stats", baController.getBAStats);

export default router;
