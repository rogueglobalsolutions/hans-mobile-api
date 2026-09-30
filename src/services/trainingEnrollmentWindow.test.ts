import assert from "node:assert/strict";
import test from "node:test";
import { TrainingStatus } from "../generated/prisma/enums";
import {
  assertTrainingOpenForEnrollment,
  canConfirmPaymentAfterStart,
  ENROLLMENT_CLOSED_MESSAGE,
} from "./trainingEnrollmentWindow";

const start = new Date("2026-10-01T12:00:00Z");

test("new enrollment closes exactly when the training starts", () => {
  const training = { status: TrainingStatus.ACTIVE, scheduledAt: start };
  assert.doesNotThrow(() => assertTrainingOpenForEnrollment(training, new Date("2026-10-01T11:59:59Z")));
  assert.throws(() => assertTrainingOpenForEnrollment(training, start), {
    message: ENROLLMENT_CLOSED_MESSAGE,
  });
  assert.throws(() => assertTrainingOpenForEnrollment(training, new Date("2026-10-02T00:00:00Z")));
});

test("inactive trainings remain unavailable before their start", () => {
  assert.throws(() => assertTrainingOpenForEnrollment({ status: TrainingStatus.CANCELLED, scheduledAt: start }));
});

test("a payment started before the session may finish within its seat hold", () => {
  const intentCreatedAt = new Date("2026-10-01T11:55:00Z");
  const holdExpiresAt = new Date("2026-10-01T12:10:00Z");
  assert.equal(canConfirmPaymentAfterStart(start, holdExpiresAt, intentCreatedAt, new Date("2026-10-01T12:05:00Z")), true);
  assert.equal(canConfirmPaymentAfterStart(start, holdExpiresAt, intentCreatedAt, new Date("2026-10-01T12:11:00Z")), false);
  assert.equal(canConfirmPaymentAfterStart(start, null, intentCreatedAt, new Date("2026-10-01T12:05:00Z")), false);
  assert.equal(canConfirmPaymentAfterStart(start, holdExpiresAt, start, new Date("2026-10-01T12:05:00Z")), false);
});
