export type ApplicationErrorCode =
  "VALIDATION_ERROR" | "REFERENCE_HAS_HISTORY" | "REFERENCE_HAS_SETTLEMENT_HISTORY" | "INVALID_REFERENCE" | "PERSISTENCE_ERROR";

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;

  constructor(code: ApplicationErrorCode, message: string) {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
