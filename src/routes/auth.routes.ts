import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth";
import { uploadProfilePicture } from "../middleware/upload";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/verify-otp", authController.verifyOtp);
router.post("/reset-password", authController.resetPassword);
router.patch("/profile", authenticateToken, authController.updateProfile);
router.patch("/profile/picture", authenticateToken, uploadProfilePicture.single("profilePicture"), authController.updateProfilePicture);
router.patch("/change-password", authenticateToken, authController.changePassword);

export default router;
