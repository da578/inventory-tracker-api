/**
 * Custom application error class for standardized error handling.
 *
 * @remarks
 * This class extends the native Error and includes additional properties
 * to ensure consistent error responses across the API, aligning with
 * the Standard Error Response contract.
 *
 * @public
 */
export class AppError extends Error {
  /**
   * Machine-readable error code (e.g., 'VALIDATION_ERROR', 'NOT_FOUND').
   */
  public readonly code: string;

  /**
   * HTTP status code corresponding to the error.
   */
  public readonly statusCode: number;

  /**
   * Optional additional context or details about the error.
   */
  public readonly details?: Record<string, unknown>;

  /**
   * Creates a new AppError instance.
   *
   * @param code - Machine-readable error code.
   * @param message - Human-readable error message.
   * @param statusCode - HTTP status code. Defaults to 500.
   * @param details - Optional error details.
   *
   * @example
   * ```ts
   * throw new AppError('NOT_FOUND', 'Product not found', 404);
   * ```
   */
  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;

    if (details) {
      this.details = details;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}
