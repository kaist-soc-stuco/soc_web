#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function fail(message) {
  throw new Error(`Production environment verification failed: ${message}`);
}

function parseArgs(argv) {
  if (argv.length === 0) return ".env";
  if (argv.length !== 2 || argv[0] !== "--env-file") fail("usage: verify-production-env.mjs [--env-file <path>]");
  return argv[1];
}

function parseEnv(source) {
  const values = new Map();
  for (const [index, rawLine] of source.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) fail(`invalid assignment on line ${index + 1}`);
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function required(values, key) {
  const value = values.get(key)?.trim();
  if (!value) fail(`${key} is required`);
  return value;
}

function rejectPlaceholder(key, value) {
  if (/<[^>]+>/u.test(value) || /REPLACE_WITH|CHANGE_ME|PLACEHOLDER/iu.test(value) || value === "local-development" || value === "localhost") {
    fail(`${key} still contains a placeholder or development value`);
  }
}

function requireHttps(key, value, { path } = {}) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${key} must be a valid URL`);
  }
  if (parsed.protocol !== "https:") fail(`${key} must use HTTPS`);
  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) fail(`${key} must not target a loopback host`);
  if (path && parsed.pathname !== path) fail(`${key} must use the exact path ${path}`);
}

const envPath = resolve(process.cwd(), parseArgs(process.argv.slice(2)));
let source;
try {
  source = await readFile(envPath, "utf8");
} catch {
  fail(`environment file not found: ${envPath}`);
}
const values = parseEnv(source);

if (required(values, "NODE_ENV") !== "production") fail("NODE_ENV must be production");
requireHttps("PUBLIC_ORIGIN", required(values, "PUBLIC_ORIGIN"));
requireHttps("VITE_SSO_REDIRECT_URI", required(values, "VITE_SSO_REDIRECT_URI"), { path: "/api/auth/login" });
requireHttps("VITE_SSO_LOGIN_URL", required(values, "VITE_SSO_LOGIN_URL"));
requireHttps("SSO_AUTH_API_URL", required(values, "SSO_AUTH_API_URL"));

for (const key of ["VITE_SSO_CLIENT_ID", "SSO_CLIENT_SECRET", "POSTGRES_PASSWORD", "AUTH_JWT_ACTIVE_KID", "AUTH_JWT_ES256_PRIVATE_KEY", "AUTH_JWT_PUBLIC_KEYS_JSON", "AUTH_JWT_ISSUER", "AUTH_JWT_AUDIENCE", "AUTH_PENDING_LOGIN_ENCRYPTION_KEY", "PII_ENCRYPTION_ACTIVE_KID", "PII_ENCRYPTION_KEYS_JSON", "SURVEY_PHONE_HASH_HMAC_KEY", "SURVEY_PHONE_HASH_HMAC_VERSION"]) {
  const value = required(values, key);
  rejectPlaceholder(key, value);
}

for (const key of ["POSTGRES_DB", "POSTGRES_USER", "DATABASE_URL"]) required(values, key);
const databaseUrl = required(values, "DATABASE_URL");
let parsedDatabaseUrl;
try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  fail("DATABASE_URL must be a valid PostgreSQL URL");
}
if (!["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol)) fail("DATABASE_URL must use the PostgreSQL protocol");
if (["localhost", "127.0.0.1", "::1"].includes(parsedDatabaseUrl.hostname)) fail("DATABASE_URL must target the Compose PostgreSQL service or an approved remote database, not localhost");

console.log(JSON.stringify({ ok: true, environmentFile: envPath, nodeEnv: "production" }));
