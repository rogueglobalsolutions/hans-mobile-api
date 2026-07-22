import { Request, Response } from "express";
import * as authService from "../../services/auth.service";
import { Role } from "../../generated/prisma/enums";
import { sanitizeError } from "../../utils/errors";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    if (result.user.role !== Role.ADMIN) {
      throw new Error("Access denied. Admin account required.");
    }

    res.json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    res.status(401).json({ success: false, message: sanitizeError(error, "webLogin") });
  }
}
