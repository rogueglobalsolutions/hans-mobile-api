import prisma from "../config/prisma";
import { stripe, TRAINING_LEVEL_STRIPE_PRICES, OBSERVER_STRIPE_PRICE_ID } from "../config/stripe";
import {
  TrainingType, TrainingBrand, TrainingLevel, CreditTransactionType,
  TrainingStatus, EnrollmentType, PaymentStatus, EnrollmentAttendanceStatus,
} from "../generated/prisma/enums";
import { LearningFormat } from "../utils/trainingEnums";
import { sendTrainingCancellationEmail } from "./email.service";
import { TRAINING_LEVEL_PRICING } from "../utils/trainingEnums";
import { redeemDiscountCode } from "./discount.service";
import { getSubmittedApplication } from "./trainingApplication.service";

// ─── Types ────────────────────────────────────────────────────────────────────

type SubOption = { label: string; price: number; creditScore: number };

export interface CreateTrainingInput {
  type: TrainingType;
  brand: TrainingBrand;
  level: TrainingLevel;
  learningFormats: LearningFormat[];
  title: string;
  speaker: string;
  speakerIntro: string;
  speakerImagePath?: string;
  productsUsed?: string;
  areasCovered: string;
  description: string;
  backgroundImagePath?: string;
  location?: string;
  scheduledAt?: Date;
  price: number;
  creditScore: number;
  createdBy: string;
  subOptions?: SubOption[];
}

export interface UpdateTrainingInput {
  type?: TrainingType;
  brand?: TrainingBrand;
  level?: TrainingLevel;
  learningFormats?: LearningFormat[];
  title?: string;
  speaker?: string;
  speakerIntro?: string;
  speakerImagePath?: string;
  productsUsed?: string | null;
  areasCovered?: string;
  description?: string;
  backgroundImagePath?: string;
  location?: string;
  scheduledAt?: Date | null;
  price?: number;
  creditScore?: number;
  subOptions?: SubOption[];
}

const PREREQUISITE_LEVELS = new Set<TrainingLevel>([
  TrainingLevel.ADVANCED,
  TrainingLevel.PACKAGE_BUNDLE_1,
  TrainingLevel.PACKAGE_BUNDLE_2,
]);

const QUALIFYING_LEVELS = new Set<TrainingLevel>([
  TrainingLevel.MINT_LIFT_GROUP_TRAINING,
  TrainingLevel.SUPPLEMENTAL,
]);

const RESERVATION_WINDOW_MS = 15 * 60 * 1000;

export class ObserverConfirmationRequiredError extends Error {
  readonly code = "OBSERVER_CONFIRMATION_REQUIRED";

  constructor(readonly observerPriceUsd: number) {
    super("Training is currently full. Would you like to be an observer instead?");
    this.name = "ObserverConfirmationRequiredError";
  }
}

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
      speakerImagePath:    input.speakerImagePath ?? null,
      productsUsed:        input.productsUsed ?? null,
      areasCovered:        input.areasCovered,
      description:         input.description,
      backgroundImagePath: input.backgroundImagePath ?? null,
      location:            input.location ?? null,
      scheduledAt:         input.scheduledAt ?? null,
      price:               input.price,
      creditScore:         input.creditScore,
      createdBy:           input.createdBy,
      subOptions:          input.subOptions ? JSON.parse(JSON.stringify(input.subOptions)) : undefined,
    },
  });
}

export async function updateTraining(trainingId: string, input: UpdateTrainingInput) {
  const training = await prisma.training.findUnique({
    where: { id: trainingId },
  });
  if (!training) throw new Error("Training not found");

  const [enrollmentCount, applicationCount] = await Promise.all([
    prisma.enrollment.count({ where: { trainingId } }),
    prisma.trainingApplication.count({ where: { trainingId } }),
  ]);
  if (enrollmentCount > 0 || applicationCount > 0) {
    throw new Error("Training cannot be edited once it has applications or enrollments.");
  }

  let price = input.price;
  let creditScore = input.creditScore;
  if (input.level && input.level !== training.level) {
    const pricing = TRAINING_LEVEL_PRICING[input.level];
    price = pricing.price;
    creditScore = pricing.creditScore;
  }

  return prisma.training.update({
    where: { id: trainingId },
    data: {
      ...(input.type                !== undefined && { type: input.type }),
      ...(input.brand               !== undefined && { brand: input.brand }),
      ...(input.level               !== undefined && { level: input.level }),
      ...(input.learningFormats     !== undefined && { learningFormats: input.learningFormats }),
      ...(input.title               !== undefined && { title: input.title }),
      ...(input.speaker             !== undefined && { speaker: input.speaker }),
      ...(input.speakerIntro        !== undefined && { speakerIntro: input.speakerIntro }),
      ...(input.speakerImagePath    !== undefined && { speakerImagePath: input.speakerImagePath }),
      ...(input.areasCovered        !== undefined && { areasCovered: input.areasCovered }),
      ...(input.description         !== undefined && { description: input.description }),
      ...(input.location            !== undefined && { location: input.location }),
      ...(input.scheduledAt         !== undefined && { scheduledAt: input.scheduledAt }),
      ...(input.backgroundImagePath !== undefined && { backgroundImagePath: input.backgroundImagePath }),
      ...(input.productsUsed        !== undefined && { productsUsed: input.productsUsed }),
      ...(price                     !== undefined && { price }),
      ...(creditScore               !== undefined && { creditScore }),
      ...(input.subOptions          !== undefined && { subOptions: input.subOptions ? JSON.parse(JSON.stringify(input.subOptions)) : undefined }),
    },
  });
}

export async function deleteTraining(trainingId: string) {
  const training = await prisma.training.findUnique({
    where: { id: trainingId },
    select: { id: true },
  });
  if (!training) throw new Error("Training not found");

  const [enrollmentCount, applicationCount] = await Promise.all([
    prisma.enrollment.count({ where: { trainingId } }),
    prisma.trainingApplication.count({ where: { trainingId } }),
  ]);
  if (enrollmentCount > 0 || applicationCount > 0) {
    throw new Error("Training cannot be deleted once it has applications or enrollments. Cancel it instead.");
  }

  await prisma.training.delete({ where: { id: trainingId } });
  return { message: "Training deleted successfully" };
}

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
      speakerImagePath:    true,
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
      subOptions:          true,
      _count: {
        select: { enrollments: true, applications: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return trainings;
}

export async function getTrainingById(trainingId: string, requestingUserId?: string) {
  const training = await prisma.training.findUnique({
    where: { id: trainingId },
    include: { _count: { select: { enrollments: true, applications: true } } },
  });

  if (!training) throw new Error("Training not found");

  const now = new Date();
  const enrolleeCount = await prisma.enrollment.count({
    where: { trainingId, type: EnrollmentType.ENROLLEE, OR: [
      { paymentStatus: PaymentStatus.COMPLETED },
      { paymentStatus: PaymentStatus.PENDING, reservationExpiresAt: { gt: now } },
    ] },
  });
  const observerCount = await prisma.enrollment.count({
    where: { trainingId, type: EnrollmentType.OBSERVER, OR: [
      { paymentStatus: PaymentStatus.COMPLETED },
      { paymentStatus: PaymentStatus.PENDING, reservationExpiresAt: { gt: now } },
    ] },
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

  let meetsPrerequisite = true;
  if (requestingUserId && PREREQUISITE_LEVELS.has(training.level as TrainingLevel)) {
    const hasPrereq = await prisma.enrollment.findFirst({
      where: {
        userId: requestingUserId,
        paymentStatus: PaymentStatus.COMPLETED,
        attendanceStatus: EnrollmentAttendanceStatus.COMPLETED,
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

async function cleanupExpiredReservations(trainingId: string) {
  const expired = await prisma.enrollment.findMany({
    where: {
      trainingId,
      paymentStatus: PaymentStatus.PENDING,
      reservationExpiresAt: { lte: new Date() },
    },
  });
  for (const enrollment of expired) {
    if (enrollment.stripePaymentIntentId) {
      try {
        const intent = await stripe.paymentIntents.retrieve(enrollment.stripePaymentIntentId);
        if (intent.status !== "succeeded" && intent.status !== "canceled") {
          await stripe.paymentIntents.cancel(intent.id);
        }
      } catch (error) {
        console.error("Failed to cancel expired training PaymentIntent:", error);
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: { id: enrollment.id, paymentStatus: PaymentStatus.PENDING },
        data: { paymentStatus: PaymentStatus.FAILED, reservationExpiresAt: null },
      });
      await tx.enrollmentPaymentAttempt.updateMany({
        where: { enrollmentId: enrollment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      });
    });
  }
}

export async function initiateEnrollment(
  userId: string,
  trainingId: string,
  _salesRepId?: string,
  subOptionIndex?: number,
  discountCode?: string,
  requestedType: EnrollmentType = EnrollmentType.ENROLLEE,
) {
  await cleanupExpiredReservations(trainingId);
  const training = await prisma.training.findUnique({ where: { id: trainingId } });
  if (!training) throw new Error("Training not found");
  if (training.status !== TrainingStatus.ACTIVE) throw new Error("Training is not available for enrollment");

  const application = await getSubmittedApplication(userId, trainingId);
  if (!application) throw new Error("Submit the training application before payment");

  const reusable = await prisma.enrollment.findUnique({
    where: { userId_trainingId: { userId, trainingId } },
  });
  if (
    reusable?.paymentStatus === PaymentStatus.PENDING &&
    reusable.reservationExpiresAt && reusable.reservationExpiresAt > new Date() &&
    reusable.stripePaymentIntentId
  ) {
    const intent = await stripe.paymentIntents.retrieve(reusable.stripePaymentIntentId);
    if (intent.status === "succeeded") {
      await confirmEnrollmentPayment(intent.id, userId);
      throw new Error("Already enrolled in this training");
    }
    if (intent.status !== "canceled" && reusable.type === requestedType) {
      return {
        clientSecret: intent.client_secret!,
        paymentIntentId: intent.id,
        enrollmentType: reusable.type,
        amountUsd: reusable.paidAmount ?? intent.amount / 100,
      };
    }
    if (intent.status === "canceled" || reusable.type !== requestedType) {
      await failEnrollment(intent.id, userId);
    }
  }

  if (PREREQUISITE_LEVELS.has(training.level)) {
    const hasPrerequisite = await prisma.enrollment.findFirst({
      where: {
        userId,
        paymentStatus: PaymentStatus.COMPLETED,
        attendanceStatus: EnrollmentAttendanceStatus.COMPLETED,
        training: { level: { in: Array.from(QUALIFYING_LEVELS) as TrainingLevel[] } },
      },
    });
    if (!hasPrerequisite) {
      throw new Error("You must complete a Mint Lift Group Training or Supplemental training first");
    }
  }

  const standardPriceId = TRAINING_LEVEL_STRIPE_PRICES[training.level];
  const standardPrice = await stripe.prices.retrieve(standardPriceId);
  if (!standardPrice.active || standardPrice.currency.toLowerCase() !== "usd" ||
      standardPrice.type !== "one_time" || standardPrice.unit_amount == null) {
    throw new Error(`Stripe price is not valid: ${standardPriceId}`);
  }

  let enrolleeAmountCents = standardPrice.unit_amount;
  let enrolleeCreditScore = training.creditScore;
  const subOptions = training.subOptions as SubOption[] | null;
  if (subOptions?.length && subOptionIndex !== undefined && subOptionIndex >= 0 && subOptionIndex < subOptions.length) {
    enrolleeAmountCents = subOptions[subOptionIndex].price * 100;
    enrolleeCreditScore = subOptions[subOptionIndex].creditScore;
  }

  if (discountCode) {
    const discount = await prisma.discountCode.findUnique({ where: { code: discountCode.toUpperCase() } });
    if (discount?.isActive && (!discount.expiresAt || new Date() < discount.expiresAt) &&
        (discount.maxUses === null || discount.usedCount < discount.maxUses) &&
        (discount.applicableTo === "TRAINING" || discount.applicableTo === "BOTH")) {
      enrolleeAmountCents = discount.type === "FIXED"
        ? Math.max(0, enrolleeAmountCents - discount.value * 100)
        : Math.max(0, Math.round(enrolleeAmountCents * (1 - discount.value / 100)));
    }
  }

  const observerPrice = await stripe.prices.retrieve(OBSERVER_STRIPE_PRICE_ID);
  if (!observerPrice.active || observerPrice.currency.toLowerCase() !== "usd" ||
      observerPrice.type !== "one_time" || observerPrice.unit_amount == null) {
    throw new Error("Observer checkout is not configured");
  }

  const reservationExpiresAt = new Date(Date.now() + RESERVATION_WINDOW_MS);
  const reservation = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${trainingId}))`;
    const now = new Date();
    const [enrolleeCount, observerCount] = await Promise.all([
      tx.enrollment.count({
        where: { trainingId, type: EnrollmentType.ENROLLEE, OR: [
          { paymentStatus: PaymentStatus.COMPLETED },
          { paymentStatus: PaymentStatus.PENDING, reservationExpiresAt: { gt: now } },
        ] },
      }),
      tx.enrollment.count({
        where: { trainingId, type: EnrollmentType.OBSERVER, OR: [
          { paymentStatus: PaymentStatus.COMPLETED },
          { paymentStatus: PaymentStatus.PENDING, reservationExpiresAt: { gt: now } },
        ] },
      }),
    ]);
    const existing = await tx.enrollment.findUnique({
      where: { userId_trainingId: { userId, trainingId } },
    });
    if (existing?.paymentStatus === PaymentStatus.COMPLETED) throw new Error("Already enrolled in this training");
    if (
      existing?.paymentStatus === PaymentStatus.PENDING &&
      existing.reservationExpiresAt &&
      existing.reservationExpiresAt > now
    ) {
      throw new Error("Payment setup is already in progress. Please wait a moment and try again.");
    }

    let type: EnrollmentType;
    if (requestedType === EnrollmentType.ENROLLEE) {
      if (enrolleeCount < training.maxEnrollees) {
        type = EnrollmentType.ENROLLEE;
      } else if (observerCount < training.maxObservers) {
        throw new ObserverConfirmationRequiredError(observerPrice.unit_amount! / 100);
      } else {
        throw new Error("Training is full");
      }
    } else {
      if (enrolleeCount < training.maxEnrollees) {
        throw new Error("Observer enrollment is only available when enrollee seats are full");
      }
      if (observerCount >= training.maxObservers) throw new Error("Training is full");
      type = EnrollmentType.OBSERVER;
    }

    const amountCents = type === EnrollmentType.OBSERVER ? observerPrice.unit_amount! : enrolleeAmountCents;
    const creditScore = type === EnrollmentType.OBSERVER ? 0 : enrolleeCreditScore;
    const enrollment = await tx.enrollment.upsert({
      where: { userId_trainingId: { userId, trainingId } },
      create: {
        userId, trainingId, type, salesRepId: application.salesRepId,
        paymentStatus: PaymentStatus.PENDING, paidAmount: amountCents / 100, reservationExpiresAt,
      },
      update: {
        type, salesRepId: application.salesRepId, paymentStatus: PaymentStatus.PENDING,
        paidAmount: amountCents / 100, reservationExpiresAt, stripeRefundId: null, refundedAt: null,
      },
    });
    return { enrollment, type, amountCents, creditScore };
  });

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: reservation.amountCents,
      currency: "usd",
      metadata: {
        trainingId, userId, enrollmentId: reservation.enrollment.id,
        enrollmentType: reservation.type, salesRepId: application.salesRepId ?? "",
        creditScore: reservation.creditScore.toString(), discountCode: discountCode ?? "",
      },
      payment_method_types: ["card"],
    });
    await prisma.$transaction([
      prisma.enrollment.update({
        where: { id: reservation.enrollment.id },
        data: { stripePaymentIntentId: paymentIntent.id },
      }),
      prisma.enrollmentPaymentAttempt.create({
        data: { enrollmentId: reservation.enrollment.id, stripePaymentIntentId: paymentIntent.id },
      }),
    ]);
  } catch (error) {
    await prisma.enrollment.updateMany({
      where: { id: reservation.enrollment.id, paymentStatus: PaymentStatus.PENDING },
      data: { paymentStatus: PaymentStatus.FAILED, reservationExpiresAt: null },
    });
    throw error;
  }

  return {
    clientSecret: paymentIntent.client_secret!, paymentIntentId: paymentIntent.id,
    enrollmentType: reservation.type, amountUsd: reservation.amountCents / 100,
  };
}

export async function confirmEnrollmentPayment(paymentIntentId: string, requestingUserId?: string) {
  const attempt = await prisma.enrollmentPaymentAttempt.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { enrollment: { include: { training: true, user: true } } },
  });
  const enrollment = attempt?.enrollment ?? await prisma.enrollment.findFirst({
    where: { stripePaymentIntentId: paymentIntentId }, include: { training: true, user: true },
  });
  if (!enrollment || (requestingUserId && enrollment.userId !== requestingUserId)) {
    throw new Error("Enrollment not found");
  }
  if (enrollment.paymentStatus === PaymentStatus.COMPLETED) {
    return { message: "Already confirmed", alreadyConfirmed: true };
  }
  if (enrollment.paymentStatus === PaymentStatus.REFUNDED) {
    return { message: "Payment was refunded", alreadyConfirmed: true };
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== "succeeded") throw new Error("Payment has not succeeded");
  if (paymentIntent.currency.toLowerCase() !== "usd" ||
      paymentIntent.amount_received !== Math.round((enrollment.paidAmount ?? 0) * 100)) {
    throw new Error("Payment amount does not match enrollment");
  }

  const creditScore = paymentIntent.metadata?.creditScore
    ? parseInt(paymentIntent.metadata.creditScore, 10)
    : enrollment.training.creditScore;
  const finalized = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${enrollment.trainingId}))`;
    const now = new Date();
    const occupied = await tx.enrollment.count({
      where: { trainingId: enrollment.trainingId, type: enrollment.type, id: { not: enrollment.id }, OR: [
        { paymentStatus: PaymentStatus.COMPLETED },
        { paymentStatus: PaymentStatus.PENDING, reservationExpiresAt: { gt: now } },
      ] },
    });
    const capacity = enrollment.type === EnrollmentType.ENROLLEE
      ? enrollment.training.maxEnrollees : enrollment.training.maxObservers;
    if (enrollment.training.status !== TrainingStatus.ACTIVE || occupied >= capacity) return "NO_CAPACITY" as const;

    const claimed = await tx.enrollment.updateMany({
      where: { id: enrollment.id, paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] } },
      data: { paymentStatus: PaymentStatus.COMPLETED, paidAt: now, reservationExpiresAt: null },
    });
    if (claimed.count === 0) return "NOT_CLAIMED" as const;
    if (attempt) {
      await tx.enrollmentPaymentAttempt.update({
        where: { id: attempt.id }, data: { status: PaymentStatus.COMPLETED },
      });
    }
    if (enrollment.type === EnrollmentType.ENROLLEE && creditScore > 0) {
      await tx.creditTransaction.create({
        data: { userId: enrollment.userId, type: CreditTransactionType.EARNED, amount: creditScore,
          description: `Enrolled in ${enrollment.training.title}`, referenceId: enrollment.trainingId },
      });
      await tx.user.update({ where: { id: enrollment.userId }, data: { creditBalance: { increment: creditScore } } });
    }
    return "COMPLETED" as const;
  });

  if (finalized === "NO_CAPACITY") {
    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `expired-training-reservation-${paymentIntentId}` },
    );
    await prisma.$transaction(async (tx) => {
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { paymentStatus: PaymentStatus.REFUNDED, stripeRefundId: refund.id,
          refundedAt: new Date(), reservationExpiresAt: null },
      });
      if (attempt) await tx.enrollmentPaymentAttempt.update({
        where: { id: attempt.id }, data: { status: PaymentStatus.REFUNDED },
      });
    });
    throw new Error("The seat reservation expired and the payment was refunded");
  }
  if (finalized === "NOT_CLAIMED") {
    const current = await prisma.enrollment.findUnique({ where: { id: enrollment.id } });
    if (current?.paymentStatus === PaymentStatus.COMPLETED) {
      return { message: "Already confirmed", alreadyConfirmed: true };
    }
    throw new Error("Enrollment payment could not be finalized");
  }

  const redeemedCode = paymentIntent.metadata?.discountCode;
  if (redeemedCode) {
    try { await redeemDiscountCode(redeemedCode); }
    catch (error) { console.error("Failed to record discount code redemption:", error); }
  }
  try {
    const { sendEnrollmentConfirmationEmail } = await import("./email.service");
    await sendEnrollmentConfirmationEmail({
      to: enrollment.user.email, fullName: enrollment.user.fullName,
      training: { title: enrollment.training.title, scheduledAt: enrollment.training.scheduledAt as Date,
        location: enrollment.training.location || "", speaker: enrollment.training.speaker || "",
        level: enrollment.training.level },
      enrollmentType: enrollment.type as "ENROLLEE" | "OBSERVER",
    });
  } catch (error) { console.error("Failed to send enrollment confirmation email:", error); }
  return { message: "Enrollment confirmed", alreadyConfirmed: false };
}

export async function failEnrollment(paymentIntentId: string, requestingUserId?: string) {
  const attempt = await prisma.enrollmentPaymentAttempt.findUnique({
    where: { stripePaymentIntentId: paymentIntentId }, include: { enrollment: true },
  });
  const enrollment = attempt?.enrollment ?? await prisma.enrollment.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (!enrollment) return;
  if (requestingUserId && enrollment.userId !== requestingUserId) throw new Error("Enrollment not found");
  if (enrollment.paymentStatus === PaymentStatus.COMPLETED) return;

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status === "succeeded") return confirmEnrollmentPayment(paymentIntentId, requestingUserId);
  if (paymentIntent.status !== "canceled") await stripe.paymentIntents.cancel(paymentIntentId);

  await prisma.$transaction(async (tx) => {
    if (attempt) await tx.enrollmentPaymentAttempt.updateMany({
      where: { id: attempt.id, status: PaymentStatus.PENDING }, data: { status: PaymentStatus.FAILED },
    });
    await tx.enrollment.updateMany({
      where: { id: enrollment.id, stripePaymentIntentId: paymentIntentId, paymentStatus: PaymentStatus.PENDING },
      data: { paymentStatus: PaymentStatus.FAILED, reservationExpiresAt: null },
    });
  });
}

export async function cancelTraining(trainingId: string, adminId: string) {
  const training = await prisma.training.findUnique({
    where: { id: trainingId },
    include: { enrollments: { include: { user: true, paymentAttempts: true } } },
  });
  if (!training) throw new Error("Training not found");
  if (training.status !== TrainingStatus.ACTIVE) throw new Error("Training is already cancelled or completed");

  const refunded: typeof training.enrollments = [];
  for (const enrollment of training.enrollments) {
    if (enrollment.paymentStatus === PaymentStatus.PENDING) {
      for (const attempt of enrollment.paymentAttempts.filter((item) => item.status === PaymentStatus.PENDING)) {
        const intent = await stripe.paymentIntents.retrieve(attempt.stripePaymentIntentId);
        if (intent.status === "succeeded") {
          throw new Error(`Payment is currently completing for ${enrollment.user.fullName}. Retry cancellation shortly.`);
        }
        if (intent.status !== "canceled") await stripe.paymentIntents.cancel(intent.id);
      }
      await prisma.$transaction([
        prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { paymentStatus: PaymentStatus.FAILED, reservationExpiresAt: null },
        }),
        prisma.enrollmentPaymentAttempt.updateMany({
          where: { enrollmentId: enrollment.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.FAILED },
        }),
      ]);
      continue;
    }

    if (enrollment.paymentStatus !== PaymentStatus.COMPLETED) continue;
    if (!enrollment.stripePaymentIntentId) {
      throw new Error(`No payment found for ${enrollment.user.fullName}`);
    }
    const refund = await stripe.refunds.create(
      { payment_intent: enrollment.stripePaymentIntentId },
      { idempotencyKey: `cancel-training-${trainingId}-${enrollment.id}` },
    );
    await prisma.$transaction([
      prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { paymentStatus: PaymentStatus.REFUNDED, stripeRefundId: refund.id,
          refundedAt: new Date(), reservationExpiresAt: null },
      }),
      prisma.enrollmentPaymentAttempt.updateMany({
        where: { enrollmentId: enrollment.id, status: PaymentStatus.COMPLETED },
        data: { status: PaymentStatus.REFUNDED },
      }),
    ]);
    refunded.push(enrollment);
  }

  await prisma.training.update({
    where: { id: trainingId },
    data: { status: TrainingStatus.CANCELLED, cancelledAt: new Date(), cancelledBy: adminId },
  });

  for (const enrollment of refunded) {
    try {
      await sendTrainingCancellationEmail(
        enrollment.user.email, enrollment.user.fullName, training.title, enrollment.paidAmount ?? 0,
      );
    } catch (error) {
      console.error("Failed to send training cancellation email:", error);
    }
  }

  return {
    message: refunded.length > 0
      ? `Training cancelled and ${refunded.length} payment${refunded.length === 1 ? "" : "s"} refunded`
      : "Training cancelled",
    refundedCount: refunded.length,
  };
}

export async function getTrainingEnrollees(trainingId: string) {
  const [enrollments, applications] = await Promise.all([
    prisma.enrollment.findMany({
      where: { trainingId, paymentStatus: PaymentStatus.COMPLETED },
      include: {
        user:     { select: { id: true, fullName: true, email: true, phoneNumber: true } },
        salesRep: { select: { id: true, fullName: true } },
      },
      orderBy: { paidAt: "asc" },
    }),
    prisma.trainingApplication.findMany({ where: { trainingId } }),
  ]);
  const applicationsByUser = new Map(applications.map((application) => [application.userId, application]));
  return enrollments.map((enrollment) => ({
    ...enrollment,
    application: applicationsByUser.get(enrollment.userId) ?? null,
  }));
}

export async function markEnrollmentCompleted(trainingId: string, enrollmentId: string, adminId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, trainingId },
    include: { training: true },
  });
  if (!enrollment) throw new Error("Enrollment not found");
  if (enrollment.type !== EnrollmentType.ENROLLEE) throw new Error("Observer attendance cannot satisfy prerequisites");
  if (enrollment.paymentStatus !== PaymentStatus.COMPLETED) throw new Error("Only paid enrollments can be completed");
  if (enrollment.training.status === TrainingStatus.CANCELLED) throw new Error("Cancelled training cannot be completed");
  if (enrollment.training.scheduledAt && enrollment.training.scheduledAt > new Date()) {
    throw new Error("Training cannot be completed before its scheduled time");
  }
  if (enrollment.attendanceStatus === EnrollmentAttendanceStatus.COMPLETED) return enrollment;

  return prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      attendanceStatus: EnrollmentAttendanceStatus.COMPLETED,
      completedAt: new Date(),
      completedBy: adminId,
    },
  });
}
