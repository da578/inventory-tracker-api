/**
 * Functional Core for category domain operations.
 *
 * @remarks
 * Contains pure, zero-I/O validation and decision functions.
 *
 * @public
 */

/**
 * Validates category name length constraints.
 *
 * @param name - Category name string.
 * @returns Validation outcome object.
 */
export function validateCategoryName(name: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 100) {
    return {
      valid: false,
      error: "Category name must be between 3 and 100 characters in length",
    };
  }
  return { valid: true };
}
