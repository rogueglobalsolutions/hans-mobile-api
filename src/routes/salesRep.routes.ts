import { Router } from "express";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";
import * as salesRepController from "../controllers/salesRep.controller";
import * as appointmentController from "../controllers/appointment.controller";

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

// ─── Appointment management ───────────────────────────────────────────────────

router.get(
  "/appointments",
  authenticateToken,
  requireRole(Role.SALES_REP),
  appointmentController.getSalesRepAppointments,
);

router.post(
  "/appointments/:id/approve",
  authenticateToken,
  requireRole(Role.SALES_REP),
  appointmentController.approveAppointmentBySalesRep,
);

router.post(
  "/appointments/:id/reject",
  authenticateToken,
  requireRole(Role.SALES_REP),
  appointmentController.rejectAppointmentBySalesRep,
);

router.post(
  "/appointments/:id/complete",
  authenticateToken,
  requireRole(Role.SALES_REP),
  appointmentController.completeAppointmentBySalesRep,
);

export default router;
