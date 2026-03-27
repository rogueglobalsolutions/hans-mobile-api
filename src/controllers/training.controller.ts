import { Request, Response } from "express";
import * as trainingService from "../services/training.service";
import {
  TRAINING_TYPE_FROM_LABEL,
  TRAINING_BRAND_FROM_LABEL,
  TRAINING_LEVEL_FROM_LABEL,
  TRAINING_TYPE_LABELS,
  TRAINING_BRAND_LABELS,
  TRAINING_LEVEL_LABELS,
  TRAINING_LEVEL_PRICING,
  learningFormatsFromLabels,
  learningFormatsToLabels,
  LearningFormat,
} from "../utils/trainingEnums";
import { TrainingType, TrainingBrand, TrainingLevel } from "../generated/prisma/enums";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a Training DB record's enum fields back to display labels for the response.
 */
function formatTrainingResponse(training: any) {
  const learningFormats = Array.isArray(training.learningFormats)
    ? learningFormatsToLabels(training.learningFormats as LearningFormat[])
    : [];

  return {
    ...training,
    type:            TRAINING_TYPE_LABELS[training.type as TrainingType]  ?? training.type,
    brand:           TRAINING_BRAND_LABELS[training.brand as TrainingBrand] ?? training.brand,
    level:           TRAINING_LEVEL_LABELS[training.level as TrainingLevel] ?? training.level,
    learningFormats,
  };
}

// ─── Admin: Create Training ───────────────────────────────────────────────────

/**
 * POST /api/admin/trainings
 * Creates a new training session. Admin only.
 */
export async function createTraining(req: Request, res: Response) {
  try {
    const {
      type: typeLabel,
      brand: brandLabel,
      level: levelLabel,
      learningFormats: learningFormatLabels,
      title,
      speaker,
      speakerIntro,
      productsUsed,
      areasCovered,
      description,
      location,
      scheduledAt: scheduledAtRaw,
    } = req.body;

    const errors: string[] = [];

    // Required field validation
    if (!typeLabel)        errors.push("type is required");
    if (!brandLabel)       errors.push("brand is required");
    if (!levelLabel)       errors.push("level is required");
    if (!title?.trim())    errors.push("title is required");
    if (!speaker?.trim())  errors.push("speaker is required");
    if (!speakerIntro?.trim()) errors.push("speakerIntro is required");
    if (!areasCovered?.trim()) errors.push("areasCovered is required");
    if (!description?.trim())  errors.push("description is required");
    if (!location?.trim())     errors.push("location is required");
    if (!scheduledAtRaw)       errors.push("scheduledAt is required");

    // Parse and validate scheduledAt
    let scheduledAt: Date | undefined;
    if (scheduledAtRaw) {
      scheduledAt = new Date(scheduledAtRaw);
      if (isNaN(scheduledAt.getTime())) {
        errors.push("scheduledAt must be a valid ISO 8601 date string");
        scheduledAt = undefined;
      }
    }

    // Enum label validation
    const type = TRAINING_TYPE_FROM_LABEL[typeLabel];
    if (typeLabel && !type) {
      errors.push(`Invalid type "${typeLabel}". Must be one of: ${Object.keys(TRAINING_TYPE_FROM_LABEL).join(", ")}`);
    }

    const brand = TRAINING_BRAND_FROM_LABEL[brandLabel];
    if (brandLabel && !brand) {
      errors.push(`Invalid brand "${brandLabel}". Must be one of: ${Object.keys(TRAINING_BRAND_FROM_LABEL).join(", ")}`);
    }

    const level = TRAINING_LEVEL_FROM_LABEL[levelLabel];
    if (levelLabel && !level) {
      errors.push(`Invalid level "${levelLabel}". Must be one of: ${Object.keys(TRAINING_LEVEL_FROM_LABEL).join(", ")}`);
    }

    // learningFormats arrives as a JSON-stringified string from multipart/form-data
    // e.g. '["Demo","Didactic"]' — parse it back to an array before validating
    let parsedLearningFormatLabels: string[] = [];
    if (typeof learningFormatLabels === "string") {
      try {
        const parsed = JSON.parse(learningFormatLabels);
        if (Array.isArray(parsed)) parsedLearningFormatLabels = parsed;
      } catch {
        // leave as empty array — will fail validation below
      }
    } else if (Array.isArray(learningFormatLabels)) {
      parsedLearningFormatLabels = learningFormatLabels;
    }

    // Learning formats validation
    let learningFormats: LearningFormat[] | null = null;
    if (parsedLearningFormatLabels.length === 0) {
      errors.push("learningFormats must be a non-empty array");
    } else {
      learningFormats = learningFormatsFromLabels(parsedLearningFormatLabels);
      if (!learningFormats) {
        errors.push(`Invalid learningFormats. Each value must be one of: Demo, Didactic, Discussion`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    // Background image path (optional)
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const backgroundImagePath = files?.backgroundImage?.[0]
      ? `uploads/trainings-bg-img/${files.backgroundImage[0].filename}`
      : undefined;

    const adminId = (req as any).userId as string;

    // Auto-populate price and creditScore from the level — not a client input
    const { price, creditScore } = TRAINING_LEVEL_PRICING[level!];

    const training = await trainingService.createTraining({
      type:            type!,
      brand:           brand!,
      level:           level!,
      learningFormats: learningFormats!,
      title:           title.trim(),
      speaker:         speaker.trim(),
      speakerIntro:    speakerIntro.trim(),
      productsUsed:    productsUsed?.trim() || undefined,
      areasCovered:    areasCovered.trim(),
      description:     description.trim(),
      backgroundImagePath,
      location:        location?.trim(),
      scheduledAt,
      price,
      creditScore,
      createdBy:       adminId,
    });

    return res.status(201).json({
      success: true,
      message: "Training created successfully",
      data:    formatTrainingResponse(training),
    });
  } catch (err: any) {
    console.error("[createTraining]", err);
    return res.status(500).json({ success: false, message: "Failed to create training" });
  }
}

// ─── MED: List Trainings ──────────────────────────────────────────────────────

/**
 * GET /api/trainings
 * Returns all trainings for MED users (summary view).
 */
export async function getTrainings(req: Request, res: Response) {
  try {
    const trainings = await trainingService.getTrainings();

    return res.json({
      success: true,
      message: "Trainings retrieved successfully",
      data:    trainings.map(formatTrainingResponse),
    });
  } catch (err: any) {
    console.error("[getTrainings]", err);
    return res.status(500).json({ success: false, message: "Failed to retrieve trainings" });
  }
}

// ─── MED: Training Detail ─────────────────────────────────────────────────────

/**
 * GET /api/trainings/:id
 * Full details of a single training, including enrollment status for the requesting user.
 */
export async function getTrainingById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const requestingUserId = (req as any).userId as string | undefined;

    const training = await trainingService.getTrainingById(id, requestingUserId);

    return res.json({
      success: true,
      message: "Training retrieved successfully",
      data:    formatTrainingResponse(training),
    });
  } catch (err: any) {
    if (err.message === "Training not found") {
      return res.status(404).json({ success: false, message: "Training not found" });
    }
    console.error("[getTrainingById]", err);
    return res.status(500).json({ success: false, message: "Failed to retrieve training" });
  }
}

// ─── Admin: Cancel Training ───────────────────────────────────────────────────

/**
 * POST /api/admin/trainings/:id/cancel
 * Cancel a training with exactly 1 paid enrollee and issue a refund.
 */
export async function cancelTraining(req: Request, res: Response) {
  try {
    const trainingId = req.params.id as string;
    const adminId = (req as any).userId as string;
    const result = await trainingService.cancelTraining(trainingId, adminId);
    return res.json({ success: true, message: result.message });
  } catch (err: any) {
    const knownErrors = [
      "Training not found",
      "Training is already cancelled",
      "Training can only be cancelled",
      "No payment found",
    ];
    if (knownErrors.some((e) => err.message?.includes(e))) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error("[cancelTraining]", err);
    return res.status(500).json({ success: false, message: "Failed to cancel training" });
  }
}

// ─── Admin: Enrollees for a Training ─────────────────────────────────────────

/**
 * GET /api/admin/trainings/:id/enrollees
 */
export async function getTrainingEnrollees(req: Request, res: Response) {
  try {
    const trainingId = req.params.id as string;
    const enrollees = await trainingService.getTrainingEnrollees(trainingId);
    return res.json({ success: true, data: enrollees });
  } catch (err: any) {
    console.error("[getTrainingEnrollees]", err);
    return res.status(500).json({ success: false, message: "Failed to retrieve enrollees" });
  }
}
