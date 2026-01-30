import prisma from "../config/prisma";
import { AccountStatus } from "../generated/prisma/enums";
import { sendVerificationStatusEmail } from "./email.service";

interface SubmitVerificationInput {
  userId: string;
  medicalLicenseNumber: string;
  idDocumentFrontPath: string;
  idDocumentBackPath: string;
}

export async function submitVerification(input: SubmitVerificationInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.accountStatus !== AccountStatus.PENDING_VERIFICATION) {
    throw new Error("Account not eligible for verification");
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      hasSubmittedVerification: true,
      medicalLicenseNumber: input.medicalLicenseNumber,
      idDocumentFrontPath: input.idDocumentFrontPath,
      idDocumentBackPath: input.idDocumentBackPath,
    },
  });

  return {
    message: "Verification documents submitted successfully. Your account will be reviewed by our team.",
  };
}

export async function resubmitVerification(input: SubmitVerificationInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.accountStatus !== AccountStatus.REJECTED) {
    throw new Error("Only rejected accounts can resubmit verification");
  }

  // Update status back to pending and clear previous verification data
  await prisma.user.update({
    where: { id: input.userId },
    data: {
      accountStatus: AccountStatus.PENDING_VERIFICATION,
      hasSubmittedVerification: true,
      medicalLicenseNumber: input.medicalLicenseNumber,
      idDocumentFrontPath: input.idDocumentFrontPath,
      idDocumentBackPath: input.idDocumentBackPath,
      verificationNotes: null,
      verifiedAt: null,
      verifiedBy: null,
    },
  });

  return {
    message: "Verification documents resubmitted successfully. Your account will be reviewed again by our team.",
  };
}

interface ApproveVerificationInput {
  userId: string;
  adminId: string;
  notes?: string;
}

export async function approveVerification(input: ApproveVerificationInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.accountStatus !== AccountStatus.PENDING_VERIFICATION) {
    throw new Error("User is not pending verification");
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      accountStatus: AccountStatus.ACTIVE,
      verifiedAt: new Date(),
      verifiedBy: input.adminId,
      verificationNotes: input.notes,
    },
  });

  // Send approval email
  await sendVerificationStatusEmail(user.email, "approved", user.fullName);

  return {
    message: "User verification approved successfully",
  };
}

interface RejectVerificationInput {
  userId: string;
  adminId: string;
  notes: string;
}

export async function rejectVerification(input: RejectVerificationInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.accountStatus !== AccountStatus.PENDING_VERIFICATION) {
    throw new Error("User is not pending verification");
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      accountStatus: AccountStatus.REJECTED,
      verifiedAt: new Date(),
      verifiedBy: input.adminId,
      verificationNotes: input.notes,
    },
  });

  // Send rejection email
  await sendVerificationStatusEmail(user.email, "rejected", user.fullName, input.notes);

  return {
    message: "User verification rejected",
  };
}

export async function getPendingVerifications() {
  const users = await prisma.user.findMany({
    where: {
      accountStatus: AccountStatus.PENDING_VERIFICATION,
      medicalLicenseNumber: { not: null },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      medicalLicenseNumber: true,
      idDocumentFrontPath: true,
      idDocumentBackPath: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return users;
}
