import { Request, Response } from "express";
import * as applicationService from "../services/trainingApplication.service";
import { sanitizeError } from "../utils/errors";

function trainingId(req: Request) {
  return req.params.id as string;
}

export async function getApplication(req: Request, res: Response) {
  try {
    const data = await applicationService.getTrainingApplication((req as any).userId, trainingId(req));
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getTrainingApplication") });
  }
}

export async function saveApplication(req: Request, res: Response) {
  try {
    const data = await applicationService.saveTrainingApplication(
      (req as any).userId,
      trainingId(req),
      req.body,
    );
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "saveTrainingApplication") });
  }
}

export async function submitApplication(req: Request, res: Response) {
  try {
    const data = await applicationService.submitTrainingApplication(
      (req as any).userId,
      trainingId(req),
      String(req.body.termsVersion || "training-terms-v1"),
    );
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "submitTrainingApplication") });
  }
}

