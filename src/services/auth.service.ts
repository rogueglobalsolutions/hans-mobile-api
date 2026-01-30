import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { Role, AccountStatus } from "../generated/prisma/enums";
import { signToken, signResetToken, verifyToken, ResetTokenPayload } from "../utils/jwt";
import { generateOtp, getOtpExpiry } from "../utils/otp";
import { sendOtpEmail } from "./email.service";

interface RegisterInput {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role?: Role;
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
    },
  });

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    accountStatus: user.accountStatus,
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
    },
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
