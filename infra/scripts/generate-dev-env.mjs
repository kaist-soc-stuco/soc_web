import { generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const target = resolve(root, ".env");
const template = resolve(root, ".env.example");

const targetExists = existsSync(target);
const repair = process.argv.includes("--repair");
const force = process.argv.includes("--force");
if (targetExists && !repair && !force) {
  throw new Error(".env already exists; use --repair to rotate generated secrets while preserving other settings.");
}
if (!targetExists && repair) {
  throw new Error(".env does not exist; run without --repair to create it.");
}

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  privateKeyEncoding: { format: "pem", type: "pkcs8" },
  publicKeyEncoding: { format: "pem", type: "spki" },
});
const base64 = () => randomBytes(32).toString("base64");
const jwtKid = "local-dev-2026";
const piiKid = "local-dev-pii-2026";
const values = {
  AUTH_JWT_ACTIVE_KID: jwtKid,
  AUTH_JWT_ES256_PRIVATE_KEY: JSON.stringify(privateKey),
  AUTH_JWT_PUBLIC_KEYS_JSON: JSON.stringify({ [jwtKid]: publicKey }),
  AUTH_PENDING_LOGIN_ENCRYPTION_KEY: base64(),
  PII_ENCRYPTION_ACTIVE_KID: piiKid,
  PII_ENCRYPTION_KEYS_JSON: JSON.stringify({ [piiKid]: base64() }),
  SSO_CLIENT_SECRET: base64(),
  SURVEY_PHONE_HASH_HMAC_KEY: base64(),
};
const source = repair ? target : template;

const content = readFileSync(source, "utf8").replace(
  /^(AUTH_JWT_ACTIVE_KID|AUTH_JWT_ES256_PRIVATE_KEY|AUTH_JWT_PUBLIC_KEYS_JSON|AUTH_PENDING_LOGIN_ENCRYPTION_KEY|PII_ENCRYPTION_ACTIVE_KID|PII_ENCRYPTION_KEYS_JSON|SSO_CLIENT_SECRET|SURVEY_PHONE_HASH_HMAC_KEY)=.*$/gm,
  (_, key) => `${key}=${values[key]}`,
);
writeFileSync(target, content, { encoding: "utf8", mode: 0o600 });
console.log(repair
  ? "Updated generated secrets in .env and preserved other settings."
  : "Created .env with fresh local development secrets.");
