import prisma from "../config/prisma";
import {
  sendAppointmentApprovalEmail,
  sendAppointmentRejectionEmail,
} from "./email.service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateAppointmentInput {
  medUserId: string;
  date: string;   // "YYYY-MM-DD"
  time: string;   // "10:00 AM"
  notes?: string;
}

// ─── MED User operations ──────────────────────────────────────────────────────

export async function createAppointment({
  medUserId,
  date,
  time,
  notes,
}: CreateAppointmentInput) {
  // Validate date is not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const appointmentDate = new Date(date);
  if (appointmentDate < today) {
    throw new Error("Appointment date must be in the future");
  }

  // Check the date isn't already blocked by an approved appointment
  const blocked = await prisma.appointment.findFirst({
    where: { date, status: "APPROVED" },
  });
  if (blocked) {
    throw new Error("This date is no longer available. Please select another date.");
  }

  // Check this MED user doesn't already have a pending/approved request for this date
  const existing = await prisma.appointment.findFirst({
    where: {
      medUserId,
      date,
      status: { in: ["PENDING", "APPROVED"] },
    },
  });
  if (existing) {
    throw new Error("You already have an appointment request for this date.");
  }

  await prisma.appointment.create({
    data: {
      medUserId,
      date,
      time,
      notes: notes?.trim() || null,
    },
  });

  return { message: "Appointment request submitted successfully" };
}

export async function getMyAppointments(medUserId: string) {
  const appointments = await prisma.appointment.findMany({
    where: { medUserId },
    orderBy: { createdAt: "desc" },
  });

  return appointments.map((a) => ({
    id: a.id,
    date: a.date,
    time: a.time,
    notes: a.notes,
    status: a.status,
    zoomLink: a.zoomLink,
    rejectionReason: a.rejectionReason,
    createdAt: a.createdAt,
  }));
}

export async function getBlockedDates(): Promise<string[]> {
  const approved = await prisma.appointment.findMany({
    where: { status: "APPROVED" },
    select: { date: true },
  });

  // Deduplicate in case of future multi-slot support
  return [...new Set(approved.map((a) => a.date))];
}

// ─── Admin operations ─────────────────────────────────────────────────────────

export async function getAppointmentRequests() {
  const appointments = await prisma.appointment.findMany({
    include: {
      medUser: {
        select: { fullName: true, email: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return appointments.map((a) => ({
    id: a.id,
    requesterName: a.medUser.fullName,
    requesterEmail: a.medUser.email,
    date: a.date,
    time: a.time,
    notes: a.notes,
    status: a.status,
    createdAt: a.createdAt,
  }));
}

export async function approveAppointment(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      medUser: { select: { fullName: true, email: true } },
    },
  });

  if (!appointment) throw new Error("Appointment not found");
  if (appointment.status !== "PENDING") {
    throw new Error("Only pending appointments can be approved");
  }

  const zoomLink = process.env.ZOOM_MEETING_LINK ?? "";

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "APPROVED", zoomLink },
  });

  await sendAppointmentApprovalEmail(
    appointment.medUser.email,
    appointment.medUser.fullName,
    appointment.date,
    appointment.time,
    zoomLink
  );

  return { message: "Appointment approved successfully" };
}

export async function rejectAppointment(appointmentId: string, reason: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      medUser: { select: { fullName: true, email: true } },
    },
  });

  if (!appointment) throw new Error("Appointment not found");
  if (appointment.status !== "PENDING") {
    throw new Error("Only pending appointments can be rejected");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "REJECTED", rejectionReason: reason },
  });

  await sendAppointmentRejectionEmail(
    appointment.medUser.email,
    appointment.medUser.fullName,
    appointment.date,
    appointment.time,
    reason
  );

  return { message: "Appointment rejected successfully" };
}

export async function completeAppointment(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) throw new Error("Appointment not found");
  if (appointment.status !== "APPROVED") {
    throw new Error("Only approved appointments can be marked as completed");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "COMPLETED" },
  });

  return { message: "Appointment marked as completed" };
}
