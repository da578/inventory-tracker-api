import Elysia from "elysia";
import { logHttpRequest } from "../../config/logger";

/**
 * Middleware to generate and propagate a unique Request ID for every incoming request.
 *
 * @remarks
 * If the client provides an `X-Request-ID` header, it will be used.
 * Otherwise, a new UUID v4 is generated. This ID is added to the Elysia context
 * and can be used for distributed tracing and structured logging.
 *
 * @public
 */
export const requestIdMiddleware = new Elysia({
  name: "request-id-middleware",
})
  .as("global")
  .onRequest(({ request, set }) => {
    const requestId =
      request.headers.get("x-request-id") || crypto.randomUUID();
    set.headers["x-request-id"] = requestId;
  })
  .derive(({ request, set }) => {
    const requestId =
      (set.headers["x-request-id"] as string) ||
      request.headers.get("x-request-id") ||
      crypto.randomUUID();
    const startTime = performance.now();
    return {
      requestId,
      startTime,
    };
  })
  .onAfterResponse(({ requestId, startTime, set, request }) => {
    const latencyMs = Number((performance.now() - startTime).toFixed(2));
    const statusCode = typeof set.status === "number" ? set.status : 200;

    logHttpRequest(
      requestId,
      request.method,
      request.url,
      statusCode,
      latencyMs,
    );
  });
