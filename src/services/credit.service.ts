import prisma from "../config/prisma";
import {
  CreditReservationStatus,
  CreditTransactionType,
} from "../generated/prisma/enums";

const CREDIT_EXPIRY_DAYS = 30;

function addCalendarDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function ensureLegacyGrant(tx: any, userId: string) {
  const [grantCount, user] = await Promise.all([
    tx.creditGrant.count({ where: { userId } }),
    tx.user.findUnique({ where: { id: userId }, select: { creditBalance: true } }),
  ]);
  if (!user) throw new Error("User not found");
  if (grantCount === 0 && user.creditBalance > 0) {
    await tx.creditGrant.create({
      data: {
        userId,
        sourceKey: `legacy:${userId}`,
        amount: user.creditBalance,
        remainingAmount: user.creditBalance,
      },
    });
  }
}

async function reconcileCredits(tx: any, userId: string) {
  await ensureLegacyGrant(tx, userId);
  const now = new Date();
  const expiring = await tx.creditGrant.findMany({
    where: {
      userId,
      remainingAmount: { gt: 0 },
      expiredAt: null,
      expiresAt: { lte: now },
    },
  });

  for (const grant of expiring) {
    const expiredAmount = grant.remainingAmount;
    const claimed = await tx.creditGrant.updateMany({
      where: { id: grant.id, expiredAt: null, remainingAmount: expiredAmount },
      data: { remainingAmount: 0, expiredAt: now },
    });
    if (claimed.count === 1) {
      await tx.creditTransaction.create({
        data: {
          userId,
          type: CreditTransactionType.EXPIRED,
          amount: expiredAmount,
          description: "Unused training product credits expired",
          referenceId: grant.id,
        },
      });
    }
  }

  const active = await tx.creditGrant.aggregate({
    where: {
      userId,
      remainingAmount: { gt: 0 },
      expiredAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _sum: { remainingAmount: true },
  });
  const balance = active._sum.remainingAmount ?? 0;
  await tx.user.update({ where: { id: userId }, data: { creditBalance: balance } });
  return balance;
}

export async function getSpendableCreditBalance(userId: string) {
  return prisma.$transaction((tx) => reconcileCredits(tx, userId));
}

export async function issueTrainingCredits(
  tx: any,
  input: {
    userId: string;
    enrollmentId: string;
    trainingTitle: string;
    amount: number;
    finalTrainingDate: Date;
  },
) {
  if (input.amount <= 0) return null;
  const expiresAt = addCalendarDays(input.finalTrainingDate, CREDIT_EXPIRY_DAYS);
  const sourceKey = `training:${input.enrollmentId}`;
  const existing = await tx.creditGrant.findUnique({ where: { sourceKey } });
  if (existing) return existing;

  const grant = await tx.creditGrant.create({
    data: {
      userId: input.userId,
      enrollmentId: input.enrollmentId,
      sourceKey,
      amount: input.amount,
      remainingAmount: input.amount,
      expiresAt,
    },
  });
  await tx.creditTransaction.create({
    data: {
      userId: input.userId,
      type: CreditTransactionType.EARNED,
      amount: input.amount,
      description: `Completed ${input.trainingTitle}`,
      referenceId: input.enrollmentId,
    },
  });
  await tx.user.update({
    where: { id: input.userId },
    data: { creditBalance: { increment: input.amount } },
  });
  return grant;
}

export async function reserveCredits(
  tx: any,
  userId: string,
  reservationId: string,
  amount: number,
) {
  if (amount <= 0) return;
  const balance = await reconcileCredits(tx, userId);
  if (balance < amount) throw new Error("Credit balance changed. Please review the updated total.");

  const now = new Date();
  const grants = await tx.creditGrant.findMany({
    where: {
      userId,
      remainingAmount: { gt: 0 },
      expiredAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
  });

  let remaining = amount;
  for (const grant of grants) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, grant.remainingAmount);
    const claimed = await tx.creditGrant.updateMany({
      where: { id: grant.id, remainingAmount: { gte: applied }, expiredAt: null },
      data: { remainingAmount: { decrement: applied } },
    });
    if (claimed.count !== 1) throw new Error("Credit balance changed. Please review the updated total.");
    await tx.creditReservationAllocation.create({
      data: { reservationId, grantId: grant.id, amount: applied },
    });
    remaining -= applied;
  }
  if (remaining > 0) throw new Error("Credit balance changed. Please review the updated total.");
  await tx.user.update({
    where: { id: userId },
    data: { creditBalance: { decrement: amount } },
  });
}

export async function releaseCreditReservation(tx: any, orderId: string) {
  const reservation = await tx.creditReservation.findUnique({
    where: { orderId },
    include: { allocations: { include: { grant: true } } },
  });
  if (!reservation || reservation.status !== CreditReservationStatus.RESERVED) return false;
  const released = await tx.creditReservation.updateMany({
    where: { id: reservation.id, status: CreditReservationStatus.RESERVED },
    data: { status: CreditReservationStatus.RELEASED, releasedAt: new Date() },
  });
  if (released.count !== 1) return false;

  if (reservation.allocations.length === 0 && reservation.amount > 0) {
    await tx.creditGrant.create({
      data: {
        userId: reservation.userId,
        sourceKey: `legacy-reservation-release:${reservation.id}`,
        amount: reservation.amount,
        remainingAmount: reservation.amount,
      },
    });
  }

  const now = new Date();
  for (const allocation of reservation.allocations) {
    if (!allocation.grant.expiredAt && (!allocation.grant.expiresAt || allocation.grant.expiresAt > now)) {
      await tx.creditGrant.update({
        where: { id: allocation.grantId },
        data: { remainingAmount: { increment: allocation.amount } },
      });
    }
  }
  await reconcileCredits(tx, reservation.userId);
  return true;
}

export async function restoreOrderCredits(tx: any, orderId: string, requestedAmount: number) {
  if (requestedAmount <= 0) return 0;
  const reservation = await tx.creditReservation.findUnique({
    where: { orderId },
    include: { allocations: { include: { grant: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!reservation || reservation.status !== CreditReservationStatus.APPLIED) return 0;

  if (reservation.allocations.length === 0) {
    await tx.creditGrant.upsert({
      where: { sourceKey: `legacy-order-refund:${orderId}` },
      create: {
        userId: reservation.userId,
        sourceKey: `legacy-order-refund:${orderId}`,
        amount: requestedAmount,
        remainingAmount: requestedAmount,
      },
      update: {
        amount: { increment: requestedAmount },
        remainingAmount: { increment: requestedAmount },
      },
    });
    await tx.user.update({
      where: { id: reservation.userId },
      data: { creditBalance: { increment: requestedAmount } },
    });
    return requestedAmount;
  }

  const now = new Date();
  let remaining = requestedAmount;
  let restored = 0;
  for (const allocation of reservation.allocations) {
    if (remaining <= 0) break;
    if (allocation.grant.expiredAt || (allocation.grant.expiresAt && allocation.grant.expiresAt <= now)) continue;
    const refundable = allocation.amount - allocation.refundedAmount;
    const amount = Math.min(remaining, refundable);
    if (amount <= 0) continue;
    await tx.creditReservationAllocation.update({
      where: { id: allocation.id },
      data: { refundedAmount: { increment: amount } },
    });
    await tx.creditGrant.update({
      where: { id: allocation.grantId },
      data: { remainingAmount: { increment: amount } },
    });
    remaining -= amount;
    restored += amount;
  }
  if (restored > 0) {
    await tx.user.update({
      where: { id: reservation.userId },
      data: { creditBalance: { increment: restored } },
    });
  }
  return restored;
}

export async function getUserCreditSummary(userId: string) {
  await getSpendableCreditBalance(userId);
  const [user, transactions, earnedAgg, spentAgg, grants] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { creditBalance: true } }),
    prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        referenceId: true,
        createdAt: true,
      },
    }),
    prisma.creditTransaction.aggregate({
      where: { userId, type: CreditTransactionType.EARNED },
      _sum: { amount: true },
    }),
    prisma.creditTransaction.aggregate({
      where: { userId, type: CreditTransactionType.SPENT },
      _sum: { amount: true },
    }),
    prisma.creditGrant.findMany({
      where: { userId, remainingAmount: { gt: 0 }, expiredAt: null },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
      select: { id: true, amount: true, remainingAmount: true, expiresAt: true, createdAt: true },
    }),
  ]);
  if (!user) throw new Error("User not found");

  return {
    currentBalance: user.creditBalance,
    totalEarned: earnedAgg._sum.amount ?? 0,
    totalSpent: spentAgg._sum.amount ?? 0,
    nextExpirationAt: grants.find((grant) => grant.expiresAt)?.expiresAt ?? null,
    grants,
    transactions,
  };
}

export interface SpendCreditInput {
  userId: string;
  amount: number;
  description: string;
  referenceId?: string;
}

export async function spendCredits(input: SpendCreditInput) {
  await prisma.$transaction(async (tx) => {
    const balance = await reconcileCredits(tx, input.userId);
    if (balance < input.amount) throw new Error("Insufficient credit balance");
    const grants = await tx.creditGrant.findMany({
      where: { userId: input.userId, remainingAmount: { gt: 0 }, expiredAt: null },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
    });
    let remaining = input.amount;
    for (const grant of grants) {
      if (remaining <= 0) break;
      const amount = Math.min(remaining, grant.remainingAmount);
      await tx.creditGrant.update({
        where: { id: grant.id },
        data: { remainingAmount: { decrement: amount } },
      });
      remaining -= amount;
    }
    await tx.user.update({
      where: { id: input.userId },
      data: { creditBalance: { decrement: input.amount } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        type: CreditTransactionType.SPENT,
        amount: input.amount,
        description: input.description,
        referenceId: input.referenceId ?? null,
      },
    });
  });
  return { message: "Credits spent successfully" };
}
