import { Router } from "express";
import * as adsController from "../controllers/ads.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { uploadAdImage } from "../middleware/upload";
import { Role } from "../generated/prisma/enums";

const router = Router();

// ─── Admin only routes ────────────────────────────────────────────────────────

router.post(
  "/upload",
  authenticateToken,
  requireRole(Role.ADMIN),
  uploadAdImage.single("file"),
  adsController.uploadAdImage,
);

router.post(
  "/popup",
  authenticateToken,
  requireRole(Role.ADMIN),
  adsController.createAdConfig,
);

router.put(
  "/popup/:id",
  authenticateToken,
  requireRole(Role.ADMIN),
  adsController.updateAdConfig,
);

router.delete(
  "/popup/:id",
  authenticateToken,
  requireRole(Role.ADMIN),
  adsController.deleteAdConfig,
);
// ─── Public / MED — fetch active ad config ───────────────────────────────────

router.get("/popup", authenticateToken, adsController.getAdConfig);

export default router;