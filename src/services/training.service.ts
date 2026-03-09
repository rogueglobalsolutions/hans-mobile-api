import prisma from "../config/prisma";
import { TrainingType, TrainingBrand, TrainingLevel, CreditTransactionType } from "../generated/prisma/enums";
import { LearningFormat } from "../utils/trainingEnums";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateTrainingInput {
  type: TrainingType;
  brand: TrainingBrand;
  level: TrainingLevel;
  learningFormats: LearningFormat[];
  title: string;
  speaker: string;
  speakerIntro: string;
  productsUsed?: string;
  areasCovered: string;
  description: string;
  backgroundImagePath?: string;
  location?: string;      // e.g. "Morristown, NJ"
  scheduledAt?: Date;     // When the training is scheduled
  price: number;          // USD — derived from level by the controller
  creditScore: number;    // In-house currency — derived from level by the controller
  createdBy: string;      // admin userId
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Create a new training. Immediately published and visible to MED users.
 */
export async function createTraining(input: CreateTrainingInput) {
  const training = await prisma.training.create({
    data: {
      type:                input.type,
      brand:               input.brand,
      level:               input.level,
      learningFormats:     input.learningFormats,
      title:               input.title,
      speaker:             input.speaker,
      speakerIntro:        input.speakerIntro,
      productsUsed:        input.productsUsed ?? null,
      areasCovered:        input.areasCovered,
      description:         input.description,
      backgroundImagePath: input.backgroundImagePath ?? null,
      location:            input.location ?? null,
      scheduledAt:         input.scheduledAt ?? null,
      price:               input.price,
      creditScore:         input.creditScore,
      createdBy:           input.createdBy,
    },
  });

  return training;
}

/**
 * List all trainings (for MED users). Returns summary fields — no enrollment data.
 */
export async function getTrainings() {
  const trainings = await prisma.training.findMany({
    select: {
      id:                  true,
      type:                true,
      brand:               true,
      level:               true,
      learningFormats:     true,
      title:               true,
      speaker:             true,
      backgroundImagePath: true,
      location:            true,
      scheduledAt:         true,
      price:               true,
      creditScore:         true,
      createdAt:           true,
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return trainings;
}

/**
 * Get full details of a single training, including whether a given user is enrolled.
 */
export async function getTrainingById(trainingId: string, requestingUserId?: string) {
  const training = await prisma.training.findUnique({
    where: { id: trainingId },
    include: {
      _count: {
        select: { enrollments: true },
      },
    },
  });

  if (!training) {
    throw new Error("Training not found");
  }

  let isEnrolled = false;
  if (requestingUserId) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_trainingId: {
          userId:     requestingUserId,
          trainingId: trainingId,
        },
      },
    });
    isEnrolled = !!enrollment;
  }

  return { ...training, isEnrolled };
}

/**
 * Enroll a MED user in a training. Idempotent — re-enrolling an already-enrolled
 * user is a no-op (no duplicate credit awarded).
 *
 * On first enrollment:
 *  1. Creates the Enrollment row
 *  2. Creates a CreditTransaction (EARNED) if creditScore > 0
 *  3. Increments the user's creditBalance
 * All three writes happen inside a single Prisma interactive transaction.
 */
export async function enrollUser(userId: string, trainingId: string) {
  const training = await prisma.training.findUnique({
    where: { id: trainingId },
  });

  if (!training) {
    throw new Error("Training not found");
  }

  // Check whether the user is already enrolled before opening a transaction
  const existing = await prisma.enrollment.findUnique({
    where: { userId_trainingId: { userId, trainingId } },
  });

  if (existing) {
    // Already enrolled — no credit awarded again
    return { message: "Already enrolled", alreadyEnrolled: true };
  }

  await prisma.$transaction(async (tx) => {
    // 1. Create enrollment
    await tx.enrollment.create({ data: { userId, trainingId } });

    // 2. Award credit (only if training carries credit score)
    if (training.creditScore > 0) {
      await tx.creditTransaction.create({
        data: {
          userId,
          type:        CreditTransactionType.EARNED,
          amount:      training.creditScore,
          description: `Enrolled in ${training.title}`,
          referenceId: trainingId,
        },
      });

      // 3. Increment running balance
      await tx.user.update({
        where: { id: userId },
        data:  { creditBalance: { increment: training.creditScore } },
      });
    }
  });

  return { message: "Enrolled successfully", alreadyEnrolled: false };
}
