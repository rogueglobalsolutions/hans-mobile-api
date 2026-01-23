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
    const { fullName, email, phoneNumber, password, confirmPassword, role } = req.body;

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

    const user = await authService.register({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneValidation.formatted,
      password,
      role: role as Role | undefined,
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
