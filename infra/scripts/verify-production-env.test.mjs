import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const script = join(process.cwd(), "infra/scripts/verify-production-env.mjs");

const validEnv = `NODE_ENV=production
PUBLIC_ORIGIN=https://committee.example.test
VITE_SSO_REDIRECT_URI=https://committee.example.test/api/auth/login
VITE_SSO_LOGIN_URL=https://sso.kaist.ac.kr/auth/user/single/login/authorize
SSO_AUTH_API_URL=https://sso.kaist.ac.kr/auth/api/single/auth
VITE_SSO_CLIENT_ID=issued-client-id
SSO_CLIENT_SECRET=issued-client-secret
POSTGRES_DB=soc_web
POSTGRES_USER=soc_prod
POSTGRES_PASSWORD=long-random-password
DATABASE_URL=postgresql://soc_prod:long-random-password@postgres:5432/soc_web?sslmode=disable
AUTH_JWT_ACTIVE_KID=prod-01
AUTH_JWT_ES256_PRIVATE_KEY=private-key
AUTH_JWT_PUBLIC_KEYS_JSON={"prod-01":"public-key"}
AUTH_JWT_ISSUER=soc-web-production
AUTH_JWT_AUDIENCE=soc-api
AUTH_PENDING_LOGIN_ENCRYPTION_KEY=random-key
PII_ENCRYPTION_ACTIVE_KID=pii-01
PII_ENCRYPTION_KEYS_JSON={"pii-01":"random-key"}
SURVEY_PHONE_HASH_HMAC_KEY=random-key
SURVEY_PHONE_HASH_HMAC_VERSION=prod-v1
`;

async function run(content) {
  const directory = await mkdtemp(join(tmpdir(), "soc-production-env-"));
  const envPath = join(directory, ".env");
  await writeFile(envPath, content);
  return execFileAsync(process.execPath, [script, "--env-file", envPath]);
}

test("accepts a complete production environment", async () => {
  const result = await run(validEnv);
  assert.match(result.stdout, /"ok":true/);
});

test("rejects local SSO configuration", async () => {
  await assert.rejects(run(validEnv.replace("VITE_SSO_CLIENT_ID=issued-client-id", "VITE_SSO_CLIENT_ID=local-development")), /development value/);
});

test("rejects localhost database configuration", async () => {
  await assert.rejects(run(validEnv.replace("@postgres:5432", "@localhost:5432")), /localhost/);
});
