import { Request, Response } from "express";
import * as appointmentService from "../services/appointment.service";
import { sanitizeError } from "../utils/errors";

// ─── MED User handlers ────────────────────────────────────────────────────────

export async function createAppointment(req: Request, res: Response) {
  try {
    const medUserId = (req as any).userId;
    const { date, time, notes } = req.body;

    const errors: string[] = [];

    if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      errors.push("Valid date is required (YYYY-MM-DD)");
    }
    if (!time || typeof time !== "string" || !time.trim()) {
      errors.push("Time is required");
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed", errors });
      return;
    }

    const result = await appointmentService.createAppointment({
      medUserId,
      date: date.trim(),
      time: time.trim(),
      notes: typeof notes === "string" ? notes.trim() : undefined,
    });

    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "createAppointment") });
  }
}

export async function getMyAppointments(req: Request, res: Response) {
  try {
    const medUserId = (req as any).userId;
    const data = await appointmentService.getMyAppointments(medUserId);

    res.json({
      success: true,
      message: "Appointments retrieved successfully",
      data,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getMyAppointments") });
  }
}

export async function getBlockedDates(req: Request, res: Response) {
  try {
    const data = await appointmentService.getBlockedDates();

    res.json({
      success: true,
      message: "Blocked dates retrieved successfully",
      data,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getBlockedDates") });
  }
}

// ─── Admin handlers ───────────────────────────────────────────────────────────

export async function getAppointmentRequests(req: Request, res: Response) {
  try {
    const data = await appointmentService.getAppointmentRequests();

    res.json({
      success: true,
      message: "Appointment requests retrieved successfully",
      data,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getAppointmentRequests") });
  }
}

export async function approveAppointment(req: Request, res: Response) {
  try {
    const appointmentId = req.params.id;
    const result = await appointmentService.approveAppointment(appointmentId);

    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "approveAppointment") });
  }
}

export async function rejectAppointment(req: Request, res: Response) {
  try {
    const appointmentId = req.params.id;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      res.status(400).json({ success: false, message: "Rejection reason is required" });
      return;
    }

    const result = await appointmentService.rejectAppointment(appointmentId, reason.trim());

    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "rejectAppointment") });
  }
}

export async function completeAppointment(req: Request, res: Response) {
  try {
    const appointmentId = req.params.id;
    const result = await appointmentService.completeAppointment(appointmentId);

    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "completeAppointment") });
  }
}
