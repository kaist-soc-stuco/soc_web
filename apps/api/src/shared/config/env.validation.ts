import { createPrivateKey, createPublicKey } from 'node:crypto';

const asString = (value: unknown, name: string, fallback?: string): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Missing environment variable: ${name}`);
};
const asOrigin = (value: unknown, name: string): string => {
  const origin = asString(value, name);

  try {
    const parsed = new URL(origin);

    if (parsed.origin !== origin) {
      throw new Error();
    }
  } catch {
    throw new Error(`Invalid origin for ${name}: ${origin}`);
  }

  return origin;
};

const asPort = (value: unknown, name: string, fallback: number): number => {
  const raw = typeof value === 'string' ? value : String(fallback);
  const port = Number.parseInt(raw, 10);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid port value for ${name}: ${raw}`);
  }

  return port;
};
const asBoolean = (value: unknown, name: string, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`Invalid boolean value for ${name}`);
};
const asJwtKeys = (config: Record<string, unknown>) => {
  const activeKid = asString(config.AUTH_JWT_ACTIVE_KID, 'AUTH_JWT_ACTIVE_KID');
  const privatePem = asString(
    config.AUTH_JWT_ES256_PRIVATE_KEY,
    'AUTH_JWT_ES256_PRIVATE_KEY',
  );
  const publicKeysJson = asString(
    config.AUTH_JWT_PUBLIC_KEYS_JSON,
    'AUTH_JWT_PUBLIC_KEYS_JSON',
  );

  try {
    const publicKeys = JSON.parse(publicKeysJson) as unknown;
    if (
      !publicKeys ||
      Array.isArray(publicKeys) ||
      typeof publicKeys !== 'object' ||
      !Object.values(publicKeys).every(
        (value) => typeof value === 'string' && value.trim().length > 0,
      ) ||
      typeof (publicKeys as Record<string, unknown>)[activeKid] !== 'string'
    ) {
      throw new Error();
    }

    const privateKey = createPrivateKey(privatePem);
    if (
      privateKey.asymmetricKeyType !== 'ec' ||
      privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
    ) {
      throw new Error();
    }
    const derivedPublicKey = createPublicKey(privateKey);
    const parsedPublicKeys = Object.values(
      publicKeys as Record<string, string>,
    ).map((value) => createPublicKey(value));
    if (
      parsedPublicKeys.some(
        (key) =>
          key.asymmetricKeyType !== 'ec' ||
          key.asymmetricKeyDetails?.namedCurve !== 'prime256v1',
      )
    ) {
      throw new Error();
    }
    const activePublicKey = createPublicKey(
      (publicKeys as Record<string, string>)[activeKid],
    );
    if (!derivedPublicKey.equals(activePublicKey)) {
      throw new Error();
    }
  } catch {
    throw new Error('Invalid ES256 JWT key configuration');
  }

  return { activeKid, privatePem, publicKeysJson };
};
const asPiiKeys = (config: Record<string, unknown>) => {
  const activeKid = asString(
    config.PII_ENCRYPTION_ACTIVE_KID,
    'PII_ENCRYPTION_ACTIVE_KID',
  );
  const keysJson = asString(
    config.PII_ENCRYPTION_KEYS_JSON,
    'PII_ENCRYPTION_KEYS_JSON',
  );

  try {
    const parsed = JSON.parse(keysJson) as unknown;
    if (
      !parsed
      || Array.isArray(parsed)
      || typeof parsed !== 'object'
      || typeof (parsed as Record<string, unknown>)[activeKid] !== 'string'
      || !Object.entries(parsed as Record<string, unknown>).every(
        ([kid, value]) => {
          if (
            !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(kid)
            || typeof value !== 'string'
          ) return false;
          const key = Buffer.from(value, 'base64');
          return key.length === 32 && key.toString('base64') === value;
        },
      )
    ) {
      throw new Error();
    }
  } catch {
    throw new Error('Invalid PII encryption key configuration');
  }

  return { activeKid, keysJson };
};

export const validateEnv = (config: Record<string, unknown>): Record<string, unknown> => {
  const jwtKeys = asJwtKeys(config);
  const piiKeys = asPiiKeys(config);
  const postgresHost = asString(config.POSTGRES_HOST, 'POSTGRES_HOST', 'localhost');
  const postgresPort = asPort(config.POSTGRES_PORT, 'POSTGRES_PORT', 5432);
  const postgresUser = asString(config.POSTGRES_USER, 'POSTGRES_USER', 'soc');
  const postgresPassword = asString(config.POSTGRES_PASSWORD, 'POSTGRES_PASSWORD', 'soc');
  const postgresDb = asString(config.POSTGRES_DB, 'POSTGRES_DB', 'soc_web');

  const redisHost = asString(config.REDIS_HOST, 'REDIS_HOST', 'localhost');
  const redisPort = asPort(config.REDIS_PORT, 'REDIS_PORT', 6379);
  const redisUrl = asString(config.REDIS_URL, 'REDIS_URL', `redis://${redisHost}:${redisPort}`);

  return {
    ...config,
    NODE_ENV: asString(config.NODE_ENV, 'NODE_ENV', 'development'),
    API_PORT: asPort(config.API_PORT, 'API_PORT', 3000),
    VITE_SSO_CLIENT_ID: asString(config.VITE_SSO_CLIENT_ID, 'VITE_SSO_CLIENT_ID'),
    VITE_SSO_LOGIN_URL: asString(config.VITE_SSO_LOGIN_URL, 'VITE_SSO_LOGIN_URL'),
    VITE_SSO_REDIRECT_URI: asString(
      config.VITE_SSO_REDIRECT_URI,
      'VITE_SSO_REDIRECT_URI',
    ),
    SSO_AUTH_API_URL: asString(config.SSO_AUTH_API_URL, 'SSO_AUTH_API_URL'),
    SSO_CLIENT_SECRET: asString(config.SSO_CLIENT_SECRET, 'SSO_CLIENT_SECRET'),
    AUTH_JWT_PUBLIC_KEYS_JSON: jwtKeys.publicKeysJson,
    AUTH_JWT_ACTIVE_KID: jwtKeys.activeKid,
    AUTH_JWT_ES256_PRIVATE_KEY: jwtKeys.privatePem,
    AUTH_JWT_ISSUER: asString(config.AUTH_JWT_ISSUER, 'AUTH_JWT_ISSUER'),
    AUTH_JWT_AUDIENCE: asString(config.AUTH_JWT_AUDIENCE, 'AUTH_JWT_AUDIENCE'),
    AUTH_PENDING_LOGIN_ENCRYPTION_KEY: asString(
      config.AUTH_PENDING_LOGIN_ENCRYPTION_KEY,
      'AUTH_PENDING_LOGIN_ENCRYPTION_KEY',
    ),
    PUBLIC_ORIGIN: asOrigin(config.PUBLIC_ORIGIN, 'PUBLIC_ORIGIN'),
    PII_ENCRYPTION_ACTIVE_KID: piiKeys.activeKid,
    PII_ENCRYPTION_KEYS_JSON: piiKeys.keysJson,
    AUTHORIZATION_OPERATIONS_ENABLED: asBoolean(
      config.AUTHORIZATION_OPERATIONS_ENABLED,
      'AUTHORIZATION_OPERATIONS_ENABLED',
      false,
    ),
    POSTGRES_HOST: postgresHost,
    POSTGRES_PORT: postgresPort,
    POSTGRES_USER: postgresUser,
    POSTGRES_PASSWORD: postgresPassword,
    POSTGRES_DB: postgresDb,
    REDIS_HOST: redisHost,
    REDIS_PORT: redisPort,
    REDIS_URL: redisUrl,
  };
};
