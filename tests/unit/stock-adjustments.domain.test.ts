import { describe, expect, it } from "bun:test";
import {
  calculateNewQuantity,
  validateAdjustmentReason,
  validateStockAvailability,
} from "../../src/modules/stock-adjustments/domain";

describe("stock adjustments domain core", () => {
  describe("calculateNewQuantity", () => {
    it("adds adjustment quantity to current quantity when type is IN", () => {
      expect(calculateNewQuantity(10, 5, "IN")).toBe(15);
      expect(calculateNewQuantity(0, 50, "IN")).toBe(50);
    });

    it("subtracts adjustment quantity from current quantity when type is OUT", () => {
      expect(calculateNewQuantity(20, 5, "OUT")).toBe(15);
      expect(calculateNewQuantity(10, 10, "OUT")).toBe(0);
    });

    it("throws an error when type is OUT and adjustment quantity exceeds current quantity", () => {
      expect(() => calculateNewQuantity(5, 10, "OUT")).toThrow(
        "Insufficient stock for deduction",
      );
      expect(() => calculateNewQuantity(0, 1, "OUT")).toThrow(
        "Insufficient stock for deduction",
      );
    });
  });

  describe("validateStockAvailability", () => {
    it("returns valid: true when type is IN regardless of current stock", () => {
      expect(validateStockAvailability(0, 100, "IN")).toEqual({ valid: true });
      expect(validateStockAvailability(50, 10, "IN")).toEqual({ valid: true });
    });

    it("returns valid: true when type is OUT and current stock exceeds adjustment quantity", () => {
      expect(validateStockAvailability(20, 5, "OUT")).toEqual({ valid: true });
    });

    it("returns valid: true when type is OUT and current stock exactly equals adjustment quantity", () => {
      expect(validateStockAvailability(10, 10, "OUT")).toEqual({ valid: true });
    });

    it("returns valid: false with error when type is OUT and current stock is less than adjustment quantity", () => {
      const result = validateStockAvailability(5, 10, "OUT");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Insufficient stock for deduction");
    });

    it("returns valid: false when type is OUT and current stock is zero", () => {
      const result = validateStockAvailability(0, 1, "OUT");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Insufficient stock for deduction");
    });
  });

  describe("validateAdjustmentReason", () => {
    it("returns valid: true for reasons within 5 to 255 characters", () => {
      expect(
        validateAdjustmentReason("Restock received from supplier"),
      ).toEqual({
        valid: true,
      });
    });

    it("returns valid: true at exact boundaries of 5 and 255 characters", () => {
      const minReason = "12345";
      const maxReason = "a".repeat(255);
      expect(validateAdjustmentReason(minReason)).toEqual({ valid: true });
      expect(validateAdjustmentReason(maxReason)).toEqual({ valid: true });
    });

    it("trims surrounding whitespace before validating length", () => {
      expect(
        validateAdjustmentReason("   valid reason with whitespace   "),
      ).toEqual({
        valid: true,
      });
    });

    it("returns valid: false when trimmed reason is fewer than 5 characters", () => {
      const result1 = validateAdjustmentReason("four");
      expect(result1.valid).toBe(false);
      expect(result1.error).toBeDefined();

      const result2 = validateAdjustmentReason("   a   ");
      expect(result2.valid).toBe(false);
      expect(result2.error).toBeDefined();

      const result3 = validateAdjustmentReason("");
      expect(result3.valid).toBe(false);
      expect(result3.error).toBeDefined();
    });

    it("returns valid: false when trimmed reason exceeds 255 characters", () => {
      const tooLong = "a".repeat(256);
      const result = validateAdjustmentReason(tooLong);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
