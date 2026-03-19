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
  "User is not a MED user": "User is not a MED user",
  // Profile update
  "Full name is required": "Full name is required",
  "Invalid phone number format": "Invalid phone number format",
  // Change password
  "Current password is incorrect": "Current password is incorrect",
  // Appointment errors
  "Appointment date must be in the future": "Appointment date must be in the future.",
  "This date is no longer available. Please select another date.": "This date is no longer available. Please select another date.",
  "You already have an appointment request for this date.": "You already have an appointment request for this date.",
  "Appointment not found": "Appointment not found.",
  "Only pending appointments can be approved": "This appointment can no longer be approved.",
  "Only pending appointments can be rejected": "This appointment can no longer be rejected.",
  "Only approved appointments can be marked as completed": "Only approved appointments can be marked as completed.",
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
  getMedUsers: "Failed to retrieve MED users.",
  getMedUserById: "Failed to retrieve user details.",
  getVerificationDetail: "Failed to retrieve verification details.",
  // Appointments
  createAppointment: "Failed to submit appointment request. Please try again.",
  getMyAppointments: "Failed to load your appointments.",
  getBlockedDates: "Failed to load availability. Please try again.",
  getAppointmentRequests: "Failed to load appointment requests.",
  approveAppointment: "Failed to approve appointment. Please try again.",
  rejectAppointment: "Failed to reject appointment. Please try again.",
  completeAppointment: "Failed to mark appointment as completed. Please try again.",
  updateProfile: "Failed to update profile. Please try again.",
  updateProfilePicture: "Failed to update profile picture. Please try again.",
  changePassword: "Failed to change password. Please try again.",
};

export function sanitizeError(error: unknown, operation: string): string {
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
  return FALLBACK_MESSAGES[operation] ?? "Something went wrong. Please try again.";
}
