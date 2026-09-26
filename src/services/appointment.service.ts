import prisma from "../config/prisma";
import {
  sendAppointmentApprovalEmail,
  sendAppointmentRejectionEmail,
} from "./email.service";
import { appointmentHasStarted, normalizeAppointmentTimeZone } from "../utils/appointmentTime";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateAppointmentInput {
  medUserId: string;
  salesRepId?: string;
  date: string;   // "YYYY-MM-DD"
  time: string;   // "10:00 AM"
  timeZone?: string;
  notes?: string;
}

// ─── MED User operations ──────────────────────────────────────────────────────

export async function createAppointment({
  medUserId,
  salesRepId,
  date,
  time,
  timeZone,
  notes,
}: CreateAppointmentInput) {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error("Appointment date must be a valid calendar date");
  }
  if (!/^(0?[1-9]|1[0-2]):[0-5]\d (AM|PM)$/.test(time)) {
    throw new Error("Appointment time must be valid");
  }
  const normalizedTimeZone = normalizeAppointmentTimeZone(timeZone);
  if (appointmentHasStarted(date, time, normalizedTimeZone)) {
    throw new Error("Appointment date and time must be in the future");
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
      salesRepId: salesRepId || null,
      date,
      time,
      timeZone: normalizedTimeZone,
      notes: notes?.trim() || null,
    },
  });

  return { message: "Appointment request submitted successfully" };
}

export async function getMyAppointments(medUserId: string) {
  const appointments = await prisma.appointment.findMany({
    where: { medUserId },
    include: {
      salesRep: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return appointments.map((a) => ({
    id: a.id,
    date: a.date,
    time: a.time,
    timeZone: a.timeZone ?? normalizeAppointmentTimeZone(),
    notes: a.notes,
    status: a.status,
    zoomLink: a.zoomLink,
    rejectionReason: a.rejectionReason,
    salesRepName: a.salesRep?.fullName ?? null,
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
      salesRep: {
        select: { fullName: true },
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
    timeZone: a.timeZone ?? normalizeAppointmentTimeZone(),
    notes: a.notes,
    status: a.status,
    rejectionReason: a.rejectionReason,
    salesRepName: a.salesRep?.fullName ?? null,
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
    appointment.timeZone ?? normalizeAppointmentTimeZone(),
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
    appointment.timeZone ?? normalizeAppointmentTimeZone(),
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
  if (!appointmentHasStarted(appointment.date, appointment.time,
    appointment.timeZone ?? normalizeAppointmentTimeZone())) {
    throw new Error("Future appointments cannot be marked as completed");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "COMPLETED" },
  });

  return { message: "Appointment marked as completed" };
}

// ─── Sales Rep operations ─────────────────────────────────────────────────────

export async function getSalesRepAppointments(salesRepId: string) {
  const appointments = await prisma.appointment.findMany({
    where: { salesRepId },
    include: {
      medUser: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return appointments.map((a) => ({
    id: a.id,
    requesterName: a.medUser.fullName,
    requesterEmail: a.medUser.email,
    date: a.date,
    time: a.time,
    timeZone: a.timeZone ?? normalizeAppointmentTimeZone(),
    notes: a.notes,
    status: a.status,
    rejectionReason: a.rejectionReason,
    createdAt: a.createdAt,
  }));
}

export async function approveAppointmentBySalesRep(
  appointmentId: string,
  salesRepId: string
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      medUser: { select: { fullName: true, email: true } },
    },
  });

  if (!appointment) throw new Error("Appointment not found");
  if (appointment.salesRepId !== salesRepId) {
    throw new Error("You are not authorized to manage this appointment");
  }
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
    appointment.timeZone ?? normalizeAppointmentTimeZone(),
    zoomLink
  );

  return { message: "Appointment approved successfully" };
}

export async function rejectAppointmentBySalesRep(
  appointmentId: string,
  salesRepId: string,
  reason: string
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      medUser: { select: { fullName: true, email: true } },
    },
  });

  if (!appointment) throw new Error("Appointment not found");
  if (appointment.salesRepId !== salesRepId) {
    throw new Error("You are not authorized to manage this appointment");
  }
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
    appointment.timeZone ?? normalizeAppointmentTimeZone(),
    reason
  );

  return { message: "Appointment rejected successfully" };
}

export async function completeAppointmentBySalesRep(
  appointmentId: string,
  salesRepId: string
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) throw new Error("Appointment not found");
  if (appointment.salesRepId !== salesRepId) {
    throw new Error("You are not authorized to manage this appointment");
  }
  if (appointment.status !== "APPROVED") {
    throw new Error("Only approved appointments can be marked as completed");
  }
  if (!appointmentHasStarted(appointment.date, appointment.time,
    appointment.timeZone ?? normalizeAppointmentTimeZone())) {
    throw new Error("Future appointments cannot be marked as completed");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "COMPLETED" },
  });

  return { message: "Appointment marked as completed" };
}
