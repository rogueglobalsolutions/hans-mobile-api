import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { Role } from "../generated/prisma/enums";
import { sanitizeError } from "../utils/errors";
import { validateAndFormatPhone } from "../utils/phone";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function register(req: Request, res: Response) {
  try {
    const {
      fullName, email, phoneNumber, password, confirmPassword, role,
      country, city, stateProvince, zipCode, address,
      medDirectorFullName, medDirectorTitle, medDirectorTitleOther,
      practiceName, practiceAddressLine1, practiceAddressLine2, practiceCountry,
      practiceCity, practiceState, practiceZipCode, practicePhone,
      isExistingCustomer, agreedToTerms, subscribedToUpdates,
    } = req.body;

    const errors: string[] = [];

    if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
      errors.push("Full name is required");
    }

    if (!email || !isValidEmail(email)) {
      errors.push("Valid email is required");
    }

    if (!phoneNumber || typeof phoneNumber !== "string" || !phoneNumber.trim()) {
      errors.push("Phone number is required");
    } else {
      // Validate phone number format
      const phoneValidation = validateAndFormatPhone(phoneNumber.trim());
      if (!phoneValidation.isValid) {
        errors.push(phoneValidation.error || "Invalid phone number format");
      }
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      errors.push("Password must be at least 8 characters");
    }

    if (password !== confirmPassword) {
      errors.push("Passwords do not match");
    }

    // Validate practice phone if provided
    if (practicePhone && practicePhone.trim()) {
      const practicePhoneValidation = validateAndFormatPhone(practicePhone.trim());
      if (!practicePhoneValidation.isValid) {
        errors.push(practicePhoneValidation.error || "Invalid practice phone number format");
      }
    }

    if (role === Role.MED && (!practiceCountry || typeof practiceCountry !== "string" || !practiceCountry.trim())) {
      errors.push("Practice country is required");
    }

    // Validate role if provided
    if (role !== undefined) {
      const validRoles = [Role.USER, Role.MED];
      if (!validRoles.includes(role)) {
        errors.push("Invalid role. Only USER and MED roles are allowed for registration");
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed", errors });
      return;
    }

    // Format phone number to E.164
    const phoneValidation = validateAndFormatPhone(phoneNumber.trim());
    if (!phoneValidation.isValid || !phoneValidation.formatted) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: ["Invalid phone number format"],
      });
      return;
    }

    const practicePhoneFormatted = practicePhone?.trim()
      ? validateAndFormatPhone(practicePhone.trim()).formatted
      : undefined;

    const user = await authService.register({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneValidation.formatted,
      password,
      role: role as Role | undefined,
      country,
      city,
      stateProvince,
      zipCode,
      address,
      medDirectorFullName,
      medDirectorTitle,
      medDirectorTitleOther,
      practiceName,
      practiceAddressLine1,
      practiceAddressLine2,
      practiceCountry,
      practiceCity,
      practiceState,
      practiceZipCode,
      practicePhone: practicePhoneFormatted,
      isExistingCustomer,
      agreedToTerms,
      subscribedToUpdates,
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: user,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "register") });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    const errors: string[] = [];

    if (!email || !isValidEmail(email)) {
      errors.push("Valid email is required");
    }

    if (!password) {
      errors.push("Password is required");
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed", errors });
      return;
    }

    const result = await authService.login({
      email: email.toLowerCase().trim(),
      password,
    });

    res.json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    res.status(401).json({ success: false, message: sanitizeError(error, "login") });
  }
}

export async function updateProfilePicture(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    if (!req.file) {
      res.status(400).json({ success: false, message: "No image file provided" });
      return;
    }
    const relativePath = `uploads/profile-pictures/${req.file.filename}`;
    const result = await authService.updateProfilePicture(userId, relativePath);
    res.json({ success: true, message: "Profile picture updated successfully", data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "updateProfilePicture") });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { fullName, phoneNumber } = req.body;
    const errors: string[] = [];
    if (!fullName || typeof fullName !== "string" || !fullName.trim()) errors.push("Full name is required");
    if (!phoneNumber || typeof phoneNumber !== "string" || !phoneNumber.trim()) errors.push("Phone number is required");
    if (errors.length > 0) { res.status(400).json({ success: false, message: "Validation failed", errors }); return; }
    const updated = await authService.updateProfile(userId, { fullName, phoneNumber });
    res.json({ success: true, message: "Profile updated successfully", data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "updateProfile") });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      res.status(400).json({
        success: false,
        message: "Valid email is required",
      });
      return;
    }

    const result = await authService.forgotPassword(email.toLowerCase().trim());

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    // Always return success to prevent email enumeration
    console.error("[forgotPassword] Internal error:", error);
    res.json({
      success: true,
      message: "If your email is registered, you will receive an OTP",
    });
  }
}

export async function verifyOtp(req: Request, res: Response) {
  try {
    const { email, otp } = req.body;

    const errors: string[] = [];

    if (!email || !isValidEmail(email)) {
      errors.push("Valid email is required");
    }

    if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      errors.push("Valid 6-digit OTP is required");
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed", errors });
      return;
    }

    const result = await authService.verifyOtp(email.toLowerCase().trim(), otp);

    res.json({
      success: true,
      message: "OTP verified successfully",
      data: result,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "verifyOtp") });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    const errors: string[] = [];

    if (!resetToken) {
      errors.push("Reset token is required");
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      errors.push("New password must be at least 8 characters");
    }

    if (newPassword !== confirmPassword) {
      errors.push("Passwords do not match");
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed", errors });
      return;
    }

    const result = await authService.resetPassword(resetToken, newPassword);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "resetPassword") });
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const errors: string[] = [];

    if (!currentPassword || typeof currentPassword !== "string") {
      errors.push("Current password is required");
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      errors.push("New password must be at least 8 characters");
    }

    if (newPassword !== confirmPassword) {
      errors.push("Passwords do not match");
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed", errors });
      return;
    }

    const result = await authService.changePassword(userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "changePassword") });
  }
}
