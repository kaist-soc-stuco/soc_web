const assert = require("node:assert/strict");
const test = require("node:test");

const {
  validateEnv,
} = require("../dist/apps/api/src/shared/config/env.validation.js");

const uniqueSecret = (label) => `${label}:${"x".repeat(48)}`;

const createProductionConfig = () => ({
  NODE_ENV: "production",
  API_PORT: "3000",
  POSTGRES_HOST: "postgres",
  POSTGRES_PORT: "5432",
  POSTGRES_USER: "soc",
  POSTGRES_PASSWORD: "database-password",
  POSTGRES_DB: "soc",
  REDIS_URL: "redis://redis:6379",
  REDIS_PASSWORD: uniqueSecret("redis"),
  SSO_CLIENT_ID: "client",
  SSO_LOGIN_URL: "https://sso.invalid/login",
  SSO_REDIRECT_URI: "https://soc.invalid/v1/auth/login",
  SSO_AUTH_API_URL: "https://sso.invalid/token",
  SSO_CLIENT_SECRET: "provider-issued-value",
  AUTH_JWT_SECRET: uniqueSecret("jwt"),
  AUTH_PENDING_LOGIN_ENCRYPTION_KEY: uniqueSecret("pending"),
  VOTE_BALLOT_ENCRYPTION_KEY: uniqueSecret("vote"),
});

test("production accepts distinct non-placeholder secrets of at least 32 bytes", () => {
  const config = createProductionConfig();
  const validated = validateEnv(config);
  assert.equal(validated.AUTH_JWT_SECRET, config.AUTH_JWT_SECRET);
  assert.equal(validated.REDIS_PASSWORD, config.REDIS_PASSWORD);
});

test("MAIL_* settings support Gmail SSL and STARTTLS without retired SMTP names", () => {
  const config = { ...createProductionConfig(), MAIL_HOST: "smtp.gmail.com", MAIL_PORT: "465", MAIL_SECURE: "true", MAIL_USER: "sender@example.invalid", MAIL_PASS: "synthetic-app-pass", MAIL_FROM: "SoC <sender@example.invalid>" };
  const validated = validateEnv(config);
  assert.equal(validated.MAIL_HOST, "smtp.gmail.com");
  assert.equal(validated.MAIL_PORT, 465);
  assert.equal(validated.MAIL_SECURE, true);
  assert.equal(validated.MAIL_USER, config.MAIL_USER);
  assert.equal(validated.MAIL_PASS, config.MAIL_PASS);
  assert.equal(validated.MAIL_FROM, config.MAIL_FROM);
  const startTls = validateEnv({ ...config, MAIL_PORT: "587", MAIL_SECURE: "false" });
  assert.equal(startTls.MAIL_PORT, 587);
  assert.equal(startTls.MAIL_SECURE, false);
  const automaticTls = validateEnv({ ...createProductionConfig(), MAIL_PORT: "587" });
  assert.equal(automaticTls.MAIL_SECURE, false);
});

test("invalid mail ports and SSL/STARTTLS mismatches are caught before startup", () => {
  for (const MAIL_PORT of ["0", "65536", "465oops", "4.65", "invalid"]) {
    assert.throws(() => validateEnv({ ...createProductionConfig(), MAIL_PORT }), /MAIL_PORT/);
  }
  assert.throws(() => validateEnv({ ...createProductionConfig(), MAIL_PORT: "465", MAIL_SECURE: "false" }), /MAIL_SECURE/);
  assert.throws(() => validateEnv({ ...createProductionConfig(), MAIL_PORT: "587", MAIL_SECURE: "true" }), /MAIL_SECURE/);
});

test("production mode is trimmed before hardening and email defaults are applied", () => {
  const config = createProductionConfig();
  config.NODE_ENV = " production ";
  const validated = validateEnv(config);
  assert.equal(validated.NODE_ENV, "production");
  assert.equal(validated.EMAIL_DRY_RUN, false);

  config.AUTH_JWT_SECRET = "short";
  assert.throws(() => validateEnv(config), /at least 32 bytes/);
});

test("production rejects short, placeholder, missing, and reused secrets", () => {
  const short = createProductionConfig();
  short.AUTH_JWT_SECRET = "short";
  assert.throws(() => validateEnv(short), /at least 32 bytes/);

  const placeholder = createProductionConfig();
  placeholder.AUTH_PENDING_LOGIN_ENCRYPTION_KEY = [
    "replace",
    "with",
    "a",
    "long",
    "random",
    "secret",
  ].join("-");
  assert.throws(() => validateEnv(placeholder), /placeholder/);

  const missingRedisPassword = createProductionConfig();
  delete missingRedisPassword.REDIS_PASSWORD;
  assert.throws(() => validateEnv(missingRedisPassword), /REDIS_PASSWORD/);

  const reused = createProductionConfig();
  reused.VOTE_BALLOT_ENCRYPTION_KEY = reused.AUTH_JWT_SECRET;
  assert.throws(() => validateEnv(reused), /must use different production secrets/);
});

test("development remains compatible with local placeholder values", () => {
  const config = createProductionConfig();
  config.NODE_ENV = "development";
  config.AUTH_JWT_SECRET = "local";
  config.AUTH_PENDING_LOGIN_ENCRYPTION_KEY = "local";
  delete config.VOTE_BALLOT_ENCRYPTION_KEY;
  delete config.REDIS_PASSWORD;
  const validated = validateEnv(config);
  assert.equal(validated.VOTE_BALLOT_ENCRYPTION_KEY, undefined);
  assert.equal(validated.REDIS_PASSWORD, undefined);
});
