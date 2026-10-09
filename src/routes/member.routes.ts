import { Router } from "express";
import * as memberController from "../controllers/member.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";

// Device push tokens: any signed-in account can receive notifications.
export const notificationRoutes = Router();
notificationRoutes.use(authenticateToken);
notificationRoutes.post("/token", memberController.registerPushToken);
notificationRoutes.delete("/token", memberController.unregisterPushToken);

// Server mirror of the on-device cart (MED is the only role that checks out).
export const cartRoutes = Router();
cartRoutes.use(authenticateToken);
cartRoutes.use(requireRole(Role.MED, Role.USER));
cartRoutes.put("/", memberController.syncCart);

// Hearted products for quick access.
export const favoriteRoutes = Router();
favoriteRoutes.use(authenticateToken);
favoriteRoutes.use(requireRole(Role.MED, Role.USER));
favoriteRoutes.get("/", memberController.getFavorites);
favoriteRoutes.get("/ids", memberController.getFavoriteIds);
favoriteRoutes.post("/", memberController.addFavorite);
favoriteRoutes.delete("/:productId", memberController.removeFavorite);
