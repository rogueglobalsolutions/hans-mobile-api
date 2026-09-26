import prisma from "../config/prisma";
import { stripe } from "../config/stripe";
import {
  EnrollmentAttendanceStatus,
  EnrollmentStatus,
  EnrollmentType,
  PaymentStatus,
  TrainingRequestStatus,
  TrainingRequestType,
  TrainingStatus,
} from "../generated/prisma/enums";
import { sendTrainingLifecycleEmail } from "./email.service";
import { countOccupiedTraineeSeats } from "./trainingSeat.service";

const RESCHEDULE_FEE_USD = 500;
const unavailableReplacementMessages = new Set([
  "Replacement training is unavailable",
  "Replacement training must use the same training level",
  "Replacement training must be upcoming",
  "Replacement training is full",
]);

function countBusinessDays(from: Date, to: Date) {
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  let count = 0;
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (cursor <= end && day !== 0 && day !== 6) count += 1;
  }
  return count;
}

function requestInclude() {
  return {
    originalTraining: { select: { id: true, title: true, scheduledAt: true, endsAt: true } },
    requestedTraining: { select: { id: true, title: true, scheduledAt: true, endsAt: true } },
  } as const;
}

async function sendUpdate(
  enrollment: { user: { email: string; fullName: string }; training: { title: string } },
  subject: string,
  heading: string,
  message: string,
) {
  await sendTrainingLifecycleEmail({
    to: enrollment.user.email,
    fullName: enrollment.user.fullName,
    subject,
    heading,
    message,
    trainingTitle: enrollment.training.title,
  });
}

async function findActiveEnrollment(userId: string, trainingId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      trainingId,
      type: EnrollmentType.ENROLLEE,
      paymentStatus: PaymentStatus.COMPLETED,
      status: EnrollmentStatus.ACTIVE,
    },
    include: {
      training: true,
      user: { select: { email: true, fullName: true } },
      changeRequests: {
        where: { status: { in: [TrainingRequestStatus.PENDING, TrainingRequestStatus.PAYMENT_REQUIRED] } },
        include: requestInclude(),
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!enrollment) throw new Error("Active paid enrollment not found");
  return enrollment;
}

export async function getMyEnrollment(userId: string, trainingId: string) {
  return prisma.enrollment.findFirst({
    where: { userId, trainingId },
    include: {
      changeRequests: { include: requestInclude(), orderBy: { createdAt: "desc" } },
    },
  });
}

export async function requestCancellation(
  userId: string,
  trainingId: string,
  input: { reason?: string; emergencyDetails?: string; supportingDocumentPath?: string },
) {
  const enrollment = await findActiveEnrollment(userId, trainingId);
  if (!input.reason?.trim()) throw new Error("Cancellation reason is required");
  if (enrollment.attendanceStatus !== EnrollmentAttendanceStatus.PENDING) {
    throw new Error("Completed or no-show training cannot be cancelled");
  }
  const startDate = enrollment.training.scheduledAt ?? enrollment.training.endsAt;
  if (startDate && startDate <= new Date()) {
    throw new Error("Training has already started and can no longer be changed");
  }
  if (enrollment.changeRequests.length > 0) throw new Error("A training change request is already pending");

  const reason = input.reason.trim();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${enrollment.id}))`;
    const current = await tx.enrollment.findUnique({ where: { id: enrollment.id } });
    const openRequest = await tx.trainingChangeRequest.findFirst({
      where: {
        enrollmentId: enrollment.id,
        status: { in: [TrainingRequestStatus.PENDING, TrainingRequestStatus.PAYMENT_REQUIRED] },
      },
    });
    if (openRequest) throw new Error("A training change request is already pending");
    if (!current || current.trainingId !== trainingId || current.status !== EnrollmentStatus.ACTIVE ||
        current.paymentStatus !== PaymentStatus.COMPLETED) {
      throw new Error("Active paid enrollment not found");
    }
    return tx.trainingChangeRequest.create({
      data: {
        enrollmentId: enrollment.id,
        originalTrainingId: enrollment.trainingId,
        type: TrainingRequestType.CANCELLATION,
        reason,
        emergencyDetails: input.emergencyDetails?.trim() || null,
        supportingDocumentPath: input.supportingDocumentPath ?? null,
      },
      include: requestInclude(),
    });
  });
}

export async function requestReschedule(
  userId: string,
  trainingId: string,
  input: { requestedTrainingId?: string; reason?: string },
) {
  const enrollment = await findActiveEnrollment(userId, trainingId);
  if (!input.reason?.trim()) throw new Error("Reschedule reason is required");
  const reason = input.reason.trim();
  if (!input.requestedTrainingId) throw new Error("A replacement training is required");
  if (input.requestedTrainingId === trainingId) throw new Error("Select a different training");
  if (enrollment.changeRequests.length > 0) throw new Error("A training change request is already pending");
  if (!enrollment.training.scheduledAt ||
      countBusinessDays(new Date(), enrollment.training.scheduledAt) < 10) {
    throw new Error("Reschedule requests must be submitted at least 10 business days before training");
  }

  const target = await prisma.training.findUnique({ where: { id: input.requestedTrainingId } });
  if (!target || target.status !== TrainingStatus.ACTIVE) throw new Error("Replacement training is unavailable");
  if (target.level !== enrollment.training.level) {
    throw new Error("Replacement training must use the same training level");
  }
  if (!target.scheduledAt || target.scheduledAt <= new Date()) {
    throw new Error("Replacement training must be upcoming");
  }
  const existingTarget = await prisma.enrollment.findUnique({
    where: { userId_trainingId: { userId, trainingId: target.id } },
  });
  if (existingTarget) throw new Error("You already have an enrollment for the replacement training");
  const existingTargetApplication = await prisma.trainingApplication.findUnique({
    where: { userId_trainingId: { userId, trainingId: target.id } },
  });
  if (existingTargetApplication) {
    throw new Error("You already have an application for the replacement training");
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${enrollment.id}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${target.id}))`;
    const currentTarget = await tx.training.findUnique({ where: { id: target.id } });
    const currentEnrollment = await tx.enrollment.findUnique({ where: { id: enrollment.id } });
    const openRequest = await tx.trainingChangeRequest.findFirst({
      where: {
        enrollmentId: enrollment.id,
        status: { in: [TrainingRequestStatus.PENDING, TrainingRequestStatus.PAYMENT_REQUIRED] },
      },
    });
    if (openRequest) throw new Error("A training change request is already pending");
    if (!currentEnrollment || currentEnrollment.trainingId !== trainingId ||
        currentEnrollment.status !== EnrollmentStatus.ACTIVE ||
        currentEnrollment.paymentStatus !== PaymentStatus.COMPLETED) {
      throw new Error("Active paid enrollment not found");
    }
    if (!currentTarget || currentTarget.status !== TrainingStatus.ACTIVE) {
      throw new Error("Replacement training is unavailable");
    }
    if (currentTarget.level !== enrollment.training.level) {
      throw new Error("Replacement training must use the same training level");
    }
    if (!currentTarget.scheduledAt || currentTarget.scheduledAt <= new Date()) {
      throw new Error("Replacement training must be upcoming");
    }
    const occupied = await countOccupiedTraineeSeats(tx, target.id);
    if (occupied >= currentTarget.maxEnrollees) throw new Error("Replacement training is full");
    return tx.trainingChangeRequest.create({
      data: {
        enrollmentId: enrollment.id,
        originalTrainingId: enrollment.trainingId,
        requestedTrainingId: target.id,
        type: TrainingRequestType.RESCHEDULE,
        reason,
        feeAmount: enrollment.rescheduleCount === 0 ? 0 : RESCHEDULE_FEE_USD,
      },
      include: requestInclude(),
    });
  });
}

async function finalizeReschedule(requestId: string, adminId?: string) {
  const request = await prisma.trainingChangeRequest.findUnique({
    where: { id: requestId },
    include: {
      enrollment: {
        include: {
          user: { select: { email: true, fullName: true } },
          training: true,
        },
      },
      requestedTraining: true,
    },
  });
  if (!request || request.type !== TrainingRequestType.RESCHEDULE || !request.requestedTraining) {
    throw new Error("Reschedule request not found");
  }
  if (request.status === TrainingRequestStatus.APPROVED) return request;
  if (request.feeAmount > 0 && request.feePaymentStatus !== PaymentStatus.COMPLETED) {
    throw new Error("Reschedule fee must be paid before approval is completed");
  }

  const moved = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${request.requestedTrainingId!}))`;
    const now = new Date();
    const [currentRequest, currentEnrollment, target, existingTargetEnrollment, existingTargetApplication] = await Promise.all([
      tx.trainingChangeRequest.findUnique({ where: { id: request.id } }),
      tx.enrollment.findUnique({ where: { id: request.enrollmentId } }),
      tx.training.findUnique({ where: { id: request.requestedTrainingId! } }),
      tx.enrollment.findUnique({
        where: {
          userId_trainingId: {
            userId: request.enrollment.userId,
            trainingId: request.requestedTrainingId!,
          },
        },
      }),
      tx.trainingApplication.findUnique({
        where: {
          userId_trainingId: {
            userId: request.enrollment.userId,
            trainingId: request.requestedTrainingId!,
          },
        },
      }),
    ]);
    if (currentRequest?.status === TrainingRequestStatus.APPROVED) return false;
    if (currentRequest?.status !== TrainingRequestStatus.PENDING &&
        currentRequest?.status !== TrainingRequestStatus.PAYMENT_REQUIRED) {
      throw new Error("Reschedule request not found");
    }
    if (!currentEnrollment || currentEnrollment.trainingId !== request.originalTrainingId ||
        currentEnrollment.status !== EnrollmentStatus.ACTIVE ||
        currentEnrollment.paymentStatus !== PaymentStatus.COMPLETED) {
      throw new Error("Active paid enrollment not found");
    }
    if (!target || target.status !== TrainingStatus.ACTIVE) {
      throw new Error("Replacement training is unavailable");
    }
    if (target.level !== request.enrollment.training.level) {
      throw new Error("Replacement training must use the same training level");
    }
    if (!target.scheduledAt || target.scheduledAt <= now) {
      throw new Error("Replacement training must be upcoming");
    }
    if (existingTargetEnrollment || existingTargetApplication) {
      throw new Error("You already have a registration for the replacement training");
    }
    const occupied = await countOccupiedTraineeSeats(tx, request.requestedTrainingId!, now, {
      requestId: request.id,
    });
    if (occupied >= target.maxEnrollees) {
      throw new Error("Replacement training is full");
    }
    await tx.enrollment.update({
      where: { id: request.enrollmentId },
      data: {
        trainingId: request.requestedTrainingId!,
        rescheduleCount: { increment: 1 },
        status: EnrollmentStatus.ACTIVE,
      },
    });
    await tx.trainingApplication.updateMany({
      where: {
        userId: request.enrollment.userId,
        trainingId: request.originalTrainingId,
      },
      data: { trainingId: request.requestedTrainingId! },
    });
    const reviewed = await tx.trainingChangeRequest.updateMany({
      where: {
        id: request.id,
        status: { in: [TrainingRequestStatus.PENDING, TrainingRequestStatus.PAYMENT_REQUIRED] },
      },
      data: {
        status: TrainingRequestStatus.APPROVED,
        reviewedById: adminId ?? request.reviewedById,
        reviewedAt: request.reviewedAt ?? new Date(),
      },
    });
    if (reviewed.count !== 1) throw new Error("Training change request was already reviewed");
    return true;
  });

  if (!moved) {
    return prisma.trainingChangeRequest.findUnique({ where: { id: request.id }, include: requestInclude() });
  }
  await sendUpdate(
    request.enrollment,
    "Training Reschedule Confirmed",
    "Reschedule Confirmed",
    `Your enrollment has been moved to ${request.requestedTraining.title}.`,
  );
  return prisma.trainingChangeRequest.findUnique({
    where: { id: request.id },
    include: requestInclude(),
  });
}

export async function reviewTrainingRequest(
  adminId: string,
  requestId: string,
  input: { approve: boolean; adminNote?: string; waivePenalty?: boolean },
) {
  const request = await prisma.trainingChangeRequest.findUnique({
    where: { id: requestId },
    include: {
      enrollment: {
        include: {
          user: { select: { email: true, fullName: true } },
          training: true,
        },
      },
      requestedTraining: true,
    },
  });
  if (!request) throw new Error("Training change request not found");
  if (request.status !== TrainingRequestStatus.PENDING) throw new Error("Training change request was already reviewed");

  if (!input.approve) {
    const declined = await prisma.trainingChangeRequest.update({
      where: { id: request.id },
      data: {
        status: TrainingRequestStatus.DECLINED,
        adminNote: input.adminNote?.trim() || null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
      include: requestInclude(),
    });
    await sendUpdate(
      request.enrollment,
      "Training Request Update",
      "Request Not Approved",
      input.adminNote?.trim() || "Your training change request was not approved.",
    );
    return declined;
  }

  if (request.type === TrainingRequestType.RESCHEDULE) {
    if (request.feeAmount > 0) {
      const paymentRequired = await prisma.trainingChangeRequest.update({
        where: { id: request.id },
        data: {
          status: TrainingRequestStatus.PAYMENT_REQUIRED,
          feePaymentStatus: PaymentStatus.PENDING,
          adminNote: input.adminNote?.trim() || null,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
        include: requestInclude(),
      });
      await sendUpdate(
        request.enrollment,
        "Reschedule Fee Required",
        "Reschedule Approved",
        `Your reschedule was approved. A $${request.feeAmount} fee must be paid before the change is finalized.`,
      );
      return paymentRequired;
    }
    return finalizeReschedule(request.id, adminId);
  }

  const trainingDate = request.enrollment.training.scheduledAt;
  if (!trainingDate) throw new Error("Training date is not configured");
  const early = countBusinessDays(request.createdAt, trainingDate) >= 10;
  if (!early && input.waivePenalty &&
      (!request.emergencyDetails?.trim() || !request.supportingDocumentPath)) {
    throw new Error("Emergency details and a supporting document are required to waive a late-cancellation penalty");
  }
  const fullRefund = early || Boolean(input.waivePenalty);
  const paidAmount = request.enrollment.paidAmount ?? 0;
  const policyPenalty = Math.round(
    (request.enrollment.trainingPriceAmount ?? request.enrollment.training.price) * 0.5,
  );
  const refundAmount = fullRefund ? paidAmount : Math.max(0, paidAmount - policyPenalty);
  const penaltyAmount = paidAmount - refundAmount;
  if (!request.enrollment.stripePaymentIntentId) throw new Error("Training payment was not found");

  const refund = refundAmount > 0
    ? await stripe.refunds.create(
        {
          payment_intent: request.enrollment.stripePaymentIntentId,
          amount: refundAmount * 100,
        },
        { idempotencyKey: `training-cancellation-${request.id}` },
      )
    : null;

  const approved = await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: request.enrollmentId },
      data: {
        status: EnrollmentStatus.CANCELLED,
        paymentStatus: fullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        stripeRefundId: refund?.id ?? null,
        refundedAt: refund ? new Date() : null,
        reservationExpiresAt: null,
      },
    });
    return tx.trainingChangeRequest.update({
      where: { id: request.id },
      data: {
        status: TrainingRequestStatus.APPROVED,
        refundAmount,
        penaltyAmount,
        emergencyWaived: Boolean(input.waivePenalty),
        stripeRefundId: refund?.id ?? null,
        adminNote: input.adminNote?.trim() || null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
      include: requestInclude(),
    });
  });
  await sendUpdate(
    request.enrollment,
    "Training Cancellation Confirmed",
    "Registration Cancelled",
    fullRefund
      ? `Your registration was cancelled and a full refund of $${refundAmount.toLocaleString("en-US")} was issued.`
      : `Your registration was cancelled. A $${penaltyAmount.toLocaleString("en-US")} late-cancellation fee was retained and $${refundAmount.toLocaleString("en-US")} was refunded.`,
  );
  return approved;
}

export async function createRescheduleFeeIntent(userId: string, requestId: string) {
  const request = await prisma.trainingChangeRequest.findFirst({
    where: {
      id: requestId,
      status: TrainingRequestStatus.PAYMENT_REQUIRED,
      enrollment: { userId },
    },
    include: { enrollment: { include: { user: { select: { email: true, fullName: true } }, training: true } } },
  });
  if (!request || request.type !== TrainingRequestType.RESCHEDULE) {
    throw new Error("Payable reschedule request not found");
  }
  const target = request.requestedTrainingId
    ? await prisma.training.findUnique({ where: { id: request.requestedTrainingId } })
    : null;
  const now = new Date();
  const occupied = target
    ? await countOccupiedTraineeSeats(prisma, target.id, now, { requestId: request.id })
    : 0;
  const unavailable = !target || target.status !== TrainingStatus.ACTIVE ||
    target.level !== request.enrollment.training.level ||
    !target.scheduledAt || target.scheduledAt <= now ||
    occupied >= target.maxEnrollees ||
    request.enrollment.status !== EnrollmentStatus.ACTIVE ||
    request.enrollment.paymentStatus !== PaymentStatus.COMPLETED;
  if (unavailable) {
    if (request.stripePaymentIntentId) {
      const existing = await stripe.paymentIntents.retrieve(request.stripePaymentIntentId);
      if (existing.status === "succeeded") {
        await confirmRescheduleFee(userId, request.id, existing.id);
        return { alreadyPaid: true };
      }
      if (existing.status === "processing") {
        throw new Error("Reschedule fee payment is processing");
      }
      if (existing.status !== "canceled") {
        try {
          await stripe.paymentIntents.cancel(existing.id);
        } catch (error) {
          const latest = await stripe.paymentIntents.retrieve(existing.id);
          if (latest.status === "succeeded") {
            await confirmRescheduleFee(userId, request.id, latest.id);
            return { alreadyPaid: true };
          }
          if (latest.status === "processing") {
            throw new Error("Reschedule fee payment is processing");
          }
          throw error;
        }
      }
    }
    const cancelled = await prisma.trainingChangeRequest.updateMany({
      where: { id: request.id, status: TrainingRequestStatus.PAYMENT_REQUIRED },
      data: {
        status: TrainingRequestStatus.CANCELLED,
        feePaymentStatus: PaymentStatus.FAILED,
        adminNote: "Replacement session became unavailable before the reschedule fee was paid",
      },
    });
    if (cancelled.count === 1) {
      await sendUpdate(
        request.enrollment,
        "Training Reschedule Update",
        "Replacement Session Unavailable",
        "Your selected replacement session is no longer available, so no reschedule fee was charged. Your registration was not moved.",
      );
    }
    throw new Error("Replacement training is unavailable");
  }
  if (request.stripePaymentIntentId) {
    const existing = await stripe.paymentIntents.retrieve(request.stripePaymentIntentId);
    if (existing.status === "succeeded") {
      await confirmRescheduleFee(userId, request.id, existing.id);
      return { alreadyPaid: true };
    }
    if (existing.status !== "canceled") {
      return { clientSecret: existing.client_secret, paymentIntentId: existing.id, amountUsd: request.feeAmount };
    }
  }
  const intent = await stripe.paymentIntents.create({
    amount: request.feeAmount * 100,
    currency: "usd",
    payment_method_types: ["card"],
    metadata: { kind: "training_reschedule_fee", requestId: request.id, userId },
  });
  await prisma.trainingChangeRequest.update({
    where: { id: request.id },
    data: { stripePaymentIntentId: intent.id, feePaymentStatus: PaymentStatus.PENDING },
  });
  return { clientSecret: intent.client_secret, paymentIntentId: intent.id, amountUsd: request.feeAmount };
}

async function refundUnavailableRescheduleFee(
  request: {
    id: string;
    feeAmount: number;
    enrollment: { user: { email: string; fullName: string }; training: { title: string } };
  },
  paymentIntentId: string,
): Promise<never> {
  const refund = await stripe.refunds.create(
    { payment_intent: paymentIntentId },
    { idempotencyKey: `unavailable-reschedule-${request.id}` },
  );
  const refunded = await prisma.trainingChangeRequest.updateMany({
    where: { id: request.id, status: TrainingRequestStatus.CANCELLED, feePaymentStatus: PaymentStatus.COMPLETED },
    data: { feePaymentStatus: PaymentStatus.REFUNDED, stripeRefundId: refund.id },
  });
  if (refunded.count === 1) {
    await sendUpdate(
      request.enrollment,
      "Training Reschedule Update",
      "Replacement Session Unavailable",
      `Your selected replacement session is no longer available. The $${request.feeAmount} reschedule fee was refunded; your original paid enrollment remains in place.`,
    );
  }
  throw new Error("Replacement training became unavailable and the reschedule fee was refunded");
}

export async function confirmRescheduleFee(userId: string, requestId: string, paymentIntentId: string) {
  const request = await prisma.trainingChangeRequest.findFirst({
    where: { id: requestId, stripePaymentIntentId: paymentIntentId, enrollment: { userId } },
    include: { enrollment: { include: { user: { select: { email: true, fullName: true } }, training: true } } },
  });
  if (!request) throw new Error("Reschedule payment not found");
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== "succeeded" || intent.amount_received !== request.feeAmount * 100) {
    throw new Error("Reschedule fee payment has not succeeded");
  }
  if (request.status === TrainingRequestStatus.CANCELLED && request.feePaymentStatus === PaymentStatus.REFUNDED) {
    throw new Error("Replacement training became unavailable and the reschedule fee was refunded");
  }
  if (request.status === TrainingRequestStatus.CANCELLED && request.feePaymentStatus === PaymentStatus.COMPLETED) {
    return refundUnavailableRescheduleFee(request, paymentIntentId);
  }
  if (request.status === TrainingRequestStatus.CANCELLED && request.feePaymentStatus !== PaymentStatus.COMPLETED) {
    throw new Error("Reschedule request not found");
  }
  if (request.status === TrainingRequestStatus.PAYMENT_REQUIRED) {
    await prisma.trainingChangeRequest.update({
      where: { id: request.id },
      data: { feePaymentStatus: PaymentStatus.COMPLETED },
    });
  }
  try {
    return await finalizeReschedule(request.id);
  } catch (error) {
    if (!(error instanceof Error) || !unavailableReplacementMessages.has(error.message)) throw error;

    const claimed = await prisma.trainingChangeRequest.updateMany({
      where: {
        id: request.id,
        status: TrainingRequestStatus.PAYMENT_REQUIRED,
        feePaymentStatus: PaymentStatus.COMPLETED,
      },
      data: {
        status: TrainingRequestStatus.CANCELLED,
        adminNote: "Replacement session became unavailable before the paid reschedule could be finalized",
      },
    });
    if (claimed.count === 0) {
      const current = await prisma.trainingChangeRequest.findUnique({ where: { id: request.id } });
      if (current?.status === TrainingRequestStatus.APPROVED) {
        return prisma.trainingChangeRequest.findUnique({ where: { id: request.id }, include: requestInclude() });
      }
      if (current?.status !== TrainingRequestStatus.CANCELLED || current.feePaymentStatus !== PaymentStatus.COMPLETED) {
        throw error;
      }
    }

    return refundUnavailableRescheduleFee(request, paymentIntentId);
  }
}

export async function markNoShow(adminId: string, trainingId: string, enrollmentId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, trainingId },
    include: { training: true, user: { select: { email: true, fullName: true } } },
  });
  if (!enrollment) throw new Error("Enrollment not found");
  if (enrollment.type !== EnrollmentType.ENROLLEE) throw new Error("Observer cannot be marked as a trainee no-show");
  if (enrollment.paymentStatus !== PaymentStatus.COMPLETED) throw new Error("Only paid enrollments can be marked no-show");
  const finalDate = enrollment.training.endsAt ?? enrollment.training.scheduledAt;
  if (finalDate && finalDate > new Date()) throw new Error("No-show cannot be recorded before the final session");
  if (enrollment.attendanceStatus !== EnrollmentAttendanceStatus.PENDING) {
    throw new Error("Attendance was already finalized");
  }
  const feeAmount = Math.round(
    (enrollment.trainingPriceAmount ?? enrollment.training.price) * 0.5,
  );
  const claimed = await prisma.enrollment.updateMany({
    where: {
      id: enrollment.id,
      status: EnrollmentStatus.ACTIVE,
      paymentStatus: PaymentStatus.COMPLETED,
      attendanceStatus: EnrollmentAttendanceStatus.PENDING,
    },
    data: {
      attendanceStatus: EnrollmentAttendanceStatus.NO_SHOW,
      status: EnrollmentStatus.CANCELLED,
      completedBy: adminId,
      noShowFeeAmount: feeAmount,
      noShowFeeStatus: feeAmount > 0 ? PaymentStatus.PENDING : PaymentStatus.COMPLETED,
    },
  });
  if (claimed.count !== 1) throw new Error("Attendance was already finalized");
  let automaticallyPaid = false;
  if (feeAmount > 0 && enrollment.stripePaymentIntentId) {
    try {
      const original = await stripe.paymentIntents.retrieve(enrollment.stripePaymentIntentId);
      const customerId = typeof original.customer === "string" ? original.customer : original.customer?.id;
      const paymentMethodId = typeof original.payment_method === "string"
        ? original.payment_method : original.payment_method?.id;
      if (original.setup_future_usage === "off_session" && customerId && paymentMethodId) {
        const intent = await stripe.paymentIntents.create(
          {
            amount: feeAmount * 100,
            currency: "usd",
            customer: customerId,
            payment_method: paymentMethodId,
            payment_method_types: ["card"],
            metadata: { kind: "training_no_show_fee", enrollmentId: enrollment.id, userId: enrollment.userId },
          },
          { idempotencyKey: `training-no-show-fee-${enrollment.id}` },
        );
        const reserved = await prisma.enrollment.updateMany({
          where: { id: enrollment.id, noShowStripePaymentIntentId: null },
          data: { noShowStripePaymentIntentId: intent.id },
        });
        if (reserved.count === 1) {
          try {
            const confirmed = await stripe.paymentIntents.confirm(intent.id, {
              off_session: true,
              payment_method: paymentMethodId,
            });
            automaticallyPaid = confirmed.status === "succeeded";
          } catch (error) {
            const current = await stripe.paymentIntents.retrieve(intent.id);
            automaticallyPaid = current.status === "succeeded";
            if (!automaticallyPaid) console.warn("No-show automatic charge needs MED action:", error);
          }
          if (automaticallyPaid) {
            await prisma.enrollment.updateMany({
              where: { id: enrollment.id, noShowStripePaymentIntentId: intent.id },
              data: { noShowFeeStatus: PaymentStatus.COMPLETED },
            });
          }
        }
      }
    } catch (error) {
      console.error("Unable to attempt automatic no-show charge:", error);
    }
  }
  const updated = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
  await sendUpdate(
    enrollment,
    "Training Attendance Update",
    "No-Show Recorded",
    `Your registration payment and product-credit eligibility were forfeited. ` +
      (updated.noShowFeeStatus === PaymentStatus.COMPLETED
        ? `The additional $${feeAmount.toLocaleString("en-US")} no-show fee was charged to your saved card.`
        : `The additional $${feeAmount.toLocaleString("en-US")} no-show fee could not be charged automatically. Please complete it securely in the app.`),
  );
  return updated;
}

export async function createNoShowFeeIntent(userId: string, enrollmentId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      userId,
      attendanceStatus: EnrollmentAttendanceStatus.NO_SHOW,
      noShowFeeStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
    },
  });
  if (!enrollment?.noShowFeeAmount) throw new Error("No-show fee not found");
  if (enrollment.noShowStripePaymentIntentId) {
    const existing = await stripe.paymentIntents.retrieve(enrollment.noShowStripePaymentIntentId);
    if (existing.status === "succeeded") {
      await confirmNoShowFee(userId, enrollmentId, existing.id);
      return { alreadyPaid: true };
    }
    if (existing.status === "processing") throw new Error("No-show fee payment is processing");
    if (existing.status === "requires_confirmation") {
      await stripe.paymentIntents.cancel(existing.id);
    } else if (existing.status !== "canceled") {
      return {
        clientSecret: existing.client_secret!,
        paymentIntentId: existing.id,
        amountUsd: enrollment.noShowFeeAmount,
      };
    }
  }
  const intent = await stripe.paymentIntents.create({
    amount: enrollment.noShowFeeAmount * 100,
    currency: "usd",
    payment_method_types: ["card"],
    metadata: { kind: "training_no_show_fee", enrollmentId: enrollment.id, userId },
  });
  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { noShowStripePaymentIntentId: intent.id, noShowFeeStatus: PaymentStatus.PENDING },
  });
  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    amountUsd: enrollment.noShowFeeAmount,
  };
}

export async function confirmNoShowFee(userId: string, enrollmentId: string, paymentIntentId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, userId, noShowStripePaymentIntentId: paymentIntentId },
  });
  if (!enrollment?.noShowFeeAmount) throw new Error("No-show payment not found");
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== "succeeded" || intent.amount_received !== enrollment.noShowFeeAmount * 100) {
    throw new Error("No-show fee payment has not succeeded");
  }
  return prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { noShowFeeStatus: PaymentStatus.COMPLETED },
  });
}

export async function failNoShowFee(paymentIntentId: string) {
  await prisma.enrollment.updateMany({
    where: {
      noShowStripePaymentIntentId: paymentIntentId,
      noShowFeeStatus: PaymentStatus.PENDING,
    },
    data: { noShowFeeStatus: PaymentStatus.FAILED },
  });
}

export async function enforceTrainingPaymentDeadlines() {
  const now = new Date();
  const requests = await prisma.trainingChangeRequest.findMany({
    where: {
      status: TrainingRequestStatus.PAYMENT_REQUIRED,
      feePaymentStatus: { not: PaymentStatus.COMPLETED },
    },
    include: {
      enrollment: {
        include: {
          user: { select: { email: true, fullName: true } },
          training: true,
        },
      },
      requestedTraining: true,
    },
  });

  for (const request of requests) {
    const deadlineTraining = request.requestedTraining ?? request.enrollment.training;
    if (!deadlineTraining.scheduledAt || countBusinessDays(now, deadlineTraining.scheduledAt) >= 10) continue;
    if (request.stripePaymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(request.stripePaymentIntentId);
      if (intent.status === "succeeded") {
        await confirmRescheduleFee(request.enrollment.userId, request.id, intent.id);
        continue;
      }
      if (intent.status === "processing") continue;
      if (intent.status !== "canceled") {
        try {
          await stripe.paymentIntents.cancel(intent.id);
        } catch (error) {
          const latest = await stripe.paymentIntents.retrieve(intent.id);
          if (latest.status === "succeeded") {
            await confirmRescheduleFee(request.enrollment.userId, request.id, latest.id);
            continue;
          }
          if (latest.status === "processing") continue;
          if (latest.status !== "canceled") throw error;
        }
      }
    }
    const paidAmount = request.enrollment.paidAmount ?? 0;
    const policyPenalty = Math.round(
      (request.enrollment.trainingPriceAmount ?? request.enrollment.training.price) * 0.5,
    );
    const refundAmount = Math.max(0, paidAmount - policyPenalty);
    if (refundAmount > 0 && !request.enrollment.stripePaymentIntentId) {
      console.error(`[trainingDeadline] Missing payment intent for enrollment ${request.enrollmentId}`);
      continue;
    }
    let refundId: string | null = null;
    if (refundAmount > 0) {
      const refund = await stripe.refunds.create(
        {
          payment_intent: request.enrollment.stripePaymentIntentId!,
          amount: refundAmount * 100,
        },
        { idempotencyKey: `training-deadline-${request.id}` },
      );
      refundId = refund.id;
    }
    const finalized = await prisma.$transaction(async (tx) => {
      const claimed = await tx.trainingChangeRequest.updateMany({
        where: { id: request.id, status: TrainingRequestStatus.PAYMENT_REQUIRED },
        data: {
          status: TrainingRequestStatus.CANCELLED,
          feePaymentStatus: PaymentStatus.FAILED,
          refundAmount: refundId ? refundAmount : 0,
          penaltyAmount: paidAmount - (refundId ? refundAmount : 0),
          stripeRefundId: refundId,
        },
      });
      if (claimed.count !== 1) return false;
      await tx.enrollment.update({
        where: { id: request.enrollmentId },
        data: {
          status: EnrollmentStatus.CANCELLED,
          paymentStatus: refundId ? PaymentStatus.PARTIALLY_REFUNDED : request.enrollment.paymentStatus,
          stripeRefundId: refundId,
          refundedAt: refundId ? new Date() : null,
        },
      });
      return true;
    });
    if (!finalized) continue;
    await sendUpdate(
      request.enrollment,
      "Training Registration Cancelled",
      "Payment Deadline Missed",
      refundId
        ? `Your registration was cancelled because the required fee was not paid at least 10 business days before training. $${refundAmount.toLocaleString("en-US")} was refunded and the 50% late-cancellation fee was retained.`
        : "Your registration was cancelled because the required fee was not paid at least 10 business days before training.",
    );
  }
}
