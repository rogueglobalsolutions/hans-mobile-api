import { Router } from "express";
import { uploadChatImage } from "../controllers/chat.controller";
import { authenticateToken } from "../middleware/auth";
import { uploadChatImage as uploadChatImageMiddleware } from "../middleware/upload";

const router = Router();

// Upload an image to be sent in chat — returns imageUrl to pass via socket
router.post(
  "/images",
  authenticateToken,
  uploadChatImageMiddleware.single("image"),
  uploadChatImage,
);

export default router;
