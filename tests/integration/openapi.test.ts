import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { openApiConfig } from "../../src/openapi/config";

describe("OpenAPI configuration", () => {
  it("mounts openApiConfig into an Elysia app", () => {
    const app = new Elysia().use(openApiConfig);
    expect(app).toBeDefined();
  });

  it("serves OpenAPI JSON spec with expected metadata and security schemes", async () => {
    const app = new Elysia().use(openApiConfig);
    const response = await app.handle(
      new Request("http://localhost/openapi/json"),
    );

    expect(response.status).toBe(200);

    const spec = (await response.json()) as {
      info: { title: string; version: string; description?: string };
      components?: {
        securitySchemes?: {
          bearerAuth?: {
            type: string;
            scheme: string;
            bearerFormat?: string;
          };
        };
      };
    };

    expect(spec.info.title).toBe("Inventory Tracker API");
    expect(spec.info.version).toBe("1.0.0");
    expect(spec.info.description).toBeDefined();
    expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(spec.components?.securitySchemes?.bearerAuth?.type).toBe("http");
    expect(spec.components?.securitySchemes?.bearerAuth?.scheme).toBe("bearer");
    expect(spec.components?.securitySchemes?.bearerAuth?.bearerFormat).toBe(
      "JWT",
    );
  });

  it("serves OpenAPI documentation UI endpoint", async () => {
    const app = new Elysia().use(openApiConfig);
    const response = await app.handle(new Request("http://localhost/openapi"));

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html.length).toBeGreaterThan(0);
  });
});
