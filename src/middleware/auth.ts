import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import prisma from "../config/prisma";
import { AccountStatus, Role } from "../generated/prisma/enums";

interface TokenPayload {
  userId: string;
  email: string;
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { deletedAt: true, accountStatus: true, role: true },
    });
    if (!user || user.deletedAt || user.accountStatus === AccountStatus.SUSPENDED) {
      res.status(401).json({ success: false, message: "Account is no longer active" });
      return;
    }

    // Attach user info to request object
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    // Lets requireRole skip a second user lookup on the same request.
    (req as any).userRole = user.role;

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

      let role: Role | undefined = (req as any).userRole;
      if (!role) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });

        if (!user) {
          res.status(401).json({ success: false, message: "User not found" });
          return;
        }
        role = user.role;
      }

      if (!allowedRoles.includes(role)) {
        res.status(403).json({ success: false, message: "Insufficient permissions" });
        return;
      }

      (req as any).userRole = role;
      next();
    } catch (error) {
      res.status(500).json({ success: false, message: "Authorization check failed" });
    }
  };
}
