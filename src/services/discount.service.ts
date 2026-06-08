import prisma from "../config/prisma";
import { DiscountType, DiscountApplicableTo } from "../generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateDiscountInput {
  code: string;
  type: DiscountType;
  value: number;
  applicableTo: DiscountApplicableTo;
  maxUses?: number | null;
  expiresAt?: Date | null;
  createdBy: string;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createDiscountCode(input: CreateDiscountInput) {
  const existing = await prisma.discountCode.findUnique({ where: { code: input.code } });
  if (existing) throw new Error("Discount code already exists");

  return prisma.discountCode.create({
    data: {
      code:         input.code.toUpperCase(),
      type:         input.type,
      value:        input.value,
      applicableTo: input.applicableTo,
      maxUses:      input.maxUses ?? null,
      expiresAt:    input.expiresAt ?? null,
      createdBy:    input.createdBy,
    },
  });
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listDiscountCodes() {
  return prisma.discountCode.findMany({
    orderBy: { createdAt: "desc" },
  });
}

// ─── Toggle active ────────────────────────────────────────────────────────────

export async function toggleDiscountCode(id: string) {
  const code = await prisma.discountCode.findUnique({ where: { id } });
  if (!code) throw new Error("Discount code not found");
  return prisma.discountCode.update({
    where: { id },
    data: { isActive: !code.isActive },
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteDiscountCode(id: string) {
  const code = await prisma.discountCode.findUnique({ where: { id } });
  if (!code) throw new Error("Discount code not found");
  await prisma.discountCode.delete({ where: { id } });
}

// ─── Validate (called by MED user during checkout) ────────────────────────────

export async function validateDiscountCode(
  code: string,
  context: "TRAINING" | "PRODUCTS",
): Promise<{ valid: boolean; message?: string; discount?: { type: DiscountType; value: number; applicableTo: DiscountApplicableTo } }> {
  const discount = await prisma.discountCode.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!discount) return { valid: false, message: "Invalid discount code" };
  if (!discount.isActive) return { valid: false, message: "This discount code is no longer active" };
  if (discount.expiresAt && new Date() > discount.expiresAt) return { valid: false, message: "This discount code has expired" };
  if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) return { valid: false, message: "This discount code has reached its usage limit" };

  // Check applicability
  if (discount.applicableTo !== "BOTH" && discount.applicableTo !== context) {
    const label = context === "TRAINING" ? "training registrations" : "product purchases";
    return { valid: false, message: `This discount code is not applicable to ${label}` };
  }

  return {
    valid: true,
    discount: {
      type: discount.type,
      value: discount.value,
      applicableTo: discount.applicableTo,
    },
  };
}

// ─── Increment usedCount after successful payment ─────────────────────────────

export async function redeemDiscountCode(code: string) {
  await prisma.discountCode.updateMany({
    where: { code: code.toUpperCase() },
    data: { usedCount: { increment: 1 } },
  });
}