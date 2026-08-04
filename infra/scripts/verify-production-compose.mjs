#!/usr/bin/env node

const baseUrl = (process.env.COMPOSE_BASE_URL ?? process.env.PRODUCTION_BASE_URL ?? "http://localhost").replace(/\/$/, "");
const publicOrigin = process.env.COMPOSE_PUBLIC_ORIGIN ?? process.env.PUBLIC_ORIGIN ?? "https://committee.example.test";
const requestId = process.env.COMPOSE_REQUEST_ID ?? `composition-check-${Date.now()}`;
const timeoutMs = Number(process.env.COMPOSE_VERIFY_TIMEOUT_MS ?? 5000);
const surveyResponsePurgeEnabled = process.env.SURVEY_RESPONSE_PURGE_ENABLED === "true";
const surveyResponsePurgeCadenceSeconds = Number(process.env.SURVEY_RESPONSE_PURGE_CADENCE_SECONDS ?? 900);
const surveyResponsePurgeAlertOwner = process.env.SURVEY_RESPONSE_PURGE_ALERT_OWNER?.trim();
const surveyResponsePurgeAlertSink = process.env.SURVEY_RESPONSE_PURGE_ALERT_SINK?.trim();
if (surveyResponsePurgeEnabled) {
  if (surveyResponsePurgeCadenceSeconds !== 900) {
    fail("SURVEY_RESPONSE_PURGE_CADENCE_SECONDS must equal 900 when survey-response retention is enabled");
  }
  if (!surveyResponsePurgeAlertOwner || !surveyResponsePurgeAlertSink) {
    fail("SURVEY_RESPONSE_PURGE_ALERT_OWNER and SURVEY_RESPONSE_PURGE_ALERT_SINK are required when survey-response retention is enabled");
  }
  let alertSink;
  try {
    alertSink = new URL(surveyResponsePurgeAlertSink);
  } catch {
    fail("SURVEY_RESPONSE_PURGE_ALERT_SINK must be an HTTP(S) URL");
  }
  if (!["http:", "https:"].includes(alertSink.protocol)) {
    fail("SURVEY_RESPONSE_PURGE_ALERT_SINK must be an HTTP(S) URL");
  }
}

function fail(message) {
  throw new Error(`Production composition verification failed: ${message}`);
}

async function probe(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { "X-Request-ID": requestId, ...(options.headers ?? {}) },
    });
  } catch (error) {
    const reason = error.name === "AbortError" ? `timed out after ${timeoutMs}ms` : error.message;
    fail(`${path} is unavailable at ${baseUrl}: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

const health = await probe("/health");
if (!health.ok) fail(`/health returned HTTP ${health.status}`);

const expectedSecurityHeaders = new Map([
  ["content-security-policy", "frame-ancestors 'none'"],
  ["permissions-policy", "camera=()"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["strict-transport-security", "max-age=31536000"],
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
]);
for (const [header, expected] of expectedSecurityHeaders) {
  const actual = health.headers.get(header);
  if (!actual?.includes(expected)) fail(`${header} security header is missing or invalid`);
}

const session = await probe("/api/auth/session", { headers: { Origin: publicOrigin } });
if (session.status === 404) fail("/api/auth/session returned 404; proxy prefix is not reaching the API /api/ routes");
if (![200, 401].includes(session.status)) {
  fail(`/api/auth/session returned unexpected HTTP ${session.status}`);
}

const unsafe = await probe("/api/auth/session", {
  method: "POST",
  headers: { Origin: `${publicOrigin}/unexpected` },
});
if (unsafe.status !== 403) fail(`unsafe request with an unsafe Origin returned HTTP ${unsafe.status}, expected 403`);
const responseRequestId = unsafe.headers.get("x-request-id");
if (responseRequestId !== requestId) {
  fail(`X-Request-ID was not propagated (sent ${requestId}, received ${responseRequestId ?? "none"})`);
}

console.log(JSON.stringify({
  baseUrl,
  checks: ["health", "security-headers", "auth-session-routing", "unsafe-origin-rejection", "request-id-propagation", "survey-response-retention-gate"],
  surveyResponseRetention: surveyResponsePurgeEnabled
    ? {
        cadenceSeconds: surveyResponsePurgeCadenceSeconds,
        alertOwner: surveyResponsePurgeAlertOwner,
        alertSink: surveyResponsePurgeAlertSink,
      }
    : { enabled: false },
}));
