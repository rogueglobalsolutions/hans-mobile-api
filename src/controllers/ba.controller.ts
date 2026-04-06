import { Request, Response } from "express";
import * as baService from "../services/ba.service";
import { sanitizeError } from "../utils/errors";
import { MediaSection } from "../generated/prisma/enums";

// ─── MED: Before & After Entries ──────────────────────────────────────────────

export async function createEntry(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { title, description } = req.body;

    if (!title?.trim()) {
      res.status(400).json({ success: false, message: "Title is required" });
      return;
    }
    if (!description?.trim()) {
      res.status(400).json({ success: false, message: "Description is required" });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (!files) {
      res.status(400).json({ success: false, message: "No media files provided" });
      return;
    }

    // Parse media metadata from body (JSON array of { section, label } per file field)
    // Files come as beforePhotos[0], beforePhotos[1], ... afterPhotos[0], afterPhotos[1], ...
    const mediaItems: { section: MediaSection; label: string; filePath: string }[] = [];

    const labels = ["Left Side Face", "Center Face", "Right Side Face"];

    const beforeFiles = files["beforePhotos"] || [];
    for (let i = 0; i < beforeFiles.length; i++) {
      mediaItems.push({
        section: MediaSection.BEFORE,
        label: labels[i] || `Photo ${i + 1}`,
        filePath: `uploads/ba-media/${beforeFiles[i].filename}`,
      });
    }

    const afterFiles = files["afterPhotos"] || [];
    for (let i = 0; i < afterFiles.length; i++) {
      mediaItems.push({
        section: MediaSection.AFTER,
        label: labels[i] || `Photo ${i + 1}`,
        filePath: `uploads/ba-media/${afterFiles[i].filename}`,
      });
    }

    if (mediaItems.length === 0) {
      res.status(400).json({ success: false, message: "At least one photo is required" });
      return;
    }

    const entry = await baService.createEntry(userId, title.trim(), description.trim(), mediaItems);
    res.status(201).json({ success: true, message: "Entry created successfully", data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "createBAEntry") });
  }
}

export async function getMyEntries(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const entries = await baService.getMyEntries(userId);
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getMyBAEntries") });
  }
}

export async function getMyEntryById(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const entry = await baService.getMyEntryById(userId, req.params.id as string);
    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getMyBAEntryById") });
  }
}

export async function deleteEntry(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    await baService.deleteEntry(userId, req.params.id as string);
    res.json({ success: true, message: "Entry deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "deleteBAEntry") });
  }
}

export async function getMyEntryCount(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const count = await baService.getMyEntryCount(userId);
    res.json({ success: true, data: { count } });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getBAEntryCount") });
  }
}

// ─── MED: Contest Entries ─────────────────────────────────────────────────────

export async function createContestEntry(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { title, description } = req.body;

    if (!title?.trim()) {
      res.status(400).json({ success: false, message: "Title is required" });
      return;
    }
    if (!description?.trim()) {
      res.status(400).json({ success: false, message: "Description is required" });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (!files) {
      res.status(400).json({ success: false, message: "No media files provided" });
      return;
    }

    const mediaItems: { section: MediaSection; filePath: string; fileType: string }[] = [];

    const beforeFiles = files["beforeMedia"] || [];
    for (const file of beforeFiles) {
      mediaItems.push({
        section: MediaSection.BEFORE,
        filePath: `uploads/contest-media/${file.filename}`,
        fileType: file.mimetype.startsWith("video/") ? "video" : "image",
      });
    }

    const afterFiles = files["afterMedia"] || [];
    for (const file of afterFiles) {
      mediaItems.push({
        section: MediaSection.AFTER,
        filePath: `uploads/contest-media/${file.filename}`,
        fileType: file.mimetype.startsWith("video/") ? "video" : "image",
      });
    }

    if (mediaItems.filter((m) => m.section === MediaSection.BEFORE).length === 0) {
      res.status(400).json({ success: false, message: "At least one Before media is required" });
      return;
    }
    if (mediaItems.filter((m) => m.section === MediaSection.AFTER).length === 0) {
      res.status(400).json({ success: false, message: "At least one After media is required" });
      return;
    }

    const entry = await baService.createContestEntry(userId, title.trim(), description.trim(), mediaItems);
    res.status(201).json({ success: true, message: "Contest entry submitted successfully", data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "createContestEntry") });
  }
}

export async function getMyContestEntries(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const entries = await baService.getMyContestEntries(userId);
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getMyContestEntries") });
  }
}

export async function getMyContestEntryById(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const entry = await baService.getMyContestEntryById(userId, req.params.id as string);
    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getMyContestEntryById") });
  }
}

export async function deleteContestEntry(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    await baService.deleteContestEntry(userId, req.params.id as string);
    res.json({ success: true, message: "Contest entry deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "deleteContestEntry") });
  }
}

// ─── Admin: B&A Entries (view only) ──────────────────────────────────────────

export async function getAllEntries(req: Request, res: Response) {
  try {
    const entries = await baService.getAllEntries();
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getAllBAEntries") });
  }
}

export async function getEntryByIdAdmin(req: Request, res: Response) {
  try {
    const entry = await baService.getEntryByIdAdmin(req.params.id as string);
    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getBAEntryByIdAdmin") });
  }
}

// ─── Admin: Contest Entries (view + like) ────────────────────────────────────

export async function getAllContestEntries(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const entries = await baService.getAllContestEntries(adminId);
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getAllContestEntries") });
  }
}

export async function getContestEntryByIdAdmin(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const entry = await baService.getContestEntryByIdAdmin(adminId, req.params.id as string);
    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getContestEntryByIdAdmin") });
  }
}

export async function toggleContestLike(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const result = await baService.toggleContestLike(adminId, req.params.id as string);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "toggleContestLike") });
  }
}

// ─── Admin: Dashboard Stats ──────────────────────────────────────────────────

export async function getBAStats(req: Request, res: Response) {
  try {
    const stats = await baService.getBAStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "getBAStats") });
  }
}
