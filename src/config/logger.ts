import pino from "pino";

/**
 * Structured logger instance configured via Pino.
 * Silenced in test environments unless overridden by LOG_LEVEL.
 * ponytail: uses synchronous stdout logging; upgrade to pino.transport worker thread under high-throughput I/O pressure.
 */
export const logger = pino({
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "test" ? "silent" : "info"),
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Data payload for logging an HTTP request.
 */
export interface HttpRequestLogData {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
}

/**
 * Logs an error with structured context.
 *
 * @param error - The error object or unknown failure value.
 * @param context - Optional additional metadata to include with the log.
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (error instanceof Error) {
    logger.error(
      {
        err: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        ...context,
      },
      error.message,
    );
    return;
  }

  logger.error(
    {
      err: error,
      ...context,
    },
    typeof error === "string" ? error : "An unexpected error occurred",
  );
}

/**
 * Logs details about an incoming HTTP request and its response.
 *
 * @param data - Structured HTTP request log details.
 */
export function logHttpRequest(data: HttpRequestLogData): void;
/**
 * Logs details about an incoming HTTP request using positional parameters.
 *
 * @param requestId - Unique request identifier.
 * @param method - HTTP request method.
 * @param path - Target URL path.
 * @param statusCode - HTTP response status code.
 * @param latencyMs - Request processing duration in milliseconds.
 */
export function logHttpRequest(
  requestId: string,
  method: string,
  path: string,
  statusCode: number,
  latencyMs: number,
): void;
export function logHttpRequest(
  dataOrRequestId: HttpRequestLogData | string,
  method?: string,
  path?: string,
  statusCode?: number,
  latencyMs?: number,
): void {
  if (typeof dataOrRequestId === "string") {
    logger.info(
      {
        requestId: dataOrRequestId,
        method: method ?? "",
        path: path ?? "",
        statusCode: statusCode ?? 0,
        latencyMs: latencyMs ?? 0,
      },
      "HTTP Request",
    );
    return;
  }

  logger.info(
    {
      requestId: dataOrRequestId.requestId,
      method: dataOrRequestId.method,
      path: dataOrRequestId.path,
      statusCode: dataOrRequestId.statusCode,
      latencyMs: dataOrRequestId.latencyMs,
    },
    "HTTP Request",
  );
}
