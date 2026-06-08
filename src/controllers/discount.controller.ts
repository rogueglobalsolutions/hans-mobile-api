import { Request, Response } from "express";
import * as discountService from "../services/discount.service";
import { sanitizeError } from "../utils/errors";
import { DiscountType, DiscountApplicableTo } from "../generated/prisma/enums";

// ─── Admin: Create discount code ──────────────────────────────────────────────

export async function createDiscountCode(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const { code, type, value, applicableTo, maxUses, expiresAt } = req.body;

    if (!code?.trim() || code.trim().length !== 6) {
      res.status(400).json({ success: false, message: "Code must be exactly 6 characters" });
      return;
    }
    if (!type || !["FIXED", "PERCENTAGE"].includes(type)) {
      res.status(400).json({ success: false, message: "Type must be FIXED or PERCENTAGE" });
      return;
    }
    if (value === undefined || isNaN(Number(value)) || Number(value) <= 0) {
      res.status(400).json({ success: false, message: "Value must be a positive number" });
      return;
    }
    if (type === "PERCENTAGE" && Number(value) > 100) {
      res.status(400).json({ success: false, message: "Percentage cannot exceed 100" });
      return;
    }

    const result = await discountService.createDiscountCode({
      code: code.trim(),
      type: type as DiscountType,
      value: Number(value),
      applicableTo: (applicableTo as DiscountApplicableTo) ?? DiscountApplicableTo.BOTH,
      maxUses: maxUses ? Number(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: adminId,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    const msg = sanitizeError(err, "createDiscountCode");
    res.status(400).json({ success: false, message: msg });
  }
}

// ─── Admin: List all discount codes ──────────────────────────────────────────

export async function listDiscountCodes(req: Request, res: Response) {
  try {
    const codes = await discountService.listDiscountCodes();
    res.json({ success: true, data: codes });
  } catch (err) {
    res.status(500).json({ success: false, message: sanitizeError(err, "listDiscountCodes") });
  }
}

// ─── Admin: Toggle active ──────────────────────────────────────────────────────

export async function toggleDiscountCode(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const result = await discountService.toggleDiscountCode(id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: sanitizeError(err, "toggleDiscountCode") });
  }
}

// ─── Admin: Delete discount code ──────────────────────────────────────────────

export async function deleteDiscountCode(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await discountService.deleteDiscountCode(id);
    res.json({ success: true, message: "Discount code deleted" });
  } catch (err) {
    res.status(400).json({ success: false, message: sanitizeError(err, "deleteDiscountCode") });
  }
}

// ─── MED: Validate discount code ──────────────────────────────────────────────

export async function validateDiscountCode(req: Request, res: Response) {
  try {
    const { code, context } = req.body;
    if (!code?.trim()) {
      res.status(400).json({ success: false, message: "Code is required" });
      return;
    }
    if (!context || !["TRAINING", "PRODUCTS"].includes(context)) {
      res.status(400).json({ success: false, message: "Context must be TRAINING or PRODUCTS" });
      return;
    }
    const result = await discountService.validateDiscountCode(code.trim(), context);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: sanitizeError(err, "validateDiscountCode") });
  }
}