import { TrainingStatus } from "../generated/prisma/enums";

export const ENROLLMENT_CLOSED_MESSAGE = "Enrollment is closed because this training has started";

export function assertTrainingOpenForEnrollment(
  training: { status: TrainingStatus; scheduledAt: Date | null },
  now = new Date(),
) {
  if (training.status !== TrainingStatus.ACTIVE) {
    throw new Error("Training is not available for enrollment");
  }
  if (training.scheduledAt && training.scheduledAt <= now) {
    throw new Error(ENROLLMENT_CLOSED_MESSAGE);
  }
}

export function canConfirmPaymentAfterStart(
  scheduledAt: Date | null,
  reservationExpiresAt: Date | null,
  intentCreatedAt: Date,
  paidAt: Date,
) {
  if (!scheduledAt || paidAt < scheduledAt) return true;
  return intentCreatedAt < scheduledAt &&
    !!reservationExpiresAt && paidAt <= reservationExpiresAt;
}
