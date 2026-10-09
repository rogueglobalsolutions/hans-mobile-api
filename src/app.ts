import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import "./config/env";
import authRoutes from "./routes/auth.routes";
import verificationRoutes from "./routes/verification.routes";
import adminRoutes from "./routes/admin.routes";
import trainingRoutes from "./routes/training.routes";
import creditRoutes from "./routes/credit.routes";
import chatRoutes from "./routes/chat.routes";
import appointmentRoutes from "./routes/appointment.routes";
import baRoutes from "./routes/ba.routes";
import salesRepRoutes from "./routes/salesRep.routes";
import paymentRoutes from "./routes/payment.routes";
import * as paymentController from "./controllers/payment.controller";
import locationRoutes from "./routes/location.routes";
import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";
import draftOrderRoutes from "./routes/draftOrder.routes";
import * as salesRepController from "./controllers/salesRep.controller";
import { authenticateToken, requireRole } from "./middleware/auth";
import { secureUploads } from "./middleware/secureUploads";
import { requestLogger } from "./middleware/requestLogger";
import { Role } from "./generated/prisma/enums";
import { initSocket } from "./socket";
import supportRoutes from "./routes/support.routes";
import adsRoutes from "./routes/ads.routes";
import discountRoutes from "./routes/discount.routes";
import webAuthRoutes from "./routes/web/webAuth.routes";
import healthRoutes from "./routes/health.routes";
import { notificationRoutes, cartRoutes, favoriteRoutes } from "./routes/member.routes";
import { enforceTrainingPaymentDeadlines } from "./services/trainingLifecycle.service";
import { finalizeClosedContestWeeks } from "./services/contestWeek.service";

const app = express();
const server = http.createServer(app);
initSocket(server);

// Middleware
app.use(requestLogger);
app.use(cors());

// Stripe signature verification requires the untouched request bytes. Register
// this endpoint before the global JSON parser so req.body remains a Buffer.
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook,
);

app.use(express.json());

app.use("/uploads", secureUploads, express.static(path.join(process.cwd(), "uploads")));

// Routes
app.use("/api/health", healthRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/trainings", trainingRoutes);
app.use("/api/credits", creditRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/ba", baRoutes);
app.use("/api/sales-rep", salesRepRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/draft-orders", draftOrderRoutes);
app.use("/api/support", supportRoutes); 
app.use("/api/locations", locationRoutes);
app.use("/api/ads", adsRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/web/auth", webAuthRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use(express.static(path.join(process.cwd(), "public")));

// Public — list sales reps for registration dropdown (MED + ADMIN)
app.get(
  "/api/sales-reps",
  authenticateToken,
  requireRole(Role.MED, Role.ADMIN),
  salesRepController.listSalesReps,
);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

const PORT = process.env.PORT || 5656;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  enforceTrainingPaymentDeadlines().catch((error) => {
    console.error("Failed to enforce training payment deadlines:", error);
  });
  finalizeClosedContestWeeks().catch((error) => {
    console.error("Failed to finalize closed contest weeks:", error);
  });
  const deadlineTimer = setInterval(() => {
    enforceTrainingPaymentDeadlines().catch((error) => {
      console.error("Failed to enforce training payment deadlines:", error);
    });
    finalizeClosedContestWeeks().catch((error) => {
      console.error("Failed to finalize closed contest weeks:", error);
    });
  }, 60 * 60 * 1000);
  deadlineTimer.unref();
});
