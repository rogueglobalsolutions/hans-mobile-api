import prisma from "../config/prisma";
import { stripe, TRAINING_LEVEL_STRIPE_PRICES, OBSERVER_PRICE_CENTS } from "../config/stripe";
import {
  TrainingType, TrainingBrand, TrainingLevel, CreditTransactionType,
  TrainingStatus, EnrollmentType, PaymentStatus,
} from "../generated/prisma/enums";
import { LearningFormat, TRAINING_LEVEL_PRICING } from "../utils/trainingEnums";
import { sendTrainingCancellationEmail } from "./email.service";

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
  location?: string;
  scheduledAt?: Date;
  price: number;
  creditScore: number;
  createdBy: string;
}

const PREREQUISITE_LEVELS = new Set([
  TrainingLevel.ADVANCED,
  TrainingLevel.PACKAGE_BUNDLE_1,
  TrainingLevel.PACKAGE_BUNDLE_2,
]);

const QUALIFYING_LEVELS = new Set([
  TrainingLevel.MINT_LIFT_GROUP_TRAINING,
  TrainingLevel.SUPPLEMENTAL,
]);

// ─── Service functions ────────────────────────────────────────────────────────

export async function createTraining(input: CreateTrainingInput) {
  return prisma.training.create({
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
}

/**
 * List all ACTIVE trainings for MED users.
 */
export async function getTrainings() {
  const trainings = await prisma.training.findMany({
    where: { status: TrainingStatus.ACTIVE },
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
      maxEnrollees:        true,
      maxObservers:        true,
      observerPrice:       true,
      status:              true,
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
 * Get full details of a single training including slot counts and enrollment status.
 */
export async function getTrainingById(trainingId: string, requestingUserId?: string) {
  const training = await prisma.training.findUnique({
    where: { id: trainingId },
  });

  if (!training) throw new Error("Training not found");

  const enrolleeCount = await prisma.enrollment.count({
    where: { trainingId, type: EnrollmentType.ENROLLEE, paymentStatus: PaymentStatus.COMPLETED },
  });
  const observerCount = await prisma.enrollment.count({
    where: { trainingId, type: EnrollmentType.OBSERVER, paymentStatus: PaymentStatus.COMPLETED },
  });

  let isEnrolled = false;
  let enrollmentType: string | null = null;
  if (requestingUserId) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_trainingId: { userId: requestingUserId, trainingId } },
    });
    if (enrollment && enrollment.paymentStatus === PaymentStatus.COMPLETED) {
      isEnrolled = true;
      enrollmentType = enrollment.type;
    }
  }

  // Prerequisite check (only relevant for advanced levels)
  let meetsPrerequisite = true;
  if (requestingUserId && PREREQUISITE_LEVELS.has(training.level as TrainingLevel)) {
    const hasPrereq = await prisma.enrollment.findFirst({
      where: {
        userId: requestingUserId,
        paymentStatus: PaymentStatus.COMPLETED,
        training: { level: { in: Array.from(QUALIFYING_LEVELS) as TrainingLevel[] } },
      },
    });
    meetsPrerequisite = !!hasPrereq;
  }

  return {
    ...training,
    enrolleeCount,
    observerCount,
    availableSlots: Math.max(0, training.maxEnrollees - enrolleeCount),
    availableObserverSlots: Math.max(0, training.maxObservers - observerCount),
    isEnrolled,
    enrollmentType,
    meetsPrerequisite,
  };
}

/**
 * Create a Stripe PaymentIntent and a pending Enrollment row.
 * Returns { clientSecret, enrollmentType, amountCents, paymentIntentId }.
 */
export async function initiateEnrollment(
  userId: string,
  trainingId: string,
  salesRepId?: string,
) {
  const training = await prisma.training.findUnique({ where: { id: trainingId } });
  if (!training) throw new Error("Training not found");
  if (training.status !== TrainingStatus.ACTIVE) throw new Error("Training is not available for enrollment");

  // Check slot availability
  const enrolleeCount = await prisma.enrollment.count({
    where: { trainingId, type: EnrollmentType.ENROLLEE, paymentStatus: PaymentStatus.COMPLETED },
  });
  const observerCount = await prisma.enrollment.count({
    where: { trainingId, type: EnrollmentType.OBSERVER, paymentStatus: PaymentStatus.COMPLETED },
  });

  let enrollmentType: EnrollmentType;
  let amountUsd: number;

  if (enrolleeCount < training.maxEnrollees) {
    enrollmentType = EnrollmentType.ENROLLEE;
    amountUsd = TRAINING_LEVEL_PRICING[training.level].price;
  } else if (observerCount < training.maxObservers) {
    enrollmentType = EnrollmentType.OBSERVER;
    amountUsd = OBSERVER_PRICE_CENTS / 100;
  } else {
    throw new Error("Training is full");
  }

  const amountCents = amountUsd * 100; // Stripe requires cents

  // Prerequisite check for advanced levels
  if (PREREQUISITE_LEVELS.has(training.level)) {
    const hasPrerequisite = await prisma.enrollment.findFirst({
      where: {
        userId,
        paymentStatus: PaymentStatus.COMPLETED,
        training: { level: { in: Array.from(QUALIFYING_LEVELS) as TrainingLevel[] } },
      },
    });
    if (!hasPrerequisite) {
      throw new Error("You must complete a Mint Lift Group Training or Supplemental training first");
    }
  }

  // Check not already enrolled (with completed payment)
  const existing = await prisma.enrollment.findUnique({
    where: { userId_trainingId: { userId, trainingId } },
  });
  if (existing && existing.paymentStatus === PaymentStatus.COMPLETED) {
    throw new Error("Already enrolled in this training");
  }

  // Create Stripe PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    metadata: { trainingId, userId, enrollmentType },
    payment_method_types: ['card'], // add 'paypal' here later
  });

  // Upsert pending enrollment (handle case where user retries after failed payment)
  if (existing) {
    await prisma.enrollment.update({
      where: { userId_trainingId: { userId, trainingId } },
      data: {
        type: enrollmentType,
        salesRepId: salesRepId ?? null,
        paymentStatus: PaymentStatus.PENDING,
        stripePaymentIntentId: paymentIntent.id,
        paidAmount: amountUsd,
      },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        userId,
        trainingId,
        type: enrollmentType,
        salesRepId: salesRepId ?? null,
        paymentStatus: PaymentStatus.PENDING,
        stripePaymentIntentId: paymentIntent.id,
        paidAmount: amountUsd,
      },
    });
  }

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
    enrollmentType,
    amountUsd,
  };
}

/**
 * Confirm enrollment after successful Stripe payment.
 * Awards credits for ENROLLEE type.
 */
export async function confirmEnrollmentPayment(paymentIntentId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { training: true, user: true },
  });

  if (!enrollment) throw new Error("Enrollment not found");
  if (enrollment.paymentStatus === PaymentStatus.COMPLETED) {
    return { message: "Already confirmed", alreadyConfirmed: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { paymentStatus: PaymentStatus.COMPLETED, paidAt: new Date() },
    });

    // Award credits only for regular enrollees (not observers)
    if (enrollment.type === EnrollmentType.ENROLLEE && enrollment.training.creditScore > 0) {
      await tx.creditTransaction.create({
        data: {
          userId:      enrollment.userId,
          type:        CreditTransactionType.EARNED,
          amount:      enrollment.training.creditScore,
          description: `Enrolled in ${enrollment.training.title}`,
          referenceId: enrollment.trainingId,
        },
      });
      await tx.user.update({
        where: { id: enrollment.userId },
        data:  { creditBalance: { increment: enrollment.training.creditScore } },
      });
    }
  });

  // Send enrollment confirmation email (don't block payment confirmation on email failure)
  try {
    const { sendEnrollmentConfirmationEmail } = await import("./email.service");
    await sendEnrollmentConfirmationEmail({
      to: enrollment.user.email,
      fullName: enrollment.user.fullName,
      training: {
        title: enrollment.training.title,
        scheduledAt: enrollment.training.scheduledAt,
        location: enrollment.training.location || "",
        speaker: enrollment.training.speaker || "",
        level: enrollment.training.level,
      },
      enrollmentType: enrollment.type as "ENROLLEE" | "OBSERVER",
    });
  } catch (emailError) {
    console.error("Failed to send enrollment confirmation email:", emailError);
  }

  return { message: "Enrollment confirmed", alreadyConfirmed: false };
}

/**
 * Cancel a training with exactly 1 paid enrollee (non-observer).
 * Issues a full Stripe refund and sends cancellation email.
 */
export async function cancelTraining(trainingId: string, adminId: string) {
  const training = await prisma.training.findUnique({ where: { id: trainingId } });
  if (!training) throw new Error("Training not found");
  if (training.status !== TrainingStatus.ACTIVE) throw new Error("Training is already cancelled or completed");

  const enrollees = await prisma.enrollment.findMany({
    where: { trainingId, type: EnrollmentType.ENROLLEE, paymentStatus: PaymentStatus.COMPLETED },
    include: { user: true },
  });
  const observers = await prisma.enrollment.findMany({
    where: { trainingId, type: EnrollmentType.OBSERVER, paymentStatus: PaymentStatus.COMPLETED },
  });

  if (enrollees.length !== 1 || observers.length !== 0) {
    throw new Error("Training can only be cancelled when there is exactly 1 paid enrollee and no observers");
  }

  const enrollment = enrollees[0];
  if (!enrollment.stripePaymentIntentId) throw new Error("No payment found for this enrollment");

  // Issue Stripe refund
  const refund = await stripe.refunds.create({ payment_intent: enrollment.stripePaymentIntentId });

  await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        paymentStatus: PaymentStatus.REFUNDED,
        stripeRefundId: refund.id,
        refundedAt: new Date(),
      },
    });
    await tx.training.update({
      where: { id: trainingId },
      data: { status: TrainingStatus.CANCELLED, cancelledAt: new Date(), cancelledBy: adminId },
    });
  });

  // Send cancellation email
  const refundAmountUsd = enrollment.paidAmount ?? 0;
  await sendTrainingCancellationEmail(
    enrollment.user.email,
    enrollment.user.fullName,
    training.title,
    refundAmountUsd,
  );

  return { message: "Training cancelled and refund issued" };
}

/**
 * Get all completed-payment enrollees for an admin-viewed training.
 */
export async function getTrainingEnrollees(trainingId: string) {
  return prisma.enrollment.findMany({
    where: { trainingId, paymentStatus: PaymentStatus.COMPLETED },
    include: {
      user:     { select: { id: true, fullName: true, email: true, phoneNumber: true } },
      salesRep: { select: { id: true, fullName: true } },
    },
    orderBy: { paidAt: "asc" },
  });
}
