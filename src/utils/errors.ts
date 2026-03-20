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
  // B&A
  "Entry not found": "Entry not found.",
  "Contest entry not found": "Contest entry not found.",
  "Title is required": "Title is required.",
  "Description is required": "Description is required.",
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
  // B&A
  createBAEntry: "Failed to create entry. Please try again.",
  getMyBAEntries: "Failed to load entries.",
  getMyBAEntryById: "Failed to load entry details.",
  deleteBAEntry: "Failed to delete entry. Please try again.",
  getBAEntryCount: "Failed to load entry count.",
  createContestEntry: "Failed to submit contest entry. Please try again.",
  getMyContestEntries: "Failed to load contest entries.",
  getMyContestEntryById: "Failed to load contest entry details.",
  deleteContestEntry: "Failed to delete contest entry. Please try again.",
  getAllBAEntries: "Failed to load B&A entries.",
  getBAEntryByIdAdmin: "Failed to load entry details.",
  getAllContestEntries: "Failed to load contest entries.",
  getContestEntryByIdAdmin: "Failed to load contest entry details.",
  toggleContestLike: "Failed to update like. Please try again.",
  getBAStats: "Failed to load B&A statistics.",
};

export function sanitizeError(error: unknown, operation: string): string {
  if (error instanceof Error) {
    // Only return the message if it's in our safe list
    if (SAFE_MESSAGES[error.message]) {
      return SAFE_MESSAGES[error.message];
    }

    // Pass through contest eligibility messages (dynamic text)
    if (error.message.startsWith("You need at least")) {
      return error.message;
    }

    // Log the actual error for debugging (internal only)
    console.error(`[${operation}] Internal error:`, error.message);
  } else {
    console.error(`[${operation}] Unknown error:`, error);
  }

  // Return generic message for anything else
  return FALLBACK_MESSAGES[operation] ?? "Something went wrong. Please try again.";
}
