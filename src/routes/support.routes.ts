import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { sendSupportEmail } from "../services/email.service";
import prisma from "../config/prisma";
import path from "path";

const router = Router();

// ── Serve the support page (no auth) ──
router.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../../public/support.html"));
});

// ── Web form submission (no auth, may email field) ──
router.post("/submit", async (req, res) => {
  const { userType, category, message, email } = req.body;

  if (!userType || !email?.trim() || !message?.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required." });
  }

  const sent = await sendSupportEmail(
    email.trim(),
    `${userType} (Web Form)`,
    category,
    message.trim(),
  );

  if (!sent) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to send. Please try again." });
  }

  return res.json({
    success: true,
    message: "Feedback submitted successfully.",
  });
});

// ── Mobile app submission (with auth, no email field needed) ──
router.post("/feedback", authenticateToken, async (req, res) => {
  const { category, message } = req.body;
  const userId = (req as any).userId;
  const email = (req as any).email;

  if (!category || !message?.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "Category and message are required." });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });

  const fullName = user?.fullName ?? "Unknown User";

  const sent = await sendSupportEmail(
    email,
    fullName,
    category,
    message.trim(),
  );

  if (!sent) {
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to send feedback. Please try again.",
      });
  }

  return res.json({
    success: true,
    message: "Feedback submitted successfully.",
  });
});

export default router;
