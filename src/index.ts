/**
 * Main entry point for the Inventory Stock Tracker API.
 *
 * @remarks
 * This file initializes the Elysia application, registers global plugins,
 * configures error handling, and starts the HTTP server.
 *
 * @public
 */
import { Elysia } from "elysia";
import {
  type HttpRequestLogData,
  logError,
  logHttpRequest,
} from "./config/logger";
import { authModule } from "./modules/auth";
import { categoriesModule } from "./modules/categories";
import { healthModule } from "./modules/health";
import { productsModule } from "./modules/products";
import type { PaginationMeta } from "./modules/products/domain";
import { stockAdjustmentsModule } from "./modules/stock-adjustments";
import { suppliersModule } from "./modules/suppliers";
import { openApiConfig } from "./openapi/config";
import { AppError } from "./shared/errors/app-error";
import { authPlugin } from "./shared/middleware/auth";
import { requestIdMiddleware } from "./shared/middleware/request-id";

export {
  AppError,
  authModule,
  categoriesModule,
  type HttpRequestLogData,
  healthModule,
  logError,
  logHttpRequest,
  openApiConfig,
  type PaginationMeta,
  productsModule,
  stockAdjustmentsModule,
  suppliersModule,
};

/**
 * The main Elysia application instance.
 * Exported to allow type inference for Eden Treaty (End-to-End Type Safety).
 */
export const app = new Elysia()
  .error({
    AppError,
  })
  .onError(({ code, error, request, set }) => {
    const requestId = request.headers.get("x-request-id") || "unknown";
    const context = { requestId, path: request.url, method: request.method };

    logError(
      error instanceof Error ? error : new Error(String(error)),
      context,
    );

    if (error instanceof AppError) {
      set.status = error.statusCode;
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };
    }

    const isProd =
      process.env.NODE_ENV === "production" ||
      process.env.APP_ENV === "production";

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request payload",
          details: isProd ? undefined : error.all,
        },
      };
    }

    set.status = 500;
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: isProd
          ? "An unexpected error occurred. Please try again later."
          : error instanceof Error
            ? error.message
            : String(error),
      },
    };
  })
  .use(openApiConfig)
  .use(requestIdMiddleware)
  .use(authPlugin)
  .use(authModule)
  .use(categoriesModule)
  .use(suppliersModule)
  .use(productsModule)
  .use(stockAdjustmentsModule)
  .use(healthModule)
  .get("/", () => ({
    success: true,
    data: { message: "Inventory Stock Tracker API is running" },
  }));

function resolveServerPort(): number {
  if (process.env.PORT) {
    return parseInt(process.env.PORT, 10);
  }
  if (process.env.APP_PORT) {
    return parseInt(process.env.APP_PORT, 10);
  }
  return 3000;
}

if (require.main === module) {
  const port = resolveServerPort();
  app.listen(port, () => {
    console.log(`🦊 Elysia is running at http://localhost:${port}`);
    console.log(`📚 OpenAPI Documentation: http://localhost:${port}/openapi`);
  });
}
