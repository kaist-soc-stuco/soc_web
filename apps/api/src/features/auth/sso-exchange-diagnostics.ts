const TRANSPORT_ERRORS = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET",
  "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_TLS_CERT_ALTNAME_INVALID",
]);
const ERROR_NAMES = new Set(["Error", "TypeError", "SyntaxError", "TimeoutError", "AbortError", "BoundedFetchError"]);
const RESPONSE_TYPES = new Set(["application/json", "text/json", "text/html", "text/plain"]);
const objectValue = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const diagnosticMarker = (value: unknown, secrets: readonly string[]): string => {
  if (value == null || value === false || typeof value === "string" && !value.trim()) return "empty";
  const marker = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  if (secrets.some(secret => secret && marker.toLowerCase().includes(secret.toLowerCase()))) return "redacted";
  // Preserve machine codes, including codes absent from the guide, but not arbitrary text or identifiers.
  return marker.length <= 80 && !/\d{7,}/.test(marker) && /^(?:[a-z]{1,12}\d{2,6}|[a-z][a-z0-9]*(?:_[a-z0-9]+)+|\d{1,6})$/i.test(marker)
    ? marker : "unrecognized";
};

/** Only fixed labels and known diagnostic codes are logged; never a body, profile, code, state, or secret. */
export function describeSsoExchangeFailure(input: {
  kind: "http_error" | "provider_error" | "invalid_response" | "invalid_json" | "response_read_error" | "exception";
  response?: Response;
  payload?: unknown;
  error?: unknown;
  secrets?: readonly string[];
}): string {
  const detail: Record<string, string | number> = { kind: input.kind };
  if (input.response) {
    detail.httpStatus = input.response.status;
    const mime = input.response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    detail.contentType = mime && RESPONSE_TYPES.has(mime) ? mime : "other";
  }
  const payload = objectValue(input.payload);
  if (payload && ("error" in payload || "errorCode" in payload)) {
    detail.providerCode = diagnosticMarker(payload.errorCode, input.secrets ?? []);
    detail.providerError = diagnosticMarker(payload.error, input.secrets ?? []);
  }
  const error = objectValue(input.error);
  if (error) {
    detail.exception = typeof error.name === "string" && ERROR_NAMES.has(error.name) ? error.name : "Error";
    const code = objectValue(error.cause)?.code ?? error.code;
    if (typeof code === "string" && TRANSPORT_ERRORS.has(code)) detail.transportCode = code;
  }
  return `SSO callback failed at exchange: ${JSON.stringify(detail)}`;
}
