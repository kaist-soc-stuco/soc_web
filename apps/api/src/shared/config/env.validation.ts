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
const asEncryptionSecret = (value: unknown, name: string): string => {
  const secret = asString(value, name);
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error(`Invalid encryption key for ${name}: requires at least 32 bytes`);
  }
  return secret;
};
const asHmacSecret = (value: unknown, name: string): string => {
  const secret = asString(value, name);
  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32 || key.toString('base64') !== secret) {
    throw new Error(`Invalid HMAC key for ${name}: requires canonical base64 encoding of exactly 32 bytes`);
  }
  return secret;
};
const asHmacKeyVersion = (value: unknown, name: string): string => {
  const version = asString(value, name);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version)) {
    throw new Error(`Invalid HMAC key version for ${name}`);
  }
  return version;
};
const asPriorHmacKeys = (value: unknown, name: string, activeVersion: string): string => {
  if (value === undefined) return '{}';
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid HMAC keyring for ${name}: explicit empty keyring is not allowed`);
  }
  const raw = value;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid HMAC keyring for ${name}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.getPrototypeOf(parsed) !== Object.prototype) {
    throw new Error(`Invalid HMAC keyring for ${name}`);
  }
  const entries = Object.entries(parsed as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  for (const [version, key] of entries) {
    asHmacKeyVersion(version, `${name} version`);
    if (version === activeVersion) throw new Error(`Invalid HMAC keyring for ${name}: active version duplicated`);
    asHmacSecret(key, `${name}.${version}`);
  }
  return JSON.stringify(Object.fromEntries(entries));
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
  const raw = value === undefined ? String(fallback) : value;

  if (typeof raw !== 'string' || !/^[1-9]\d{0,4}$/.test(raw)) {
    throw new Error(`Invalid port value for ${name}: ${String(raw)}`);
  }

  const port = Number(raw);
  if (port > 65_535) {
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
const asOptionalUrl = (value: unknown, name: string): string | undefined => {
  if (value === undefined) return undefined;
  const raw = asString(value, name);
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error();
    return raw.replace(/\/+$/, '');
  } catch {
    throw new Error(`Invalid URL for ${name}`);
  }
};
const asPositiveBoundedInteger = (
  value: unknown,
  name: string,
  fallback: number,
  maximum: number,
): number => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new Error(`Invalid positive integer value for ${name}`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new Error(`Invalid positive integer value for ${name}`);
  }

  return parsed;
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
  const postgresPassword = asString(config.POSTGRES_PASSWORD, 'POSTGRES_PASSWORD');
  const postgresDb = asString(config.POSTGRES_DB, 'POSTGRES_DB', 'soc_web');

  const redisHost = asString(config.REDIS_HOST, 'REDIS_HOST', 'localhost');
  const redisPort = asPort(config.REDIS_PORT, 'REDIS_PORT', 6379);
  const redisUrl = asString(config.REDIS_URL, 'REDIS_URL', `redis://${redisHost}:${redisPort}`);
  const surveyHmacVersion = asHmacKeyVersion(
    config.SURVEY_PHONE_HASH_HMAC_VERSION,
    'SURVEY_PHONE_HASH_HMAC_VERSION',
  );
  const mailEnabled = asBoolean(config.MAIL_PROVIDER_ENABLED, 'MAIL_PROVIDER_ENABLED', false);
  const chatEnabled = asBoolean(config.CHAT_PROVIDER_ENABLED, 'CHAT_PROVIDER_ENABLED', false);
  const mailUrl = asOptionalUrl(config.MAIL_PROVIDER_URL, 'MAIL_PROVIDER_URL');
  const mailToken = config.MAIL_PROVIDER_TOKEN === undefined ? undefined : asString(config.MAIL_PROVIDER_TOKEN, 'MAIL_PROVIDER_TOKEN');
  const mailFrom = config.MAIL_FROM === undefined ? undefined : asString(config.MAIL_FROM, 'MAIL_FROM');
  const chatUrl = asOptionalUrl(config.CHAT_PROVIDER_URL, 'CHAT_PROVIDER_URL');
  const chatToken = config.CHAT_PROVIDER_TOKEN === undefined ? undefined : asString(config.CHAT_PROVIDER_TOKEN, 'CHAT_PROVIDER_TOKEN');
  const chatModel = config.CHAT_PROVIDER_MODEL === undefined ? undefined : asString(config.CHAT_PROVIDER_MODEL, 'CHAT_PROVIDER_MODEL');
  if (mailEnabled && (!mailUrl || !mailToken || !mailFrom)) throw new Error('Incomplete mail provider configuration');
  if (chatEnabled && (!chatUrl || !chatToken || !chatModel)) throw new Error('Incomplete chat provider configuration');

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
    AUTH_PENDING_LOGIN_ENCRYPTION_KEY: asEncryptionSecret(
      config.AUTH_PENDING_LOGIN_ENCRYPTION_KEY,
      'AUTH_PENDING_LOGIN_ENCRYPTION_KEY',
    ),
    PUBLIC_ORIGIN: asOrigin(config.PUBLIC_ORIGIN, 'PUBLIC_ORIGIN'),
    PII_ENCRYPTION_ACTIVE_KID: piiKeys.activeKid,
    PII_ENCRYPTION_KEYS_JSON: piiKeys.keysJson,
    SURVEY_PHONE_HASH_HMAC_KEY: asHmacSecret(
      config.SURVEY_PHONE_HASH_HMAC_KEY,
      'SURVEY_PHONE_HASH_HMAC_KEY',
    ),
    SURVEY_PHONE_HASH_HMAC_VERSION: surveyHmacVersion,
    SURVEY_PHONE_HASH_HMAC_PRIOR_KEYS_JSON: asPriorHmacKeys(
      config.SURVEY_PHONE_HASH_HMAC_PRIOR_KEYS_JSON,
      'SURVEY_PHONE_HASH_HMAC_PRIOR_KEYS_JSON',
      surveyHmacVersion,
    ),
    AUTHORIZATION_OPERATIONS_ENABLED: asBoolean(
      config.AUTHORIZATION_OPERATIONS_ENABLED,
      'AUTHORIZATION_OPERATIONS_ENABLED',
      false,
    ),
    ASSET_PROVIDER_ENABLED: asBoolean(
      config.ASSET_PROVIDER_ENABLED,
      'ASSET_PROVIDER_ENABLED',
      false,
    ),
    CONTENT_PURGE_GRACE_DAYS: asPositiveBoundedInteger(
      config.CONTENT_PURGE_GRACE_DAYS,
      'CONTENT_PURGE_GRACE_DAYS',
      30,
      365,
    ),
    CONTACT_PURGE_GRACE_DAYS: asPositiveBoundedInteger(
      config.CONTACT_PURGE_GRACE_DAYS,
      'CONTACT_PURGE_GRACE_DAYS',
      30,
      365,
    ),
    MAIL_PROVIDER_ENABLED: mailEnabled,
    MAIL_PROVIDER_URL: mailUrl,
    MAIL_PROVIDER_TOKEN: mailToken,
    MAIL_FROM: mailFrom,
    CHAT_PROVIDER_ENABLED: chatEnabled,
    CHAT_PROVIDER_URL: chatUrl,
    CHAT_PROVIDER_TOKEN: chatToken,
    CHAT_PROVIDER_MODEL: chatModel,
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
