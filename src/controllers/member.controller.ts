import { Request, Response } from "express";
import * as pushService from "../services/push.service";
import * as cartService from "../services/cart.service";
import * as favoriteService from "../services/favorite.service";
import { sanitizeError } from "../utils/errors";

function sendError(res: Response, err: unknown, operation: string, status = 400) {
  res.status(status).json({ success: false, message: sanitizeError(err, operation) });
}

// ─── Push notifications ───────────────────────────────────────────────────────

export async function registerPushToken(req: Request, res: Response) {
  try {
    await pushService.registerToken((req as any).userId, req.body?.token, req.body?.platform);
    res.json({ success: true, message: "Push token registered" });
  } catch (err) {
    sendError(res, err, "registerPushToken");
  }
}

export async function unregisterPushToken(req: Request, res: Response) {
  try {
    await pushService.unregisterToken((req as any).userId, req.body?.token);
    res.json({ success: true, message: "Push token removed" });
  } catch (err) {
    sendError(res, err, "unregisterPushToken");
  }
}

export async function getPushConsole(req: Request, res: Response) {
  try {
    const data = await pushService.getConsole();
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getPushConsole", 500);
  }
}

export async function sendPushBroadcast(req: Request, res: Response) {
  try {
    const data = await pushService.broadcast((req as any).userId, req.body ?? {});
    res.json({ success: true, data, message: "Notification sent" });
  } catch (err) {
    sendError(res, err, "sendPushBroadcast");
  }
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export async function syncCart(req: Request, res: Response) {
  try {
    const data = await cartService.syncCart((req as any).userId, req.body?.items);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "syncCart");
  }
}

export async function getAbandonedCarts(req: Request, res: Response) {
  try {
    const hours = req.query.hours == null ? 24 : Number(req.query.hours);
    const data = await cartService.getAbandonedCarts(hours);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getAbandonedCarts", 500);
  }
}

// ─── Favorites ────────────────────────────────────────────────────────────────

export async function getFavorites(req: Request, res: Response) {
  try {
    const data = await favoriteService.getFavorites((req as any).userId);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getFavorites", 500);
  }
}

export async function getFavoriteIds(req: Request, res: Response) {
  try {
    const data = await favoriteService.getFavoriteIds((req as any).userId);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getFavoriteIds", 500);
  }
}

export async function addFavorite(req: Request, res: Response) {
  try {
    await favoriteService.addFavorite((req as any).userId, req.body?.productId);
    res.json({ success: true, message: "Added to favorites" });
  } catch (err) {
    sendError(res, err, "addFavorite");
  }
}

export async function removeFavorite(req: Request, res: Response) {
  try {
    await favoriteService.removeFavorite((req as any).userId, String(req.params.productId));
    res.json({ success: true, message: "Removed from favorites" });
  } catch (err) {
    sendError(res, err, "removeFavorite");
  }
}
