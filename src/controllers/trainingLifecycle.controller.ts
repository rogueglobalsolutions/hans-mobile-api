import { Request, Response } from "express";
import * as lifecycleService from "../services/trainingLifecycle.service";
import { sanitizeError } from "../utils/errors";

function userId(req: Request) {
  return (req as any).userId as string;
}

export async function getMyEnrollment(req: Request, res: Response) {
  try {
    const data = await lifecycleService.getMyEnrollment(userId(req), req.params.id as string);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: sanitizeError(error, "getMyTrainingEnrollment") });
  }
}

export async function requestCancellation(req: Request, res: Response) {
  try {
    const supportingDocumentPath = req.file
      ? `uploads/training-requests/${req.file.filename}`
      : undefined;
    const data = await lifecycleService.requestCancellation(userId(req), req.params.id as string, {
      reason: req.body.reason,
      emergencyDetails: req.body.emergencyDetails,
      supportingDocumentPath,
    });
    return res.status(201).json({ success: true, message: "Cancellation request submitted", data });
  } catch (error) {
    return res.status(400).json({ success: false, message: sanitizeError(error, "requestTrainingCancellation") });
  }
}

export async function requestReschedule(req: Request, res: Response) {
  try {
    const data = await lifecycleService.requestReschedule(userId(req), req.params.id as string, req.body);
    return res.status(201).json({ success: true, message: "Reschedule request submitted", data });
  } catch (error) {
    return res.status(400).json({ success: false, message: sanitizeError(error, "requestTrainingReschedule") });
  }
}

export async function reviewRequest(req: Request, res: Response) {
  try {
    const data = await lifecycleService.reviewTrainingRequest(
      userId(req),
      req.params.requestId as string,
      req.body,
    );
    return res.json({ success: true, message: "Training request reviewed", data });
  } catch (error) {
    return res.status(400).json({ success: false, message: sanitizeError(error, "reviewTrainingRequest") });
  }
}

export async function createRescheduleFeeIntent(req: Request, res: Response) {
  try {
    const data = await lifecycleService.createRescheduleFeeIntent(
      userId(req),
      req.params.requestId as string,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: sanitizeError(error, "createRescheduleFeeIntent") });
  }
}

export async function confirmRescheduleFee(req: Request, res: Response) {
  try {
    const data = await lifecycleService.confirmRescheduleFee(
      userId(req),
      req.params.requestId as string,
      String(req.body.paymentIntentId || ""),
    );
    return res.json({ success: true, message: "Reschedule completed", data });
  } catch (error) {
    return res.status(400).json({ success: false, message: sanitizeError(error, "confirmRescheduleFee") });
  }
}

export async function markNoShow(req: Request, res: Response) {
  try {
    const data = await lifecycleService.markNoShow(
      userId(req),
      req.params.id as string,
      req.params.enrollmentId as string,
    );
    return res.json({ success: true, message: "Enrollment marked no-show", data });
  } catch (error) {
    return res.status(400).json({ success: false, message: sanitizeError(error, "markTrainingNoShow") });
  }
}

export async function createNoShowFeeIntent(req: Request, res: Response) {
  try {
    const data = await lifecycleService.createNoShowFeeIntent(
      userId(req),
      req.params.enrollmentId as string,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: sanitizeError(error, "createNoShowFeeIntent") });
  }
}

export async function confirmNoShowFee(req: Request, res: Response) {
  try {
    const data = await lifecycleService.confirmNoShowFee(
      userId(req),
      req.params.enrollmentId as string,
      String(req.body.paymentIntentId || ""),
    );
    return res.json({ success: true, message: "No-show fee paid", data });
  } catch (error) {
    return res.status(400).json({ success: false, message: sanitizeError(error, "confirmNoShowFee") });
  }
}
