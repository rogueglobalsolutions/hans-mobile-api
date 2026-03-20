import { Router } from "express";
import * as appointmentController from "../controllers/appointment.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";

const router = Router();

// Public: blocked dates — no auth required so the calendar can pre-populate
router.get("/blocked-dates", appointmentController.getBlockedDates);

// MED user: submit a new appointment request
router.post(
  "/",
  authenticateToken,
  requireRole(Role.MED),
  appointmentController.createAppointment
);

// MED user: view own appointments (status, zoom link, etc.)
router.get(
  "/me",
  authenticateToken,
  requireRole(Role.MED),
  appointmentController.getMyAppointments
);

export default router;
