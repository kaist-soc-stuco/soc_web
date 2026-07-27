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
    AUTH_PENDING_LOGIN_ENCRYPTION_KEY: 'test-encryption-seed',
    PUBLIC_ORIGIN: 'https://web.example.test',
    SSO_AUTH_API_URL: 'https://sso.example.test/auth',
    SSO_CLIENT_SECRET: 'test-secret',
    VITE_SSO_CLIENT_ID: 'test-client',
    VITE_SSO_LOGIN_URL: 'https://sso.example.test/login',
    VITE_SSO_REDIRECT_URI: 'https://api.example.test/api/auth/login',
  };
};

describe('authentication environment validation', () => {
  it('accepts a matching P-256 active key pair', () => {
    expect(validateEnv(validConfig())).toMatchObject({ AUTH_JWT_ACTIVE_KID: 'active' });
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
});
