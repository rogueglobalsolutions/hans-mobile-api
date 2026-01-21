const SAFE_MESSAGES: Record<string, string> = {
  "Email already registered": "Email already registered",
  "Invalid email or password": "Invalid email or password",
  "Invalid OTP": "Invalid OTP",
  "Invalid or expired OTP": "Invalid or expired OTP",
  "Invalid or expired reset token": "Invalid or expired reset token",
};

const FALLBACK_MESSAGES: Record<string, string> = {
  register: "Registration failed. Please try again.",
  login: "Login failed. Please try again.",
  forgotPassword: "Request failed. Please try again.",
  verifyOtp: "OTP verification failed. Please try again.",
  resetPassword: "Password reset failed. Please try again.",
};

export function sanitizeError(error: unknown, operation: keyof typeof FALLBACK_MESSAGES): string {
  if (error instanceof Error) {
    // Only return the message if it's in our safe list
    if (SAFE_MESSAGES[error.message]) {
      return SAFE_MESSAGES[error.message];
    }

    // Log the actual error for debugging (internal only)
    console.error(`[${operation}] Internal error:`, error.message);
  } else {
    console.error(`[${operation}] Unknown error:`, error);
  }

  // Return generic message for anything else
  return FALLBACK_MESSAGES[operation];
}
