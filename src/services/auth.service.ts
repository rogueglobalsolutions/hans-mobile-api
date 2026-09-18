import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import prisma from "../config/prisma";
import { Role, AccountStatus } from "../generated/prisma/enums";
import { signToken, signResetToken, verifyToken, ResetTokenPayload } from "../utils/jwt";
import { generateOtp, getOtpExpiry } from "../utils/otp";
import { sendOtpEmail } from "./email.service";
import { validateAndFormatPhone } from "../utils/phone";
import { stripe } from "../config/stripe";

interface RegisterInput {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role?: Role;
  country?: string;
  city?: string;
  stateProvince?: string;
  zipCode?: string;
  address?: string;
  // Medical Director
  medDirectorFullName?: string;
  medDirectorTitle?: string;
  medDirectorTitleOther?: string;
  // Business Information
  practiceName?: string;
  practiceAddressLine1?: string;
  practiceAddressLine2?: string;
  practiceCountry?: string;
  practiceCity?: string;
  practiceState?: string;
  practiceZipCode?: string;
  practicePhone?: string;
  isExistingCustomer?: boolean;
  // Agreements
  agreedToTerms?: boolean;
  subscribedToUpdates?: boolean;
}

interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new Error("Email already registered");
  }

  // Check if phone number is already registered
  const existingPhone = await prisma.user.findFirst({
    where: { phoneNumber: input.phoneNumber },
  });

  if (existingPhone) {
    throw new Error("Phone number already registered");
  }

  // Validate role - only USER and MED are allowed for registration
  if (input.role && input.role === Role.ADMIN) {
    throw new Error("Invalid role");
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  // Determine account status based on role
  const userRole = input.role || Role.USER;
  const accountStatus = userRole === Role.MED ? AccountStatus.PENDING_VERIFICATION : AccountStatus.ACTIVE;

  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      password: hashedPassword,
      role: userRole,
      accountStatus,
      country: input.country?.trim() || null,
      city: input.city?.trim() || null,
      stateProvince: input.stateProvince?.trim() || null,
      zipCode: input.zipCode?.trim() || null,
      address: input.address?.trim() || null,
      medDirectorFullName: input.medDirectorFullName?.trim() || null,
      medDirectorTitle: input.medDirectorTitle?.trim() || null,
      medDirectorTitleOther: input.medDirectorTitleOther?.trim() || null,
      practiceName: input.practiceName?.trim() || null,
      practiceAddressLine1: input.practiceAddressLine1?.trim() || null,
      practiceAddressLine2: input.practiceAddressLine2?.trim() || null,
      practiceCountry: input.practiceCountry?.trim() || null,
      practiceCity: input.practiceCity?.trim() || null,
      practiceState: input.practiceState?.trim() || null,
      practiceZipCode: input.practiceZipCode?.trim() || null,
      practicePhone: input.practicePhone?.trim() || null,
      isExistingCustomer: input.isExistingCustomer ?? null,
      agreedToTerms: input.agreedToTerms ?? false,
      subscribedToUpdates: input.subscribedToUpdates ?? false,
    },
  });

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    accountStatus: user.accountStatus,
    hasSubmittedVerification: user.hasSubmittedVerification,
  };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isValidPassword = await bcrypt.compare(input.password, user.password);

  if (!isValidPassword) {
    throw new Error("Invalid email or password");
  }

  // Check account status - only block SUSPENDED accounts from logging in
  // PENDING_VERIFICATION and REJECTED can log in, but app will redirect based on accountStatus
  if (user.accountStatus === AccountStatus.SUSPENDED) {
    throw new Error("Account suspended");
  }

  const token = signToken({ userId: user.id, email: user.email });

  return {
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      accountStatus: user.accountStatus,
      hasSubmittedVerification: user.hasSubmittedVerification,
      medicalLicenseNumber: user.medicalLicenseNumber ?? undefined,
      verifiedAt: user.verifiedAt ?? undefined,
      createdAt: user.createdAt,
      profilePicturePath: user.profilePicturePath ?? undefined,
    },
  };
}

function deleteUploadFile(relativePath: string | null | undefined) {
  if (!relativePath) return;
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) return;
  try {
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
  } catch (error) {
    console.error("Failed to delete account upload:", error);
  }
}

export async function deleteAccount(userId: string, currentPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new Error("User not found");
  if (user.role !== Role.MED) throw new Error("Account deletion is only available for MED accounts");
  const validPassword = await bcrypt.compare(currentPassword, user.password);
  if (!validPassword) throw new Error("Current password is incorrect");

  const [baEntries, contestEntries, chatMessages, pendingEnrollments, pendingOrders, failedOrdersWithReservedCredits] = await Promise.all([
    prisma.beforeAndAfterEntry.findMany({ where: { userId }, include: { media: true } }),
    prisma.contestEntry.findMany({ where: { userId }, include: { media: true } }),
    prisma.chatMessage.findMany({ where: { userId }, select: { imageUrl: true } }),
    prisma.enrollment.findMany({
      where: { userId, paymentStatus: "PENDING" },
      include: { paymentAttempts: true },
    }),
    prisma.order.findMany({
      where: { userId, paymentStatus: "PENDING" },
      select: { id: true, stripePaymentIntentId: true },
    }),
    prisma.order.findMany({
      where: {
        userId,
        paymentStatus: "FAILED",
        creditReservation: { is: { status: "RESERVED" } },
      },
      select: { id: true, stripePaymentIntentId: true },
    }),
  ]);

  const pendingIntentIds = [...new Set([
    ...pendingEnrollments.flatMap((item) => item.paymentAttempts.map((attempt) => attempt.stripePaymentIntentId)),
    ...pendingOrders.flatMap((order) => order.stripePaymentIntentId ? [order.stripePaymentIntentId] : []),
    ...failedOrdersWithReservedCredits.flatMap((order) => order.stripePaymentIntentId ? [order.stripePaymentIntentId] : []),
  ])];
  for (const paymentIntentId of pendingIntentIds) {
    let intent;
    try {
      intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      console.error("Failed to verify payment during account deletion:", error);
      throw new Error("A pending payment could not be verified. Please try deleting your account again shortly.");
    }
    if (intent.status === "succeeded") {
      throw new Error("A payment is still being finalized. Please try deleting your account again shortly.");
    }
    if (intent.status !== "canceled") {
      try {
        await stripe.paymentIntents.cancel(paymentIntentId);
      } catch (error) {
        console.error("Failed to cancel payment during account deletion:", error);
        throw new Error("A pending payment could not be canceled. Please try deleting your account again shortly.");
      }
    }
  }

  const replacementPassword = await bcrypt.hash(`${userId}:${Date.now()}:${Math.random()}`, 12);
  await prisma.$transaction(async (tx) => {
    for (const order of pendingOrders) {
      const reservation = await tx.creditReservation.findUnique({ where: { orderId: order.id } });
      if (reservation?.status === "RESERVED") {
        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: { increment: reservation.amount } },
        });
      }
      await tx.order.delete({ where: { id: order.id } });
    }
    for (const order of failedOrdersWithReservedCredits) {
      const reservation = await tx.creditReservation.findUnique({ where: { orderId: order.id } });
      if (reservation?.status === "RESERVED") {
        const released = await tx.creditReservation.updateMany({
          where: { id: reservation.id, status: "RESERVED" },
          data: { status: "RELEASED", releasedAt: new Date() },
        });
        if (released.count === 1) {
          await tx.user.update({
            where: { id: userId },
            data: { creditBalance: { increment: reservation.amount } },
          });
        }
      }
    }
    await tx.enrollmentPaymentAttempt.updateMany({
      where: { enrollment: { userId }, status: "PENDING" },
      data: { status: "FAILED" },
    });
    await tx.enrollment.updateMany({
      where: { userId, paymentStatus: "PENDING" },
      data: { paymentStatus: "FAILED", reservationExpiresAt: null },
    });
    await tx.otp.deleteMany({ where: { userId } });
    await tx.appointment.deleteMany({ where: { medUserId: userId } });
    await tx.chatMessage.deleteMany({ where: { userId } });
    await tx.beforeAndAfterEntry.deleteMany({ where: { userId } });
    await tx.contestEntry.deleteMany({ where: { userId } });
    await tx.trainingApplication.updateMany({
      where: { userId },
      data: { registrationDetails: { redacted: true } },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        fullName: "Deleted User",
        email: `deleted+${userId}@deleted.invalid`,
        phoneNumber: `deleted-${userId}`,
        password: replacementPassword,
        accountStatus: AccountStatus.SUSPENDED,
        deletedAt: new Date(),
        hasSubmittedVerification: false,
        medicalLicenseNumber: null,
        idDocumentFrontPath: null,
        idDocumentBackPath: null,
        verificationNotes: null,
        verifiedAt: null,
        verifiedBy: null,
        profilePicturePath: null,
        country: null,
        city: null,
        stateProvince: null,
        zipCode: null,
        address: null,
        medDirectorFullName: null,
        medDirectorTitle: null,
        medDirectorTitleOther: null,
        practiceName: null,
        practiceAddressLine1: null,
        practiceAddressLine2: null,
        practiceCountry: null,
        practiceCity: null,
        practiceState: null,
        practiceZipCode: null,
        practicePhone: null,
        isExistingCustomer: null,
        agreedToTerms: false,
        subscribedToUpdates: false,
      },
    });
  });

  deleteUploadFile(user.profilePicturePath);
  deleteUploadFile(user.idDocumentFrontPath);
  deleteUploadFile(user.idDocumentBackPath);
  baEntries.forEach((entry) => entry.media.forEach((media) => deleteUploadFile(media.filePath)));
  contestEntries.forEach((entry) => entry.media.forEach((media) => deleteUploadFile(media.filePath)));
  chatMessages.forEach((message) => deleteUploadFile(message.imageUrl));
  return { message: "Account deleted" };
}

export async function updateProfile(userId: string, input: { fullName: string; phoneNumber: string }) {
  const { fullName, phoneNumber } = input;

  if (!fullName || !fullName.trim()) {
    throw new Error("Full name is required");
  }

  const phoneValidation = validateAndFormatPhone(phoneNumber.trim());
  if (!phoneValidation.isValid || !phoneValidation.formatted) {
    throw new Error("Invalid phone number format");
  }

  // Check phone isn't already taken by another user
  const existingPhone = await prisma.user.findFirst({
    where: { phoneNumber: phoneValidation.formatted, NOT: { id: userId } },
  });
  if (existingPhone) {
    throw new Error("Phone number already registered");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { fullName: fullName.trim(), phoneNumber: phoneValidation.formatted },
  });

  return {
    id: user.id,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
  };
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return { message: "If your email is registered, you will receive an OTP" };
  }

  // Invalidate existing OTPs
  await prisma.otp.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const otp = generateOtp();
  const expiresAt = getOtpExpiry(10);

  await prisma.otp.create({
    data: {
      code: otp,
      userId: user.id,
      expiresAt,
    },
  });

  await sendOtpEmail(email, otp);

  return { message: "If your email is registered, you will receive an OTP" };
}

export async function verifyOtp(email: string, code: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("Invalid OTP");
  }

  const otp = await prisma.otp.findFirst({
    where: {
      userId: user.id,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!otp) {
    throw new Error("Invalid or expired OTP");
  }

  await prisma.otp.update({
    where: { id: otp.id },
    data: { used: true },
  });

  const resetToken = signResetToken({ userId: user.id, purpose: "password-reset" });

  return { resetToken };
}

export async function resetPassword(resetToken: string, newPassword: string) {
  const payload = verifyToken<ResetTokenPayload>(resetToken);

  if (!payload || payload.purpose !== "password-reset") {
    throw new Error("Invalid or expired reset token");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: payload.userId },
    data: { password: hashedPassword },
  });

  // Invalidate all OTPs for this user
  await prisma.otp.updateMany({
    where: { userId: payload.userId },
    data: { used: true },
  });

  return { message: "Password reset successfully" };
}

export async function updateProfilePicture(userId: string, newFilePath: string) {
  // Delete old profile picture file if one exists
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { profilePicturePath: true },
  });

  if (existing?.profilePicturePath && existing.profilePicturePath !== newFilePath) {
    const oldPath = path.join(process.cwd(), existing.profilePicturePath);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { profilePicturePath: newFilePath },
  });

  return { profilePicturePath: user.profilePicturePath };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    throw new Error("Current password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { message: "Password changed successfully" };
}
