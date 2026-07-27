import { generateKeyPairSync } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const publicPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();

const testEnvironment = {
  AUTH_JWT_SECRET: 'test-jwt-secret',
  AUTH_PENDING_LOGIN_ENCRYPTION_KEY: 'test-pending-encryption-key-at-least-32-bytes',
  AUTH_JWT_ACTIVE_KID: 'test-key',
  AUTH_JWT_AUDIENCE: 'soc-web-test',
  AUTH_JWT_ES256_PRIVATE_KEY: privatePem,
  AUTH_JWT_ISSUER: 'soc-api-test',
  AUTH_JWT_PUBLIC_KEYS_JSON: JSON.stringify({ 'test-key': publicPem }),
  PII_ENCRYPTION_ACTIVE_KID: 'test-pii-key',
  PII_ENCRYPTION_KEYS_JSON: JSON.stringify({
    'test-pii-key': Buffer.alloc(32, 9).toString('base64'),
  }),
  SSO_AUTH_API_URL: 'https://sso.test/auth',
  SSO_CLIENT_SECRET: 'test-client-secret',
  PUBLIC_ORIGIN: 'https://web.test',
  VITE_SSO_CLIENT_ID: 'test-client-id',
  VITE_SSO_LOGIN_URL: 'https://sso.test/login',
  VITE_SSO_REDIRECT_URI: 'https://api.test/auth/login',
};

describe('AppModule composition', () => {
  let originalEnvironment: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnvironment = Object.fromEntries(
      Object.keys(testEnvironment).map((name) => [name, process.env[name]]),
    );
    Object.assign(process.env, testEnvironment);
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it('registers production infrastructure and health modules', async () => {
    const { AppModule } = await import('../src/app.module');
    const imports = Reflect.getMetadata('imports', AppModule) as Array<{ name?: string }>;
    const moduleNames = imports.map((module) => module.name).filter(Boolean);

    expect(moduleNames).toEqual(
      expect.arrayContaining(['PostgresModule', 'RedisModule', 'AuthModule', 'UsersModule', 'HealthModule']),
    );
  });
});
