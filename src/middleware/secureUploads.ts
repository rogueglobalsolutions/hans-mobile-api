import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { Role } from "../generated/prisma/enums";
import { authenticateToken } from "./auth";

const publicDirectories = new Set(["ads", "product-images", "trainings-bg-img", "trainings-speaker-img"]);
const privateDirectories = new Set([
  "verifications", "profile-pictures", "ba-media", "contest-media", "training-docs",
  "chat", "training-requests", "shipping-labels",
]);

async function canReadPrivateUpload(directory: string, filePath: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return false;
  const admin = user.role === Role.ADMIN;

  switch (directory) {
    case "verifications":
      return !!await prisma.user.findFirst({
        where: { OR: [{ idDocumentFrontPath: filePath }, { idDocumentBackPath: filePath }], ...(admin ? {} : { id: userId }) },
        select: { id: true },
      });
    case "profile-pictures":
      return !!await prisma.user.findFirst({ where: { profilePicturePath: filePath }, select: { id: true } });
    case "ba-media":
      return !!await prisma.beforeAndAfterMedia.findFirst({
        where: { filePath, ...(admin ? {} : { entry: { userId } }) }, select: { id: true },
      });
    case "contest-media":
      return !!await prisma.contestEntryMedia.findFirst({
        where: { filePath, ...(admin ? {} : { entry: { userId } }) }, select: { id: true },
      });
    case "training-docs":
      return admin && !!await prisma.trainingDocument.findFirst({ where: { filePath }, select: { id: true } });
    case "chat":
      return !!await prisma.chatMessage.findFirst({ where: { imageUrl: filePath }, select: { id: true } });
    case "training-requests":
      return !!await prisma.trainingChangeRequest.findFirst({
        where: { supportingDocumentPath: filePath, ...(admin ? {} : { enrollment: { userId } }) },
        select: { id: true },
      });
    case "shipping-labels":
      return !!await prisma.shippingLabel.findFirst({
        where: { labelUrl: filePath, ...(admin ? {} : { order: { userId } }) }, select: { id: true },
      });
    default:
      return false;
  }
}

export function secureUploads(req: Request, res: Response, next: NextFunction) {
  const parts = req.path.split("/").filter(Boolean);
  if (parts.length !== 2 || !/^[A-Za-z0-9._-]+$/.test(parts[1]) || parts[1] === "." || parts[1] === "..") {
    res.status(404).end();
    return;
  }
  const [directory, filename] = parts;
  if (publicDirectories.has(directory)) return next();
  if (!privateDirectories.has(directory)) {
    res.status(404).end();
    return;
  }
  authenticateToken(req, res, () => {
    canReadPrivateUpload(directory, `uploads/${directory}/${filename}`, (req as any).userId as string)
      .then(allowed => allowed ? next() : res.status(404).end())
      .catch(next);
  });
}
