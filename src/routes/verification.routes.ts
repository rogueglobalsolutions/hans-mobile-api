import { Router } from "express";
import * as verificationController from "../controllers/verification.controller";
import { authenticateToken } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();

// Submit verification documents (MED users - authenticated)
router.post(
  "/submit",
  authenticateToken,
  upload.fields([
    { name: "idDocumentFront", maxCount: 1 },
    { name: "idDocumentBack", maxCount: 1 },
  ]),
  verificationController.submitVerification
);

// Re-submit verification documents after rejection (MED users - authenticated)
router.post(
  "/resubmit",
  authenticateToken,
  upload.fields([
    { name: "idDocumentFront", maxCount: 1 },
    { name: "idDocumentBack", maxCount: 1 },
  ]),
  verificationController.resubmitVerification
);

export default router;
