import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import prisma from "../config/prisma";
import { Role } from "../generated/prisma/enums";

interface TokenPayload {
  userId: string;
  email: string;
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ success: false, message: "Access token required" });
    return;
  }

  try {
    const payload = verifyToken<TokenPayload>(token);

    if (!payload) {
      res.status(403).json({ success: false, message: "Invalid or expired token" });
      return;
    }

    // Attach user info to request object
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;

    next();
  } catch (error) {
    res.status(403).json({ success: false, message: "Invalid or expired token" });
  }
}

export function requireRole(...allowedRoles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;

      if (!userId) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        res.status(401).json({ success: false, message: "User not found" });
        return;
      }

      if (!allowedRoles.includes(user.role)) {
        res.status(403).json({ success: false, message: "Insufficient permissions" });
        return;
      }

      (req as any).userRole = user.role;
      next();
    } catch (error) {
      res.status(500).json({ success: false, message: "Authorization check failed" });
    }
  };
}
