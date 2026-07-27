import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { validateEnv } from '../src/shared/config/env.validation';

const keyPair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    privatePem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  };
};

const validConfig = () => {
  const { privatePem, publicPem } = keyPair();
  return {
    AUTH_JWT_ACTIVE_KID: 'active',
    AUTH_JWT_AUDIENCE: 'soc-api-test',
    AUTH_JWT_ES256_PRIVATE_KEY: privatePem,
    AUTH_JWT_ISSUER: 'soc-api-test',
    AUTH_JWT_PUBLIC_KEYS_JSON: JSON.stringify({ active: publicPem }),
    AUTH_PENDING_LOGIN_ENCRYPTION_KEY: 'test-encryption-seed-at-least-32-bytes',
    PII_ENCRYPTION_ACTIVE_KID: 'pii-active',
    PII_ENCRYPTION_KEYS_JSON: JSON.stringify({
      'pii-active': Buffer.alloc(32, 7).toString('base64'),
    }),
    PUBLIC_ORIGIN: 'https://web.example.test',
    SSO_AUTH_API_URL: 'https://sso.example.test/auth',
    SSO_CLIENT_SECRET: 'test-secret',
    VITE_SSO_CLIENT_ID: 'test-client',
    VITE_SSO_LOGIN_URL: 'https://sso.example.test/login',
    VITE_SSO_REDIRECT_URI: 'https://api.example.test/api/auth/login',
    POSTGRES_PASSWORD: 'test-postgres-password',
  };
};

describe('authentication environment validation', () => {
  it('accepts a matching P-256 active key pair', () => {
    expect(validateEnv(validConfig())).toMatchObject({ AUTH_JWT_ACTIVE_KID: 'active' });
  });
  it('rejects an undersized pending-login encryption key', () => {
    expect(() => validateEnv({
      ...validConfig(),
      AUTH_PENDING_LOGIN_ENCRYPTION_KEY: 'too-short',
    })).toThrow('Invalid encryption key for AUTH_PENDING_LOGIN_ENCRYPTION_KEY');
  });

  it('rejects a public key that does not match the active private key', () => {
    const config = validConfig();
    config.AUTH_JWT_PUBLIC_KEYS_JSON = JSON.stringify({ active: keyPair().publicPem });
    expect(() => validateEnv(config)).toThrow('Invalid ES256 JWT key configuration');
  });

  it('rejects a missing active public key', () => {
    const config = validConfig();
    config.AUTH_JWT_PUBLIC_KEYS_JSON = JSON.stringify({ previous: keyPair().publicPem });
    expect(() => validateEnv(config)).toThrow('Invalid ES256 JWT key configuration');
  });
  it('rejects matching EC keys that are not P-256', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'secp384r1',
    });
    const config = validConfig();
    config.AUTH_JWT_ES256_PRIVATE_KEY = privateKey
      .export({ format: 'pem', type: 'pkcs8' })
      .toString();
    config.AUTH_JWT_PUBLIC_KEYS_JSON = JSON.stringify({
      active: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    });
    expect(() => validateEnv(config)).toThrow('Invalid ES256 JWT key configuration');
  });

  it('rejects a malformed inactive verification key', () => {
    const config = validConfig();
    const activePublic = JSON.parse(config.AUTH_JWT_PUBLIC_KEYS_JSON).active;
    config.AUTH_JWT_PUBLIC_KEYS_JSON = JSON.stringify({
      active: activePublic,
      previous: 'not-a-public-key',
    });
    expect(() => validateEnv(config)).toThrow('Invalid ES256 JWT key configuration');
  });

  it('rejects missing, unknown, or malformed PII encryption keys', () => {
    const missing = validConfig();
    delete (missing as Partial<typeof missing>).PII_ENCRYPTION_KEYS_JSON;
    expect(() => validateEnv(missing)).toThrow();

    const unknown = validConfig();
    unknown.PII_ENCRYPTION_ACTIVE_KID = 'missing';
    expect(() => validateEnv(unknown)).toThrow('Invalid PII encryption key configuration');

    const malformed = validConfig();
    malformed.PII_ENCRYPTION_KEYS_JSON = JSON.stringify({ 'pii-active': 'too-short' });
    expect(() => validateEnv(malformed)).toThrow('Invalid PII encryption key configuration');
  });
});

describe('content configuration validation', () => {
  it('defaults the purge grace period and asset provider gate to disabled', () => {
    expect(validateEnv(validConfig())).toMatchObject({
      ASSET_PROVIDER_ENABLED: false,
      CONTENT_PURGE_GRACE_DAYS: 30,
    });
  });
  it('accepts an enabled asset provider', () => {
    expect(validateEnv({ ...validConfig(), ASSET_PROVIDER_ENABLED: 'true' })).toMatchObject({
      ASSET_PROVIDER_ENABLED: true,
    });
  });

  it.each([
    ['1', 1],
    ['365', 365],
  ])('accepts a bounded positive content purge grace period: %s', (CONTENT_PURGE_GRACE_DAYS, expected) => {
    expect(
      validateEnv({
        ...validConfig(),
        CONTENT_PURGE_GRACE_DAYS,
      }),
    ).toMatchObject({
      CONTENT_PURGE_GRACE_DAYS: expected,
    });
  });

  it.each(['0', '-1', '1.5', '30days', '', '036', '366', '9007199254740992'])(
    'rejects an invalid content purge grace period: %s',
    (CONTENT_PURGE_GRACE_DAYS) => {
      expect(() =>
        validateEnv({ ...validConfig(), CONTENT_PURGE_GRACE_DAYS }),
      ).toThrow('Invalid positive integer value for CONTENT_PURGE_GRACE_DAYS');
    },
  );
  it.each([
    ['API_PORT', '1'],
    ['API_PORT', '65535'],
    ['POSTGRES_PORT', '1'],
    ['POSTGRES_PORT', '65535'],
    ['REDIS_PORT', '1'],
    ['REDIS_PORT', '65535'],
  ])('accepts canonical port boundaries for %s: %s', (name, value) => {
    expect(validateEnv({ ...validConfig(), [name]: value })).toMatchObject({
      [name]: Number(value),
    });
  });

  it.each(['0', '0001', 5432, '65536', '1.5', '123port', '', ' 5432 '])(
    'rejects non-canonical port values: %s',
    (value) => {
      expect(() => validateEnv({ ...validConfig(), API_PORT: value })).toThrow(
        `Invalid port value for API_PORT: ${value}`,
      );
    },
  );

  it.each([undefined, ''])('requires a non-empty Postgres password', (POSTGRES_PASSWORD) => {
    expect(() =>
      validateEnv({ ...validConfig(), POSTGRES_PASSWORD }),
    ).toThrow('Missing environment variable: POSTGRES_PASSWORD');
  });

  it.each(['TRUE', '1', '', 'false '])(
    'rejects an invalid asset provider gate value: %s',
    (ASSET_PROVIDER_ENABLED) => {
      expect(() =>
        validateEnv({ ...validConfig(), ASSET_PROVIDER_ENABLED }),
      ).toThrow('Invalid boolean value for ASSET_PROVIDER_ENABLED');
    },
  );
});
