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

  const eligibleStatuses: AccountStatus[] = [AccountStatus.PENDING_VERIFICATION, AccountStatus.REJECTED];
  if (!eligibleStatuses.includes(user.accountStatus as AccountStatus)) {
    throw new Error("Account not eligible for verification");
  }

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
    message: "Verification documents submitted successfully. Your account will be reviewed by our team.",
  };
}

export async function resubmitVerification(input: SubmitVerificationInput) {
  return submitVerification(input);
}

interface VerificationActionInput {
  userId: string;
  adminId: string;
}

export async function approveVerification(input: VerificationActionInput) {
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
    },
  });

  await sendVerificationStatusEmail(user.email, "approved", user.fullName);

  return {
    message: "User verification approved successfully",
  };
}

export async function rejectVerification(input: VerificationActionInput) {
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
    },
  });

  await sendVerificationStatusEmail(user.email, "rejected", user.fullName);

  return {
    message: "User verification rejected",
  };
}

export async function getPendingVerifications() {
  const users = await prisma.user.findMany({
    where: {
      accountStatus: AccountStatus.PENDING_VERIFICATION,
      hasSubmittedVerification: true,
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

export async function getMedUsers() {
  const users = await prisma.user.findMany({
    where: {
      role: "MED",
      hasSubmittedVerification: true,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      medicalLicenseNumber: true,
      accountStatus: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return users;
}

export async function getMedUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      medicalLicenseNumber: true,
      idDocumentFrontPath: true,
      idDocumentBackPath: true,
      accountStatus: true,
      hasSubmittedVerification: true,
      verificationNotes: true,
      verifiedAt: true,
      createdAt: true,
      // Personal location
      country: true,
      city: true,
      stateProvince: true,
      zipCode: true,
      address: true,
      // Medical director
      medDirectorFullName: true,
      medDirectorTitle: true,
      medDirectorTitleOther: true,
      // Business / practice
      practiceName: true,
      practiceAddressLine1: true,
      practiceAddressLine2: true,
      practiceCity: true,
      practiceState: true,
      practiceZipCode: true,
      practicePhone: true,
      isExistingCustomer: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.accountStatus === "ACTIVE" && !user.hasSubmittedVerification) {
    throw new Error("User is not a MED user");
  }

  return user;
}
