import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import verificationRoutes from "./routes/verification.routes";
import adminRoutes from "./routes/admin.routes";
import trainingRoutes from "./routes/training.routes";
import creditRoutes from "./routes/credit.routes";
import chatRoutes from "./routes/chat.routes";
import appointmentRoutes from "./routes/appointment.routes";
import baRoutes from "./routes/ba.routes";
import { initSocket } from "./socket";

dotenv.config();

const app = express();
const server = http.createServer(app);
initSocket(server);

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files (ID documents, training background images, etc.)
// In production, replace with signed URLs or a CDN-backed route with auth checks.
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "API is up!" });
});

app.use("/api/auth", authRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/trainings", trainingRoutes);
app.use("/api/credits", creditRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/ba", baRoutes);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

const PORT = process.env.PORT || 5656;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
