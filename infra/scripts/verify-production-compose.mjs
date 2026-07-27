#!/usr/bin/env node

const baseUrl = (process.env.COMPOSE_BASE_URL ?? process.env.PRODUCTION_BASE_URL ?? "http://localhost").replace(/\/$/, "");
const publicOrigin = process.env.COMPOSE_PUBLIC_ORIGIN ?? process.env.PUBLIC_ORIGIN ?? "https://committee.example.test";
const requestId = process.env.COMPOSE_REQUEST_ID ?? `composition-check-${Date.now()}`;
const timeoutMs = Number(process.env.COMPOSE_VERIFY_TIMEOUT_MS ?? 5000);

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

console.log(JSON.stringify({ baseUrl, checks: ["health", "auth-session-routing", "unsafe-origin-rejection", "request-id-propagation"] }));
