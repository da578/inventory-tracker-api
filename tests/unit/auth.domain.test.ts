import { describe, expect, it } from "bun:test";
import {
  calculateTokenExpiry,
  hasRequiredRole,
  isTokenExpired,
} from "../../src/modules/auth/domain";

describe("auth domain core", () => {
  describe("isTokenExpired", () => {
    it("returns true when expiresAt is before now", () => {
      const now = new Date("2026-11-07T12:00:00Z");
      const past = new Date("2026-11-07T11:59:59Z");
      expect(isTokenExpired(past, now)).toBe(true);
    });

    it("returns true when expiresAt is exactly now (boundary condition <= now)", () => {
      const now = new Date("2026-11-07T12:00:00Z");
      expect(isTokenExpired(now, now)).toBe(true);
    });

    it("returns false when expiresAt is strictly after now", () => {
      const now = new Date("2026-11-07T12:00:00Z");
      const future = new Date("2026-11-07T12:00:01Z");
      expect(isTokenExpired(future, now)).toBe(false);
    });

    it("defaults to current timestamp when now is omitted", () => {
      const past = new Date(Date.now() - 5000);
      const future = new Date(Date.now() + 5000);
      expect(isTokenExpired(past)).toBe(true);
      expect(isTokenExpired(future)).toBe(false);
    });
  });

  describe("calculateTokenExpiry", () => {
    it("calculates exact future date based on duration and from timestamp", () => {
      const base = new Date("2026-11-07T12:00:00.000Z");
      const durationMs = 3 * 24 * 60 * 60 * 1000; // 3 days
      const result = calculateTokenExpiry(durationMs, base);

      expect(result.toISOString()).toBe("2026-11-10T12:00:00.000Z");
      expect(result.getTime()).toBe(base.getTime() + durationMs);
    });

    it("defaults from parameter to current time", () => {
      const durationMs = 60 * 1000;
      const before = Date.now();
      const result = calculateTokenExpiry(durationMs);
      const after = Date.now();

      expect(result.getTime()).toBeGreaterThanOrEqual(before + durationMs);
      expect(result.getTime()).toBeLessThanOrEqual(after + durationMs);
    });
  });

  describe("hasRequiredRole", () => {
    it("returns true when user role matches allowed single role", () => {
      expect(hasRequiredRole("admin", ["admin"])).toBe(true);
      expect(hasRequiredRole("staff", ["staff"])).toBe(true);
    });

    it("returns true when user role is included in allowed role list", () => {
      const allowedRoles = ["admin", "staff"] as const;
      expect(hasRequiredRole("admin", allowedRoles)).toBe(true);
      expect(hasRequiredRole("staff", allowedRoles)).toBe(true);
    });

    it("returns false when user role is not included in allowed role list", () => {
      expect(hasRequiredRole("staff", ["admin"])).toBe(false);
      expect(hasRequiredRole("admin", ["staff"])).toBe(false);
    });

    it("returns false when allowed roles list is empty", () => {
      expect(hasRequiredRole("admin", [])).toBe(false);
    });
  });
});
