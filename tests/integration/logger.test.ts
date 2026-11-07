import { describe, expect, it } from "bun:test";
import { logError, logger, logHttpRequest } from "../../src/config/logger";

describe("Logger configuration", () => {
  it("exports a pino logger instance with standard logging methods", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  describe("logError", () => {
    it("logs Error instances with context without throwing", () => {
      const err = new Error("Database connection failed");
      expect(() => {
        logError(err, { requestId: "req-abc-123", operation: "query" });
      }).not.toThrow();
    });

    it("logs non-Error values and handles missing context without throwing", () => {
      expect(() => {
        logError("Unknown string failure");
      }).not.toThrow();

      expect(() => {
        logError({ message: "Custom object error" });
      }).not.toThrow();
    });
  });

  describe("logHttpRequest", () => {
    it("logs request data with object signature without throwing", () => {
      expect(() => {
        logHttpRequest({
          requestId: "req-xyz-789",
          method: "GET",
          path: "/api/v1/products",
          statusCode: 200,
          latencyMs: 15.42,
        });
      }).not.toThrow();
    });

    it("logs request data with positional arguments without throwing", () => {
      expect(() => {
        logHttpRequest("req-xyz-789", "POST", "/api/v1/auth/login", 201, 45.1);
      }).not.toThrow();
    });
  });
});
