import { describe, expect, it } from "bun:test";
import { validateCategoryName } from "../../src/modules/categories/domain";

describe("Categories Domain - Functional Core", () => {
  it("accepts valid category name within 3 to 100 characters", () => {
    expect(validateCategoryName("Hardware")).toEqual({ valid: true });
    expect(validateCategoryName("ABC")).toEqual({ valid: true });
    expect(validateCategoryName("A".repeat(100))).toEqual({ valid: true });
  });

  it("rejects names shorter than 3 characters after trimming", () => {
    const result1 = validateCategoryName("AB");
    expect(result1.valid).toBe(false);
    expect(result1.error).toContain("between 3 and 100");

    const result2 = validateCategoryName("   A   ");
    expect(result2.valid).toBe(false);
  });

  it("rejects names longer than 100 characters", () => {
    const result = validateCategoryName("A".repeat(101));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("between 3 and 100");
  });
});
