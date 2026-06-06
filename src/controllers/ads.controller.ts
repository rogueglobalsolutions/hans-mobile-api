import { Request, Response } from "express";
import * as adsService from "../services/ads.service";
import { sanitizeError } from "../utils/errors";
import sharp from "sharp";
import path from "path";
import fs from "fs";

// ─── Upload a single ad image ─────────────────────────────────────────────────

export async function uploadAdImage(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: "No file uploaded" });
      return;
    }

    // Compress and overwrite the uploaded file using sharp
    const outputPath = file.path; // same path, overwrite in place
    const tempPath = file.path + "_tmp";

    await sharp(file.path)
      .resize({ width: 1080, withoutEnlargement: true }) // cap at 1080px wide
      .jpeg({ quality: 60, progressive: true })          // convert to JPEG, 60% quality
      .toFile(tempPath);

    // Replace original with compressed version
    fs.renameSync(tempPath, outputPath);

    // Always return .jpg extension regardless of original
    const url = `uploads/ads/${file.filename}`;
    res.status(201).json({ success: true, url });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "uploadAdImage") });
  }
}

// ─── Create ad config ─────────────────────────────────────────────────────────

export async function createAdConfig(req: Request, res: Response) {
  try {
    const { slides, isActive, intervalSeconds } = req.body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      res.status(400).json({ success: false, message: "At least one slide is required" });
      return;
    }

    const config = await adsService.createAdConfig({ slides, isActive, intervalSeconds });
    res.status(201).json({ success: true, data: config });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "createAdConfig") });
  }
}

// ─── Update ad config ─────────────────────────────────────────────────────────

export async function updateAdConfig(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { slides, isActive, intervalSeconds } = req.body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      res.status(400).json({ success: false, message: "At least one slide is required" });
      return;
    }

    const config = await adsService.updateAdConfig(id, { slides, isActive, intervalSeconds });
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "updateAdConfig") });
  }
}

// ─── Get active ad config (for MED homepage) ──────────────────────────────────

export async function getAdConfig(req: Request, res: Response) {
  try {
    const config = await adsService.getAdConfig();
    if (!config) {
      res.status(404).json({ success: false, message: "No ad config found" });
      return;
    }
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getAdConfig") });
  }
}

// ─── Delete ad config ─────────────────────────────────────────────────────────

export async function deleteAdConfig(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await adsService.deleteAdConfig(id);
    res.status(200).json({ success: true, message: "Ad deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "deleteAdConfig") });
  }
}