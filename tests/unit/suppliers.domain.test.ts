import { describe, expect, it } from "bun:test";
import {
  validateSupplierContact,
  validateSupplierName,
} from "../../src/modules/suppliers/domain";

describe("Suppliers Domain - Functional Core", () => {
  it("validates supplier name length between 2 and 150 characters", () => {
    expect(validateSupplierName("PT Acme")).toEqual({ valid: true });
    expect(validateSupplierName("A".repeat(150))).toEqual({ valid: true });
    expect(validateSupplierName("A").valid).toBe(false);
    expect(validateSupplierName("   A   ").valid).toBe(false);
    expect(validateSupplierName("A".repeat(151)).valid).toBe(false);
  });

  it("validates optional contact email and phone correctly", () => {
    // Both undefined/null is valid
    expect(validateSupplierContact(undefined, undefined)).toEqual({
      valid: true,
    });
    expect(validateSupplierContact(null, null)).toEqual({ valid: true });

    // Valid contact
    expect(validateSupplierContact("sales@example.com", "08123456789")).toEqual(
      { valid: true },
    );

    // Invalid phone: less than 8 characters
    const phoneRes = validateSupplierContact("sales@example.com", "1234567");
    expect(phoneRes.valid).toBe(false);
    expect(phoneRes.error).toContain("at least 8 characters");

    // Invalid email format
    const emailRes = validateSupplierContact("notanemail", "08123456789");
    expect(emailRes.valid).toBe(false);
    expect(emailRes.error).toContain("valid email");
  });
});
