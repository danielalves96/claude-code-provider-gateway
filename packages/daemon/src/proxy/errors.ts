export type AnthropicErrorType =
  | "authentication_error"
  | "not_found_error"
  | "rate_limit_error"
  | "api_error";

export type ErrorStatus = 400 | 401 | 403 | 404 | 429 | 500;

export interface AnthropicErrorResponse {
  type: "error";
  error: {
    type: AnthropicErrorType;
    message: string;
  };
}

export function anthropicError(type: AnthropicErrorType, message: string): AnthropicErrorResponse {
  return { type: "error", error: { type, message } };
}

export function providerErrorType(status: number): AnthropicErrorType {
  if (status === 429) return "rate_limit_error";
  if (status === 401) return "authentication_error";
  if (status === 404) return "not_found_error";
  return "api_error";
}

export function providerErrorStatus(status: number): ErrorStatus {
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 429) {
    return status;
  }
  return 500;
}
