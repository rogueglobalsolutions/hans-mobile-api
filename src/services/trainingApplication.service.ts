import prisma from "../config/prisma";
import {
  AccountStatus,
  Role,
  TrainingApplicationStatus,
  TrainingStatus,
} from "../generated/prisma/enums";

type JsonRecord = Record<string, unknown>;

export interface SaveTrainingApplicationInput {
  prequalificationAnswers?: JsonRecord;
  registrationDetails?: JsonRecord;
  backgroundCheckAnswers?: JsonRecord;
  salesRepId?: string;
}

function requireRecord(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as JsonRecord;
}

async function requireAvailableTraining(trainingId: string) {
  const training = await prisma.training.findUnique({ where: { id: trainingId } });
  if (!training) throw new Error("Training not found");
  if (training.status !== TrainingStatus.ACTIVE) throw new Error("Training is not available for enrollment");
  return training;
}

async function requireActiveSalesRep(salesRepId: string) {
  const salesRep = await prisma.user.findFirst({
    where: {
      id: salesRepId,
      role: Role.SALES_REP,
      accountStatus: AccountStatus.ACTIVE,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!salesRep) throw new Error("Selected sales representative is not available");
}

export async function getTrainingApplication(userId: string, trainingId: string) {
  await requireAvailableTraining(trainingId);
  return prisma.trainingApplication.findUnique({
    where: { userId_trainingId: { userId, trainingId } },
    include: { salesRep: { select: { id: true, fullName: true, email: true } } },
  });
}

export async function saveTrainingApplication(
  userId: string,
  trainingId: string,
  input: SaveTrainingApplicationInput,
) {
  await requireAvailableTraining(trainingId);

  const existingEnrollment = await prisma.enrollment.findUnique({
    where: { userId_trainingId: { userId, trainingId } },
    select: { paymentStatus: true },
  });
  if (existingEnrollment?.paymentStatus === "COMPLETED") {
    throw new Error("A paid training application cannot be changed");
  }

  if (input.salesRepId !== undefined) await requireActiveSalesRep(input.salesRepId);

  const data: any = {
    ...(input.prequalificationAnswers !== undefined && {
      prequalificationAnswers: requireRecord(input.prequalificationAnswers, "prequalificationAnswers"),
    }),
    ...(input.registrationDetails !== undefined && {
      registrationDetails: requireRecord(input.registrationDetails, "registrationDetails"),
    }),
    ...(input.backgroundCheckAnswers !== undefined && {
      backgroundCheckAnswers: requireRecord(input.backgroundCheckAnswers, "backgroundCheckAnswers"),
    }),
    ...(input.salesRepId !== undefined && { salesRepId: input.salesRepId }),
    status: TrainingApplicationStatus.DRAFT,
    submittedAt: null,
    termsAcceptedAt: null,
    termsVersion: null,
  };

  return prisma.trainingApplication.upsert({
    where: { userId_trainingId: { userId, trainingId } },
    create: { userId, trainingId, ...data },
    update: data,
    include: { salesRep: { select: { id: true, fullName: true, email: true } } },
  });
}

export async function submitTrainingApplication(
  userId: string,
  trainingId: string,
  termsVersion: string,
) {
  await requireAvailableTraining(trainingId);
  const application = await prisma.trainingApplication.findUnique({
    where: { userId_trainingId: { userId, trainingId } },
  });
  if (!application) throw new Error("Complete the training application before continuing");
  if (!application.prequalificationAnswers) throw new Error("Prequalification answers are required");
  if (!application.registrationDetails) throw new Error("Registration details are required");
  if (!application.backgroundCheckAnswers) throw new Error("Background check answers are required");
  if (!application.salesRepId) throw new Error("A sales representative is required");
  await requireActiveSalesRep(application.salesRepId);

  const now = new Date();
  return prisma.trainingApplication.update({
    where: { id: application.id },
    data: {
      termsVersion: termsVersion.trim() || "training-terms-v1",
      termsAcceptedAt: now,
      submittedAt: now,
      status: TrainingApplicationStatus.SUBMITTED,
    },
    include: { salesRep: { select: { id: true, fullName: true, email: true } } },
  });
}

export async function getSubmittedApplication(userId: string, trainingId: string) {
  return prisma.trainingApplication.findFirst({
    where: {
      userId,
      trainingId,
      status: TrainingApplicationStatus.SUBMITTED,
      termsAcceptedAt: { not: null },
    },
  });
}
