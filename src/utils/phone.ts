import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

/**
 * Validates and formats a phone number to E.164 format
 * @param phoneNumber - The phone number to validate
 * @param defaultCountry - Default country code (optional, e.g., 'US')
 * @returns Object with isValid flag and formatted number in E.164 format
 */
export function validateAndFormatPhone(
  phoneNumber: string,
  defaultCountry?: string
): { isValid: boolean; formatted?: string; error?: string } {
  try {
    // Check if the phone number is valid
    if (!isValidPhoneNumber(phoneNumber, defaultCountry as any)) {
      return {
        isValid: false,
        error: "Invalid phone number format",
      };
    }

    // Parse and format to E.164
    const parsedNumber = parsePhoneNumber(phoneNumber, defaultCountry as any);

    return {
      isValid: true,
      formatted: parsedNumber.format("E.164"),
    };
  } catch (error) {
    return {
      isValid: false,
      error: "Invalid phone number format",
    };
  }
}

/**
 * Simple validation check without formatting
 */
export function isValidPhone(phoneNumber: string, defaultCountry?: string): boolean {
  return isValidPhoneNumber(phoneNumber, defaultCountry as any);
}
