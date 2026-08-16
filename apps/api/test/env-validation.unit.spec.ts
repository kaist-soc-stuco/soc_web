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
    SURVEY_PHONE_HASH_HMAC_KEY: Buffer.alloc(32, 9).toString('base64'),
    SURVEY_PHONE_HASH_HMAC_VERSION: 'test-survey-phone-v1',
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
  it('rejects local SSO settings when the API is configured for production', () => {
    expect(() => validateEnv({
      ...validConfig(),
      NODE_ENV: 'production',
      VITE_SSO_CLIENT_ID: 'local-development',
      VITE_SSO_REDIRECT_URI: 'http://localhost:3000/api/auth/login',
      SSO_CLIENT_SECRET: 'REPLACE_WITH_GENERATED_LOCAL_SECRET',
    })).toThrow(/Production SSO configuration/);
  });
  it('accepts a public HTTPS SSO configuration in production', () => {
    expect(validateEnv({
      ...validConfig(),
      NODE_ENV: 'production',
      VITE_SSO_CLIENT_ID: 'issued-production-client',
      VITE_SSO_REDIRECT_URI: 'https://soc.example.test/api/auth/login',
      SSO_CLIENT_SECRET: 'issued-production-secret',
    })).toMatchObject({ NODE_ENV: 'production' });
  });
  it('preserves the validated survey HMAC key and version exactly', () => {
    const config = validConfig();
    expect(validateEnv(config)).toMatchObject({
      SURVEY_PHONE_HASH_HMAC_KEY: config.SURVEY_PHONE_HASH_HMAC_KEY,
      SURVEY_PHONE_HASH_HMAC_VERSION: config.SURVEY_PHONE_HASH_HMAC_VERSION,
    });
  });
  it.each([
    ['missing', undefined],
    ['empty', ''],
  ])('rejects a %s survey phone HMAC key', (_case, SURVEY_PHONE_HASH_HMAC_KEY) => {
    expect(() => validateEnv({
      ...validConfig(),
      SURVEY_PHONE_HASH_HMAC_KEY,
    })).toThrow('Missing environment variable: SURVEY_PHONE_HASH_HMAC_KEY');
  });
  it.each([
    ['31 decoded bytes', Buffer.alloc(31).toString('base64')],
    ['33 decoded bytes', Buffer.alloc(33).toString('base64')],
    ['non-canonical padding', `${Buffer.alloc(32).toString('base64')}\n`],
    ['non-base64 text', 'test-survey-phone-hmac-key-at-least-32-bytes'],
  ])('rejects a survey phone HMAC key with %s', (_case, SURVEY_PHONE_HASH_HMAC_KEY) => {
    expect(() => validateEnv({
      ...validConfig(),
      SURVEY_PHONE_HASH_HMAC_KEY,
    })).toThrow('Invalid HMAC key for SURVEY_PHONE_HASH_HMAC_KEY: requires canonical base64 encoding of exactly 32 bytes');
  });
  it('accepts a canonical base64 survey phone HMAC key decoding to exactly 32 bytes', () => {
    const SURVEY_PHONE_HASH_HMAC_KEY = Buffer.alloc(32, 3).toString('base64');
    expect(validateEnv({
      ...validConfig(),
      SURVEY_PHONE_HASH_HMAC_KEY,
    })).toMatchObject({ SURVEY_PHONE_HASH_HMAC_KEY });
  });
  it('validates and canonicalizes prior survey HMAC keys without duplicating the active version', () => {
    const priorKey = Buffer.alloc(32, 4).toString('base64');
    expect(validateEnv({
      ...validConfig(),
      SURVEY_PHONE_HASH_HMAC_PRIOR_KEYS_JSON: JSON.stringify({ previous: priorKey }),
    })).toMatchObject({
      SURVEY_PHONE_HASH_HMAC_PRIOR_KEYS_JSON: JSON.stringify({ previous: priorKey }),
    });
    for (const priorKeys of [
      'not-json',
      JSON.stringify({ 'test-survey-phone-v1': priorKey }),
      JSON.stringify({ previous: Buffer.alloc(31).toString('base64') }),
      JSON.stringify({ 'invalid version': priorKey }),
    ]) {
      expect(() => validateEnv({
        ...validConfig(),
        SURVEY_PHONE_HASH_HMAC_PRIOR_KEYS_JSON: priorKeys,
      })).toThrow(/Invalid HMAC/);
    }
  });
  it.each([
    ['missing', undefined, 'Missing environment variable: SURVEY_PHONE_HASH_HMAC_VERSION'],
    ['empty', '', 'Missing environment variable: SURVEY_PHONE_HASH_HMAC_VERSION'],
    ['invalid', 'version with spaces', 'Invalid HMAC key version for SURVEY_PHONE_HASH_HMAC_VERSION'],
  ])('rejects a %s survey phone HMAC version', (_case, SURVEY_PHONE_HASH_HMAC_VERSION, message) => {
    expect(() => validateEnv({
      ...validConfig(),
      SURVEY_PHONE_HASH_HMAC_VERSION,
    })).toThrow(message);
  });
  it('rejects an undersized pending-login encryption key', () => {
    expect(() => validateEnv({
      ...validConfig(),
      AUTH_PENDING_LOGIN_ENCRYPTION_KEY: 'too-short',
    })).toThrow('Invalid encryption key for AUTH_PENDING_LOGIN_ENCRYPTION_KEY');
  });
  it('rejects a malformed survey phone HMAC key with an HMAC-specific diagnostic', () => {
    expect(() => validateEnv({
      ...validConfig(),
      SURVEY_PHONE_HASH_HMAC_KEY: 'too-short',
    })).toThrow('Invalid HMAC key for SURVEY_PHONE_HASH_HMAC_KEY: requires canonical base64 encoding of exactly 32 bytes');
  });

  it('rejects a public key that does not match the active private key', () => {
    const config = validConfig();
    config.AUTH_JWT_PUBLIC_KEYS_JSON = JSON.stringify({ active: keyPair().publicPem });
    expect(() => validateEnv(config)).toThrow('Invalid ES256 JWT key configuration');
  });
  it('rejects malformed private key material', () => {
    expect(() => validateEnv({
      ...validConfig(),
      AUTH_JWT_ES256_PRIVATE_KEY: 'not-a-private-key',
    })).toThrow('Invalid ES256 JWT key configuration');
  });

  it('rejects an RSA private key', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    expect(() => validateEnv({
      ...validConfig(),
      AUTH_JWT_ES256_PRIVATE_KEY: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    })).toThrow('Invalid ES256 JWT key configuration');
  });

  it.each([
    ['P-384', 'secp384r1'],
    ['P-521', 'secp521r1'],
  ])('rejects an active %s public key', (_label, namedCurve) => {
    const { publicKey } = generateKeyPairSync('ec', { namedCurve });
    const config = validConfig();
    config.AUTH_JWT_PUBLIC_KEYS_JSON = JSON.stringify({
      active: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    });
    expect(() => validateEnv(config)).toThrow('Invalid ES256 JWT key configuration');
  });

  it('rejects a missing active key id', () => {
    const config = validConfig();
    delete (config as Partial<typeof config>).AUTH_JWT_ACTIVE_KID;
    expect(() => validateEnv(config)).toThrow('Missing environment variable: AUTH_JWT_ACTIVE_KID');
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
  it('treats blank disabled provider settings as unset', () => {
    expect(validateEnv({
      ...validConfig(),
      ASSET_PROVIDER_URL: '',
      ASSET_PROVIDER_TOKEN: '',
      MAIL_PROVIDER_URL: '',
      MAIL_PROVIDER_TOKEN: '',
      MAIL_FROM: '',
      CHAT_PROVIDER_URL: '',
      CHAT_PROVIDER_TOKEN: '',
      CHAT_PROVIDER_MODEL: '',
    })).toMatchObject({
      ASSET_PROVIDER_URL: undefined,
      ASSET_PROVIDER_TOKEN: undefined,
      MAIL_PROVIDER_URL: undefined,
      MAIL_PROVIDER_TOKEN: undefined,
      MAIL_FROM: undefined,
      CHAT_PROVIDER_URL: undefined,
      CHAT_PROVIDER_TOKEN: undefined,
      CHAT_PROVIDER_MODEL: undefined,
    });
  });
  it('validates survey definition B/P/H limits as canonical ordered bounded integers', () => {
    expect(validateEnv(validConfig())).toMatchObject({
      SURVEY_DEFINITION_MAX_BYTES: 262_144,
      SURVEY_DEFINITION_PARSER_MAX_BYTES: 266_240,
      SURVEY_DEFINITION_HARD_MAX_BYTES: 1_048_576,
    });
    expect(validateEnv({
      ...validConfig(),
      SURVEY_DEFINITION_MAX_BYTES: '1024',
      SURVEY_DEFINITION_PARSER_MAX_BYTES: '2048',
      SURVEY_DEFINITION_HARD_MAX_BYTES: '4096',
    })).toMatchObject({
      SURVEY_DEFINITION_MAX_BYTES: 1024,
      SURVEY_DEFINITION_PARSER_MAX_BYTES: 2048,
      SURVEY_DEFINITION_HARD_MAX_BYTES: 4096,
    });
  });
  it.each([
    ['SURVEY_DEFINITION_MAX_BYTES', '1.5'],
    ['SURVEY_DEFINITION_PARSER_MAX_BYTES', '0'],
    ['SURVEY_DEFINITION_HARD_MAX_BYTES', '-1'],
    ['SURVEY_DEFINITION_MAX_BYTES', '16777217'],
    ['SURVEY_DEFINITION_PARSER_MAX_BYTES', '16777217'],
    ['SURVEY_DEFINITION_HARD_MAX_BYTES', '16777217'],
  ])('rejects a noninteger, nonpositive, or hard-ceiling-exceeding survey definition limit: %s=%s', (name, value) => {
    expect(() => validateEnv({ ...validConfig(), [name]: value })).toThrow(
      `Invalid positive integer value for ${name}`,
    );
  });
  it.each([
    { SURVEY_DEFINITION_MAX_BYTES: '2048', SURVEY_DEFINITION_PARSER_MAX_BYTES: '1024', SURVEY_DEFINITION_HARD_MAX_BYTES: '4096' },
    { SURVEY_DEFINITION_MAX_BYTES: '1024', SURVEY_DEFINITION_PARSER_MAX_BYTES: '4096', SURVEY_DEFINITION_HARD_MAX_BYTES: '2048' },
  ])('rejects reversed survey definition B/P/H limits', (limits) => {
    expect(() => validateEnv({ ...validConfig(), ...limits })).toThrow(
      'Invalid survey definition byte limits: expected MAX_BYTES <= PARSER_MAX_BYTES <= HARD_MAX_BYTES',
    );
  });
  it('accepts an enabled asset provider', () => {
    expect(validateEnv({ ...validConfig(), ASSET_PROVIDER_ENABLED: 'true', ASSET_PROVIDER_URL: 'https://assets.example.test', ASSET_PROVIDER_TOKEN: 'secret' })).toMatchObject({
      ASSET_PROVIDER_ENABLED: true,
      ASSET_PROVIDER_URL: 'https://assets.example.test',
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
