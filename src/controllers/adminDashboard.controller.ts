import { Request, Response } from "express";
import * as adminDashboardService from "../services/adminDashboard.service";
import { sanitizeError } from "../utils/errors";

export async function getDashboardSummary(req: Request, res: Response) {
  try {
    const data = await adminDashboardService.getDashboardSummary();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeError(error, "getDashboardSummary") });
  }
}
