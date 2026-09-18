const SAFE_MESSAGES: Record<string, string> = {
  "Email already registered": "Email already registered",
  "Phone number already registered": "Phone number already registered",
  "Invalid email or password": "Invalid email or password",
  "Invalid OTP": "Invalid OTP",
  "Invalid or expired OTP": "Invalid or expired OTP",
  "Invalid or expired reset token": "Invalid or expired reset token",
  "Invalid role": "Invalid role",
  "Account suspended": "Your account has been suspended. Please contact support.",
  "Access denied. Admin account required.": "Access denied. Admin account required.",
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
  // Training enrollment & payment
  "Training not found": "Training not found.",
  "Training is not available for enrollment": "This training is not available for enrollment.",
  "Training is full": "This training is full. No more slots available.",
  "Observer enrollment is only available when enrollee seats are full": "Observer enrollment is only available when enrollee seats are full.",
  "Already enrolled in this training": "You are already enrolled in this training.",
  "You must complete a Mint Lift Group Training or Supplemental training first": "You must complete a Mint Lift Group Training or Supplemental training first.",
  "Enrollment not found": "Enrollment not found.",
  // Training cancellation
  "Training is already cancelled or completed": "This training is already cancelled or completed.",
  "Training can only be cancelled when there is exactly 1 paid enrollee and no observers": "Training can only be cancelled when there is exactly 1 paid enrollee and no observers.",
  "No payment found for this enrollment": "No payment record found for this enrollment.",
  // Sales rep
  "A user with that email or phone number already exists": "A user with that email or phone number already exists.",
  // Documents
  "Folder not found": "Folder not found.",
  "Document not found": "Document not found.",
  "Parent folder not found": "Parent folder not found.",
  // Commerce
  "Product not found": "Product not found.",
  "Order not found": "Order not found.",
  "Shipping label not found": "Shipping label not found.",
  "At least one product is required": "At least one product is required.",
  "Product is out of stock": "Product is out of stock.",
  "Product checkout is not configured": "Product checkout is not configured for this item yet.",
  "Shipping address is incomplete": "Please add a complete shipping address before checking out.",
  "Unable to calculate shipping cost": "We couldn't calculate shipping for this order. Please try again shortly.",
  "Unable to generate shipping label": "We couldn't generate a UPS label for this order. Please check the order's shipping address and try again.",
  "Unable to void UPS shipment": "UPS could not void this shipment. The shipping label is still active; please try again.",
  "UPS shipment identifier is missing": "This UPS label is missing its shipment identifier and cannot be voided automatically.",
  "Shipping label cannot be voided": "This shipping label cannot be voided in its current status.",
  "UPS account number is not configured": "UPS shipping is not fully configured yet (missing account number).",
  "UPS shipper phone is not configured": "UPS shipping is not fully configured yet (missing shipper phone number).",
  "No payment found for this order": "No payment found for this order.",
  "Order is not refundable": "This order is not refundable.",
  "Refund amount must be greater than zero": "Refund amount must be greater than zero.",
  "Payment has not succeeded": "Payment has not succeeded.",
  "Payment amount does not match order": "Payment verification failed for this order.",
  "Payment amount does not match enrollment": "Payment verification failed for this enrollment.",
  "Enrollment payment could not be finalized": "Payment was received but enrollment could not be finalized. Please contact support.",
  "Cancelled order cannot be paid": "This order has already been cancelled.",
  "Order payment could not be finalized": "Payment was received but the order could not be finalized. Please contact support.",
  "Order total changed": "The shipping rate changed. Please review the updated order total.",
  "Unable to create order number": "The order could not be numbered. Please try checkout again.",
  "Order must be paid before creating a shipping label": "The order must be paid before creating a shipping label.",
  "Order must be verified before creating a shipping label": "Verify the order before creating a shipping label.",
  "Shipping label cannot be created for this order": "A shipping label cannot be created for this order in its current status.",
  "UPS label generation is already in progress": "UPS label generation is already in progress. Please wait and refresh the order.",
  "Shipping country is invalid": "The shipping country is invalid.",
  "Shipping state is invalid": "The shipping state is invalid.",
  "UPS Ground shipping is currently limited to US addresses": "UPS Ground shipping is currently available only for US addresses.",
  "Order must be paid before processing": "The order must be paid before it can be processed.",
  "Order must be paid before verification": "The order must be paid before it can be verified.",
  "Order cannot be verified in its current status": "The order cannot be verified in its current status.",
  "Order must be paid before shipping": "The order must be paid before it can be shipped.",
  "Order must be verified before shipping": "Verify the order before marking it shipped.",
  "Tracking is required before shipping": "Add tracking information before marking the order shipped.",
  "Order cannot be marked as shipped from its current status": "The order cannot be marked shipped from its current status.",
  "Only a shipped order can be marked delivered": "Only a shipped order can be marked delivered.",
  "Order must be paid before adding tracking": "The order must be paid before tracking can be added.",
  "Order must be verified before adding tracking": "Verify the order before adding tracking.",
  "Tracking cannot be changed for this order": "Tracking cannot be changed for this order.",
  "Cancelled order status cannot be changed": "A cancelled order's status cannot be changed.",
  "Shipped or delivered orders cannot be cancelled": "Shipped or delivered orders cannot be cancelled.",
  "Void the shipping label before cancelling this order": "Void the active shipping label before cancelling this order.",
  "Order cancellation could not be approved": "This cancellation request changed. Refresh the order and try again.",
};

const FALLBACK_MESSAGES: Record<string, string> = {
  register: "Registration failed. Please try again.",
  login: "Login failed. Please try again.",
  webLogin: "Login failed. Please try again.",
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
  // Training payment
  createPaymentIntent: "Failed to initiate payment. Please try again.",
  confirmPayment: "Failed to confirm payment. Please try again.",
  // Sales rep
  getTransactions: "Failed to load transactions.",
  getEnrollees: "Failed to load enrollees.",
  listSalesReps: "Failed to load sales representatives.",
  createSalesRep: "Failed to create sales rep account. Please try again.",
  // Training documents
  getFolders: "Failed to load folders.",
  createFolder: "Failed to create folder. Please try again.",
  uploadDocument: "Failed to upload document. Please try again.",
  deleteFolder: "Failed to delete folder. Please try again.",
  deleteDocument: "Failed to delete document. Please try again.",
  // Commerce
  getCommerceDashboard: "Failed to load commerce dashboard.",
  getCommerceProducts: "Failed to load products.",
  getCommerceProductById: "Failed to load product.",
  updateCommerceProduct: "Failed to update product.",
  getLowStockProducts: "Failed to load low stock products.",
  getCommerceOrders: "Failed to load orders.",
  getCommerceOrderById: "Failed to load order.",
  updateCommerceOrder: "Failed to update order.",
  refundCommerceOrder: "Failed to refund order.",
  getCommerceCustomers: "Failed to load customers.",
  getCommerceCustomerById: "Failed to load customer.",
  getCommerceReports: "Failed to load commerce reports.",
  getShippingLabels: "Failed to load shipping labels.",
  getShippingLabelById: "Failed to load shipping label.",
  createShippingLabel: "Failed to create shipping label.",
  generateUpsShippingLabel: "Failed to generate UPS shipping label.",
  updateShippingLabel: "Failed to update shipping label.",
  createProductOrderIntent: "Failed to create product payment intent.",
  confirmProductOrderPayment: "Failed to confirm product order payment.",
  getMyCommerceOrders: "Failed to load your orders.",
  getProductCheckoutProfile: "Failed to load your shipping address.",
  quoteProductOrder: "Failed to calculate your order total.",
};

export function sanitizeError(error: unknown, operation: string): string {
  if (error instanceof Error) {
    // Only return the message if it's in our safe list
    if (SAFE_MESSAGES[error.message]) {
      return SAFE_MESSAGES[error.message];
    }

    // Pass through dynamic messages that are safe to show users
    if (
      error.message.startsWith("You need at least") ||
      error.message.startsWith("You must complete")
    ) {
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
