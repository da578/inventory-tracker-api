import { describe, expect, it } from "bun:test";
import {
  calculatePaginationMeta,
  escapeLikePattern,
  isLowStock,
} from "../../src/modules/products/domain";

describe("products domain core", () => {
  describe("isLowStock", () => {
    it("returns true when quantity is strictly less than threshold", () => {
      expect(isLowStock(3, 10)).toBe(true);
    });

    it("returns true when quantity equals threshold (boundary condition <= threshold)", () => {
      expect(isLowStock(10, 10)).toBe(true);
      expect(isLowStock(0, 0)).toBe(true);
    });

    it("returns false when quantity is strictly greater than threshold", () => {
      expect(isLowStock(11, 10)).toBe(false);
      expect(isLowStock(1, 0)).toBe(false);
    });
  });

  describe("calculatePaginationMeta", () => {
    it("returns totalPages: 1 when total is 0", () => {
      const meta = calculatePaginationMeta(0, 1, 10);
      expect(meta).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      });
    });

    it("performs ceiling division when total is not an exact multiple of limit", () => {
      const meta = calculatePaginationMeta(25, 1, 10);
      expect(meta).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it("calculates exact totalPages when total is evenly divisible by limit", () => {
      const meta = calculatePaginationMeta(20, 2, 10);
      expect(meta).toEqual({
        page: 2,
        limit: 10,
        total: 20,
        totalPages: 2,
      });
    });

    it("handles total smaller than limit by returning 1 totalPage", () => {
      const meta = calculatePaginationMeta(5, 1, 20);
      expect(meta).toEqual({
        page: 1,
        limit: 20,
        total: 5,
        totalPages: 1,
      });
    });
  });

  describe("escapeLikePattern", () => {
    it("escapes SQL percent (%) wildcard", () => {
      expect(escapeLikePattern("100%")).toBe("100\\%");
    });

    it("escapes SQL underscore (_) wildcard", () => {
      expect(escapeLikePattern("item_1")).toBe("item\\_1");
    });

    it("escapes SQL backslash (\\)", () => {
      expect(escapeLikePattern("folder\\file")).toBe("folder\\\\file");
    });

    it("escapes combined wildcard characters in a single string", () => {
      expect(escapeLikePattern("50%_off\\promo")).toBe("50\\%\\_off\\\\promo");
    });

    it("returns regular text without modifying characters", () => {
      expect(escapeLikePattern("sku-12345 Regular Name")).toBe(
        "sku-12345 Regular Name",
      );
    });

    it("handles empty string input", () => {
      expect(escapeLikePattern("")).toBe("");
    });
  });
});
