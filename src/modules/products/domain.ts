/**
 * Standard pagination metadata envelope.
 *
 * @public
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Determines whether a product inventory level is at or below its low stock threshold.
 *
 * @param quantity - Current stock quantity.
 * @param lowStockThreshold - Stock alert threshold.
 * @returns True if quantity is less than or equal to threshold.
 */
export function isLowStock(
  quantity: number,
  lowStockThreshold: number,
): boolean {
  return quantity <= lowStockThreshold;
}

/**
 * Calculates standard pagination metadata.
 *
 * @remarks
 * ponytail: Pagination math assumes uniform page sizes. Max limit enforced by schema.
 *
 * @param total - Total count of matching records.
 * @param page - Current 1-indexed page number.
 * @param limit - Maximum items per page.
 * @returns Pagination metadata object.
 */
export function calculatePaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) || 1 : 1;
  return {
    page,
    limit,
    total,
    totalPages,
  };
}

/**
 * Escapes special SQL LIKE wildcard characters (%, _, \) in user search input.
 *
 * @param input - Raw search string.
 * @returns Sanitized string with wildcard characters escaped.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}
