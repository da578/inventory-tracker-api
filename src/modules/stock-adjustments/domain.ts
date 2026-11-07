export type StockAdjustmentType = "IN" | "OUT";

export interface StockValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates whether sufficient stock exists for an adjustment.
 *
 * @param currentQuantity - Current quantity on hand.
 * @param adjustmentQuantity - Quantity to add or deduct.
 * @param type - Direction of stock movement ("IN" | "OUT").
 * @returns Object with valid flag and optional error message.
 */
export function validateStockAvailability(
  currentQuantity: number,
  adjustmentQuantity: number,
  type: StockAdjustmentType,
): StockValidationResult {
  if (type === "OUT" && currentQuantity < adjustmentQuantity) {
    return {
      valid: false,
      error: "Insufficient stock for deduction",
    };
  }
  return { valid: true };
}

/**
 * Calculates new stock quantity after an adjustment.
 *
 * @remarks
 * ponytail: Integer arithmetic only. Upgrade to Decimal representation if supporting fractional units.
 *
 * @param currentQuantity - Current quantity on hand.
 * @param adjustmentQuantity - Quantity to add or deduct.
 * @param type - Direction of stock movement ("IN" | "OUT").
 * @returns The resulting quantity after applying the adjustment.
 */
export function calculateNewQuantity(
  currentQuantity: number,
  adjustmentQuantity: number,
  type: StockAdjustmentType,
): number {
  if (type === "IN") {
    return currentQuantity + adjustmentQuantity;
  }
  if (adjustmentQuantity > currentQuantity) {
    throw new Error("Insufficient stock for deduction");
  }
  return currentQuantity - adjustmentQuantity;
}

/**
 * Validates adjustment reason text length after trimming whitespace.
 *
 * @param reason - Justification string.
 * @returns Object with valid flag and optional error message.
 */
export function validateAdjustmentReason(
  reason: string,
): StockValidationResult {
  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    return {
      valid: false,
      error: "Reason must be at least 5 characters",
    };
  }
  if (trimmed.length > 255) {
    return {
      valid: false,
      error: "Reason cannot exceed 255 characters",
    };
  }
  return { valid: true };
}
