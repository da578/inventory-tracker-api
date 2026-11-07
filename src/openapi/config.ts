import { openapi } from "@elysia/openapi";

/**
 * OpenAPI documentation configuration for Elysia.
 *
 * @remarks
 * Exposes OpenAPI JSON schema at `/openapi/json` and interactive UI at `/openapi`.
 * Configures bearer token authentication scheme for secured endpoints.
 * ponytail: static OpenAPI definition; upgrade to dynamic tenant/versioned specs if multi-version API gateways are introduced.
 *
 * @public
 */
export const openApiConfig = openapi({
  path: "/openapi",
  embedSpec: true,
  documentation: {
    info: {
      title: "Inventory Tracker API",
      version: "1.0.0",
      description: "API documentation for the Inventory Stock Tracker system",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
});
