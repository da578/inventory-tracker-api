/**
 * Functional Core for supplier domain operations.
 *
 * @remarks
 * Contains pure, zero-I/O validation and decision functions.
 *
 * @public
 */

/**
 * Validates supplier name string bounds.
 *
 * @param name - Supplier company name.
 * @returns Validation outcome object.
 */
export function validateSupplierName(name: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 150) {
    return {
      valid: false,
      error: "Supplier name must be between 2 and 150 characters in length",
    };
  }
  return { valid: true };
}

/**
 * Validates optional contact email and phone number formatting.
 *
 * @param email - Optional email string.
 * @param phone - Optional telephone number string.
 * @returns Validation outcome object.
 */
export function validateSupplierContact(
  email?: string | null,
  phone?: string | null,
): { valid: boolean; error?: string } {
  const trimmedPhone = phone?.trim();
  if (trimmedPhone && trimmedPhone.length < 8) {
    return {
      valid: false,
      error: "Contact phone must be at least 8 characters in length",
    };
  }

  const trimmedEmail = email?.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (trimmedEmail && !emailRegex.test(trimmedEmail)) {
    return {
      valid: false,
      error: "Please provide a valid email address format",
    };
  }

  return { valid: true };
}
