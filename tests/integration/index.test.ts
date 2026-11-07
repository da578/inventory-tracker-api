import { describe, expect, it } from "bun:test";
import { app } from "../../src/index";

describe("Root App Pipeline (src/index.ts)", () => {
  it("responds to GET / with service status", async () => {
    const res = await app.handle(new Request("http://localhost/"));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      success: boolean;
      data: { message: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.message).toBe("Inventory Stock Tracker API is running");
    expect(res.headers.get("x-request-id")).toBeDefined();
  });

  it("serves mounted openApiConfig documentation", async () => {
    const res = await app.handle(new Request("http://localhost/openapi/json"));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { info: { title: string } };
    expect(body.info.title).toBe("Inventory Tracker API");
  });

  it("serves mounted healthModule", async () => {
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      success: boolean;
      data: { status: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
  });

  it("handles validation errors properly through onError hook", async () => {
    const res = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalidField: "test" }),
      }),
    );
    expect(res.status).toBe(400);

    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("handles AppError through onError hook", async () => {
    // Calling protected route without auth token throws AppError UNAUTHORIZED
    const res = await app.handle(new Request("http://localhost/auth/me"));
    expect(res.status).toBe(401);

    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("preserves incoming X-Request-ID header", async () => {
    const testId = "custom-test-request-id-123";
    const res = await app.handle(
      new Request("http://localhost/", {
        headers: { "x-request-id": testId },
      }),
    );
    expect(res.headers.get("x-request-id")).toBe(testId);
  });
});
