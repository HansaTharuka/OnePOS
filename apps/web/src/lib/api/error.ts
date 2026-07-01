export interface FieldError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors?: FieldError[];

  constructor(status: number, message: string, fieldErrors?: FieldError[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * The API returns two different error shapes depending on which validation layer rejected the
 * request: the Zod pipe returns a bare array of `{path,message}`, everything else (Nest's
 * built-in exceptions) returns `{statusCode,message,error}`. Normalize both into one ApiError.
 */
export async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return new ApiError(res.status, res.statusText || "Request failed");
  }

  if (Array.isArray(body)) {
    const fieldErrors = body as FieldError[];
    const message = fieldErrors.map((e) => e.message).join(", ") || "Validation failed";
    return new ApiError(res.status, message, fieldErrors);
  }

  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    return new ApiError(res.status, typeof message === "string" ? message : "Request failed");
  }

  return new ApiError(res.status, "Request failed");
}
