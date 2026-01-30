const SAFE_MESSAGES: Record<string, string> = {
  "Email already registered": "Email already registered",
  "Phone number already registered": "Phone number already registered",
  "Invalid email or password": "Invalid email or password",
  "Invalid OTP": "Invalid OTP",
  "Invalid or expired OTP": "Invalid or expired OTP",
  "Invalid or expired reset token": "Invalid or expired reset token",
  "Invalid role": "Invalid role",
  "Account suspended": "Your account has been suspended. Please contact support.",
  "User not found": "User not found",
  "Account not eligible for verification": "Account is not eligible for verification",
  "User is not pending verification": "User is not pending verification",
  "Only rejected accounts can resubmit verification": "Only rejected accounts can resubmit verification",
  "Insufficient permissions": "Insufficient permissions",
};

const FALLBACK_MESSAGES: Record<string, string> = {
  register: "Registration failed. Please try again.",
  login: "Login failed. Please try again.",
  forgotPassword: "Request failed. Please try again.",
  verifyOtp: "OTP verification failed. Please try again.",
  resetPassword: "Password reset failed. Please try again.",
  submitVerification: "Verification submission failed. Please try again.",
  resubmitVerification: "Verification resubmission failed. Please try again.",
  approveVerification: "Approval failed. Please try again.",
  rejectVerification: "Rejection failed. Please try again.",
  getPendingVerifications: "Failed to retrieve pending verifications.",
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
