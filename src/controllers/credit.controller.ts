import { Request, Response } from "express";
import * as creditService from "../services/credit.service";

/**
 * GET /api/credits
 * Returns the authenticated MED user's credit summary:
 *  - currentBalance
 *  - totalEarned
 *  - totalSpent
 *  - full transaction history (newest first)
 */
export async function getCreditSummary(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const summary = await creditService.getUserCreditSummary(userId);

    return res.json({
      success: true,
      message: "Credit summary retrieved successfully",
      data:    summary,
    });
  } catch (err: any) {
    if (err.message === "User not found") {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    console.error("[getCreditSummary]", err);
    return res.status(500).json({ success: false, message: "Failed to retrieve credit summary" });
  }
}
