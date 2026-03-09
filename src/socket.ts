import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { saveMessage, getRecentMessages } from "./services/chat.service";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  fullName?: string;
}

// Simple in-memory rate limiter: max 1 message per second per socket
const lastMessageTime = new Map<string, number>();

function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  const last = lastMessageTime.get(socketId) ?? 0;
  if (now - last < 1000) return true;
  lastMessageTime.set(socketId, now);
  return false;
}

export function initSocket(server: HttpServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Auth middleware — verify JWT before connection is accepted
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const raw = token.startsWith("Bearer ") ? token.slice(7) : token;

    try {
      const payload = jwt.verify(raw, process.env.JWT_SECRET!) as { userId: string; fullName: string };
      socket.userId = payload.userId;
      socket.fullName = payload.fullName;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket: AuthenticatedSocket) => {
    console.log(`[chat] connected: ${socket.userId} (${socket.id})`);

    // Send chat history on connect — normalize to match new_message shape
    try {
      const history = await getRecentMessages(50);
      socket.emit("chat_history", history.map(msg => ({
        id:                 msg.id,
        userId:             msg.user.id,
        fullName:           msg.user.fullName,
        profilePicturePath: msg.user.profilePicturePath,
        message:            msg.message,
        imageUrl:           msg.imageUrl,
        createdAt:          msg.createdAt,
      })));
    } catch (err) {
      console.error("[chat] failed to load history:", err);
    }

    socket.on("send_message", async (data: { message?: string; imageUrl?: string }) => {
      const text = data?.message?.trim();
      const imageUrl = typeof data?.imageUrl === "string" && data.imageUrl.trim() ? data.imageUrl.trim() : undefined;

      // Must have at least one of message or imageUrl
      if (!text && !imageUrl) {
        socket.emit("error", { message: "Message or image is required" });
        return;
      }

      if (text && text.length > 1000) {
        socket.emit("error", { message: "Message too long (max 1000 characters)" });
        return;
      }

      if (isRateLimited(socket.id)) {
        socket.emit("error", { message: "Sending too fast, slow down" });
        return;
      }

      try {
        const saved = await saveMessage(socket.userId!, text, imageUrl);

        // Broadcast to all connected clients (including sender)
        io.emit("new_message", {
          id: saved.id,
          userId: saved.user.id,
          fullName: saved.user.fullName,
          profilePicturePath: saved.user.profilePicturePath,
          message: saved.message,
          imageUrl: saved.imageUrl,
          createdAt: saved.createdAt,
        });
      } catch (err) {
        console.error("[chat] failed to save message:", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("disconnect", () => {
      lastMessageTime.delete(socket.id);
      console.log(`[chat] disconnected: ${socket.userId} (${socket.id})`);
    });
  });

  return io;
}
