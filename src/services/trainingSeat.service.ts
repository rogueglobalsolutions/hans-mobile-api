import {
  EnrollmentStatus,
  EnrollmentType,
  PaymentStatus,
  TrainingRequestStatus,
  TrainingRequestType,
} from "../generated/prisma/enums";

export async function countOccupiedTraineeSeats(
  tx: any,
  trainingId: string,
  now = new Date(),
  excluding: { enrollmentId?: string; requestId?: string } = {},
) {
  const [enrollments, holds] = await Promise.all([
    tx.enrollment.count({
      where: {
        trainingId,
        type: EnrollmentType.ENROLLEE,
        status: EnrollmentStatus.ACTIVE,
        ...(excluding.enrollmentId && { id: { not: excluding.enrollmentId } }),
        OR: [
          { paymentStatus: { in: [PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED] } },
          { paymentStatus: PaymentStatus.PENDING, reservationExpiresAt: { gt: now } },
        ],
      },
    }),
    countHeldTraineeSeats(tx, trainingId, excluding.requestId),
  ]);
  return enrollments + holds;
}

export async function countHeldTraineeSeats(tx: any, trainingId: string, excludingRequestId?: string) {
  return tx.trainingChangeRequest.count({
    where: {
      requestedTrainingId: trainingId,
      type: TrainingRequestType.RESCHEDULE,
      status: { in: [TrainingRequestStatus.PENDING, TrainingRequestStatus.PAYMENT_REQUIRED] },
      ...(excludingRequestId && { id: { not: excludingRequestId } }),
      enrollment: {
        type: EnrollmentType.ENROLLEE,
        status: EnrollmentStatus.ACTIVE,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    },
  });
}
