import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import * as trainingDocService from "../services/trainingDoc.service";
import { sanitizeError } from "../utils/errors";

export async function getFolders(req: Request, res: Response) {
  try {
    const trainingId = req.params.id as string;
    const folders = await trainingDocService.getFoldersForTraining(trainingId);
    res.json({ success: true, data: folders });
  } catch (err) {
    res.status(500).json({ success: false, message: sanitizeError(err, "getFolders") });
  }
}

export async function createFolder(req: Request, res: Response) {
  try {
    const trainingId = req.params.id as string;
    const { name, parentId } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ success: false, message: "Folder name is required" });
      return;
    }
    const folder = await trainingDocService.createFolder(trainingId, name.trim(), parentId);
    res.status(201).json({ success: true, data: folder });
  } catch (err: any) {
    const status = err.message?.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, message: sanitizeError(err, "createFolder") });
  }
}

export async function uploadDocument(req: Request, res: Response) {
  try {
    const folderId = req.params.folderId as string;
    const file = (req as any).file as Express.Multer.File;
    if (!file) {
      res.status(400).json({ success: false, message: "No file uploaded" });
      return;
    }
    const doc = await trainingDocService.addDocument(
      folderId,
      file.originalname,
      `uploads/training-docs/${file.filename}`,
      file.size,
      file.mimetype,
    );
    res.status(201).json({ success: true, data: doc });
  } catch (err: any) {
    const status = err.message?.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, message: sanitizeError(err, "uploadDocument") });
  }
}

export async function deleteFolder(req: Request, res: Response) {
  try {
    await trainingDocService.deleteFolder(req.params.folderId as string);
    res.json({ success: true, message: "Folder deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: sanitizeError(err, "deleteFolder") });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  try {
    await trainingDocService.deleteDocument(req.params.docId as string);
    res.json({ success: true, message: "Document deleted" });
  } catch (err: any) {
    const status = err.message?.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, message: sanitizeError(err, "deleteDocument") });
  }
}

export async function downloadFile(req: Request, res: Response) {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ success: false, message: "path query param is required" });
      return;
    }
    // Sanitize — only allow paths under the uploads directory
    const resolved = path.resolve(filePath);
    const uploadsDir = path.resolve("uploads");
    if (!resolved.startsWith(uploadsDir)) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }
    if (!fs.existsSync(resolved)) {
      res.status(404).json({ success: false, message: "File not found" });
      return;
    }
    res.download(resolved);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to download file" });
  }
}
