import prisma from "../config/prisma";
import { Role, PaymentStatus } from "../generated/prisma/enums";
import bcrypt from "bcryptjs";

/**
 * List recent completed Stripe transactions (enrollments with paymentStatus=COMPLETED).
 * If salesRepId is provided, filter to only that rep's referred enrollments.
 */
export async function getRecentTransactions(salesRepId?: string) {
  return prisma.enrollment.findMany({
    where: {
      paymentStatus: PaymentStatus.COMPLETED,
      ...(salesRepId ? { salesRepId } : {}),
    },
    include: {
      user:     { select: { id: true, fullName: true, email: true } },
      training: { select: { id: true, title: true, level: true, scheduledAt: true } },
      salesRep: { select: { id: true, fullName: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 100,
  });
}

/**
 * Get paid MED users grouped by training program.
 */
export async function getEnrolleesByTraining() {
  const trainings = await prisma.training.findMany({
    select: {
      id:        true,
      title:     true,
      level:     true,
      scheduledAt: true,
      enrollments: {
        where: { paymentStatus: PaymentStatus.COMPLETED },
        include: {
          user:     { select: { id: true, fullName: true, email: true, phoneNumber: true } },
          salesRep: { select: { id: true, fullName: true } },
        },
        orderBy: { paidAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return trainings.filter((t) => t.enrollments.length > 0);
}

/**
 * List all SALES_REP users (used for the dropdown in registration form).
 */
export async function listSalesReps() {
  return prisma.user.findMany({
    where: { role: Role.SALES_REP },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: "asc" },
  });
}

/**
 * Create a new SALES_REP account (admin only).
 */
export async function createSalesRep(
  fullName: string,
  email: string,
  phoneNumber: string,
  password: string,
) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phoneNumber }] },
  });
  if (existing) throw new Error("A user with that email or phone number already exists");

  const hashed = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { fullName, email, phoneNumber, password: hashed, role: Role.SALES_REP },
    select: { id: true, fullName: true, email: true, phoneNumber: true, role: true, createdAt: true },
  });
}
