export type UserRole = "admin" | "staff";

/**
 * Checks whether a token is expired given an expiration timestamp.
 *
 * @param expiresAt - Token expiration date.
 * @param now - Reference timestamp to compare against (defaults to current date).
 * @returns True if now is greater than or equal to expiresAt.
 */
export function isTokenExpired(
  expiresAt: Date,
  now: Date = new Date(),
): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/**
 * Calculates a future expiration date given a duration and starting timestamp.
 *
 * @param durationMs - Duration in milliseconds until expiration.
 * @param from - Starting timestamp (defaults to current date).
 * @returns Computed expiration date.
 */
export function calculateTokenExpiry(
  durationMs: number,
  from: Date = new Date(),
): Date {
  return new Date(from.getTime() + durationMs);
}

/**
 * Determines whether the user role is authorized by the required roles list.
 *
 * @param userRole - The role of the user.
 * @param allowedRoles - Readonly array of permitted roles.
 * @returns True if the user role matches one of the allowed roles.
 */
export function hasRequiredRole(
  userRole: UserRole,
  allowedRoles: readonly UserRole[],
): boolean {
  return allowedRoles.includes(userRole);
}
