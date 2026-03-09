import prisma from "../config/prisma";
import { CreditTransactionType } from "../generated/prisma/enums";

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * Returns a full credit summary for a MED user:
 *  - currentBalance  — live running balance from the User row
 *  - totalEarned     — sum of all EARNED transactions
 *  - totalSpent      — sum of all SPENT transactions
 *  - transactions    — full ledger, newest first
 */
export async function getUserCreditSummary(userId: string) {
  const [user, transactions, earnedAgg, spentAgg] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: userId },
      select: { creditBalance: true },
    }),

    prisma.creditTransaction.findMany({
      where:   { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id:          true,
        type:        true,
        amount:      true,
        description: true,
        referenceId: true,
        createdAt:   true,
      },
    }),

    prisma.creditTransaction.aggregate({
      where: { userId, type: CreditTransactionType.EARNED },
      _sum:  { amount: true },
    }),

    prisma.creditTransaction.aggregate({
      where: { userId, type: CreditTransactionType.SPENT },
      _sum:  { amount: true },
    }),
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  return {
    currentBalance: user.creditBalance,
    totalEarned:    earnedAgg._sum.amount ?? 0,
    totalSpent:     spentAgg._sum.amount  ?? 0,
    transactions,
  };
}

// ─── Spend (for future store use) ────────────────────────────────────────────

export interface SpendCreditInput {
  userId:      string;
  amount:      number;
  description: string;
  referenceId?: string;
}

/**
 * Deduct credits from a user's balance.
 * Throws if the user has insufficient balance.
 * Intended to be called by the store module when a purchase is made.
 */
export async function spendCredits(input: SpendCreditInput) {
  const user = await prisma.user.findUnique({
    where:  { id: input.userId },
    select: { creditBalance: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.creditBalance < input.amount) {
    throw new Error("Insufficient credit balance");
  }

  await prisma.$transaction(async (tx) => {
    await tx.creditTransaction.create({
      data: {
        userId:      input.userId,
        type:        CreditTransactionType.SPENT,
        amount:      input.amount,
        description: input.description,
        referenceId: input.referenceId ?? null,
      },
    });

    await tx.user.update({
      where: { id: input.userId },
      data:  { creditBalance: { decrement: input.amount } },
    });
  });

  return { message: "Credits spent successfully" };
}
