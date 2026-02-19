import { Request, Response } from "express";
import * as verificationService from "../services/verification.service";
import { sanitizeError } from "../utils/errors";

export async function submitVerification(req: Request, res: Response) {
  try {
    const { medicalLicenseNumber } = req.body;
    const userId = (req as any).userId; // From auth middleware

    const errors: string[] = [];

    if (!medicalLicenseNumber || typeof medicalLicenseNumber !== "string" || !medicalLicenseNumber.trim()) {
      errors.push("Medical license number is required");
    }

    if (!req.files || typeof req.files !== "object") {
      errors.push("ID document images are required");
    } else {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files.idDocumentFront || files.idDocumentFront.length === 0) {
        errors.push("Front side of ID document is required");
      }

      if (!files.idDocumentBack || files.idDocumentBack.length === 0) {
        errors.push("Back side of ID document is required");
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed", errors });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const frontPath = `uploads/verifications/${files.idDocumentFront[0].filename}`;
    const backPath = `uploads/verifications/${files.idDocumentBack[0].filename}`;

    const result = await verificationService.submitVerification({
      userId,
      medicalLicenseNumber: medicalLicenseNumber.trim(),
      idDocumentFrontPath: frontPath,
      idDocumentBackPath: backPath,
    });

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "submitVerification") });
  }
}

export async function getMedUsers(req: Request, res: Response) {
  try {
    const users = await verificationService.getMedUsers();

    res.json({
      success: true,
      message: "MED users retrieved successfully",
      data: users,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getMedUsers") });
  }
}

export async function getMedUserById(req: Request, res: Response) {
  try {
    const userId = req.params.userId as string;
    const user = await verificationService.getMedUserById(userId);

    res.json({
      success: true,
      message: "MED user retrieved successfully",
      data: user,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getMedUserById") });
  }
}

export async function approveVerification(req: Request, res: Response) {
  try {
    const userId = req.params.userId as string;
    const adminId = (req as any).userId; // From auth middleware

    const result = await verificationService.approveVerification({ userId, adminId });

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "approveVerification") });
  }
}

export async function rejectVerification(req: Request, res: Response) {
  try {
    const userId = req.params.userId as string;
    const adminId = (req as any).userId; // From auth middleware

    const result = await verificationService.rejectVerification({ userId, adminId });

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "rejectVerification") });
  }
}

export async function resubmitVerification(req: Request, res: Response) {
  try {
    const { medicalLicenseNumber } = req.body;
    const userId = (req as any).userId; // From auth middleware

    const errors: string[] = [];

    if (!medicalLicenseNumber || typeof medicalLicenseNumber !== "string" || !medicalLicenseNumber.trim()) {
      errors.push("Medical license number is required");
    }

    if (!req.files || typeof req.files !== "object") {
      errors.push("ID document images are required");
    } else {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files.idDocumentFront || files.idDocumentFront.length === 0) {
        errors.push("Front side of ID document is required");
      }

      if (!files.idDocumentBack || files.idDocumentBack.length === 0) {
        errors.push("Back side of ID document is required");
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed", errors });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const frontPath = `uploads/verifications/${files.idDocumentFront[0].filename}`;
    const backPath = `uploads/verifications/${files.idDocumentBack[0].filename}`;

    const result = await verificationService.resubmitVerification({
      userId,
      medicalLicenseNumber: medicalLicenseNumber.trim(),
      idDocumentFrontPath: frontPath,
      idDocumentBackPath: backPath,
    });

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "resubmitVerification") });
  }
}

export async function getPendingVerifications(req: Request, res: Response) {
  try {
    const users = await verificationService.getPendingVerifications();

    res.json({
      success: true,
      message: "Pending verifications retrieved successfully",
      data: users,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getPendingVerifications") });
  }
}
