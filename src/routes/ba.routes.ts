import { Router } from "express";
import * as baController from "../controllers/ba.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { uploadBAMedia, uploadContestMedia } from "../middleware/upload";
import { Role } from "../generated/prisma/enums";

const router = Router();

// All routes require MED role
router.use(authenticateToken);
router.use(requireRole(Role.MED));

// ─── Before & After Entries ───────────────────────────────────────────────────

router.get("/entries", baController.getMyEntries);
router.get("/entries/count", baController.getMyEntryCount);
router.get("/entries/:id", baController.getMyEntryById);
router.delete("/entries/:id", baController.deleteEntry);

router.post(
  "/entries",
  uploadBAMedia.fields([
    { name: "beforePhotos", maxCount: 3 },
    { name: "afterPhotos", maxCount: 3 },
  ]),
  baController.createEntry,
);

// ─── Contest Entries ──────────────────────────────────────────────────────────

router.get("/contest", baController.getMyContestEntries);
router.get("/contest/:id", baController.getMyContestEntryById);
router.delete("/contest/:id", baController.deleteContestEntry);

router.post(
  "/contest",
  uploadContestMedia.fields([
    { name: "beforeMedia", maxCount: 10 },
    { name: "afterMedia", maxCount: 10 },
  ]),
  baController.createContestEntry,
);

export default router;
