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

const asSsoUrl = (value: unknown, name: string): string => {
  const raw = asString(value, name);

  try {
    const parsed = new URL(raw);
    const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (parsed.username || parsed.password || (parsed.protocol !== 'https:' && !isLocalhost)) {
      throw new Error();
    }
  } catch {
    throw new Error(`Invalid URL for ${name}`);
  }

  return raw.replace(/\/+$/, '');
};

const validateProductionSsoConfiguration = (config: {
  clientId: string;
  loginUrl: string;
  redirectUri: string;
  authApiUrl: string;
  clientSecret: string;
}): void => {
  if (config.clientId === 'local-development') {
    throw new Error('Production SSO configuration cannot use the local-development client id');
  }

  if (/^(?:replace-with|replace_with|REPLACE_WITH)/i.test(config.clientSecret)) {
    throw new Error('Production SSO configuration requires an issued client secret');
  }

  for (const [name, value] of [
    ['VITE_SSO_LOGIN_URL', config.loginUrl],
    ['VITE_SSO_REDIRECT_URI', config.redirectUri],
    ['SSO_AUTH_API_URL', config.authApiUrl],
  ] as const) {
    const parsed = new URL(value);
    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' || isLoopback) {
      throw new Error(`Production SSO configuration requires an HTTPS public URL for ${name}`);
    }
  }
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
const asOptionalString = (value: unknown, name: string): string | undefined => {
  if (value === undefined || (typeof value === 'string' && value.trim().length === 0)) return undefined;
  return asString(value, name);
};
const asOptionalUrl = (value: unknown, name: string): string | undefined => {
  if (value === undefined || (typeof value === 'string' && value.trim().length === 0)) return undefined;
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
const asOptionalPositiveBoundedInteger = (
  value: unknown,
  name: string,
  maximum: number,
): number | undefined => value === undefined
  ? undefined
  : typeof value === 'string' && value.trim().length === 0
    ? undefined
    : asPositiveBoundedInteger(value, name, 1, maximum);
const asOptionalIdentity = (value: unknown, name: string): string | undefined => {
  if (value === undefined || (typeof value === 'string' && value.trim().length === 0)) return undefined;
  const identity = asString(value, name);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/.test(identity)) {
    throw new Error(`Invalid identity for ${name}`);
  }
  return identity;
};
const asOptionalSha256 = (value: unknown, name: string): string | undefined => {
  if (value === undefined || (typeof value === 'string' && value.trim().length === 0)) return undefined;
  const hash = asString(value, name);
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error(`Invalid SHA-256 hash for ${name}`);
  return hash.toLowerCase();
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
  const nodeEnv = asString(config.NODE_ENV, 'NODE_ENV', 'development');
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
  const assetEnabled = asBoolean(config.ASSET_PROVIDER_ENABLED, 'ASSET_PROVIDER_ENABLED', false);
  const assetUrl = asOptionalUrl(config.ASSET_PROVIDER_URL, 'ASSET_PROVIDER_URL');
  const assetToken = asOptionalString(config.ASSET_PROVIDER_TOKEN, 'ASSET_PROVIDER_TOKEN');
  const mailUrl = asOptionalUrl(config.MAIL_PROVIDER_URL, 'MAIL_PROVIDER_URL');
  const mailToken = asOptionalString(config.MAIL_PROVIDER_TOKEN, 'MAIL_PROVIDER_TOKEN');
  const mailFrom = asOptionalString(config.MAIL_FROM, 'MAIL_FROM');
  const chatUrl = asOptionalUrl(config.CHAT_PROVIDER_URL, 'CHAT_PROVIDER_URL');
  const chatToken = asOptionalString(config.CHAT_PROVIDER_TOKEN, 'CHAT_PROVIDER_TOKEN');
  const chatModel = asOptionalString(config.CHAT_PROVIDER_MODEL, 'CHAT_PROVIDER_MODEL');
  if (mailEnabled && (!mailUrl || !mailToken || !mailFrom)) throw new Error('Incomplete mail provider configuration');
  if (chatEnabled && (!chatUrl || !chatToken || !chatModel)) throw new Error('Incomplete chat provider configuration');
  if (assetEnabled && (!assetUrl || !assetToken)) throw new Error('Incomplete asset provider configuration');
  const definitionMaxBytes = nodeEnv === 'production'
    ? asOptionalPositiveBoundedInteger(config.SURVEY_DEFINITION_MAX_BYTES, 'SURVEY_DEFINITION_MAX_BYTES', 16_777_216)
    : asPositiveBoundedInteger(config.SURVEY_DEFINITION_MAX_BYTES, 'SURVEY_DEFINITION_MAX_BYTES', 262_144, 16_777_216);
  const definitionParserMaxBytes = nodeEnv === 'production'
    ? asOptionalPositiveBoundedInteger(config.SURVEY_DEFINITION_PARSER_MAX_BYTES, 'SURVEY_DEFINITION_PARSER_MAX_BYTES', 16_777_216)
    : asPositiveBoundedInteger(config.SURVEY_DEFINITION_PARSER_MAX_BYTES, 'SURVEY_DEFINITION_PARSER_MAX_BYTES', 266_240, 16_777_216);
  const definitionHardMaxBytes = nodeEnv === 'production'
    ? asOptionalPositiveBoundedInteger(config.SURVEY_DEFINITION_HARD_MAX_BYTES, 'SURVEY_DEFINITION_HARD_MAX_BYTES', 16_777_216)
    : asPositiveBoundedInteger(config.SURVEY_DEFINITION_HARD_MAX_BYTES, 'SURVEY_DEFINITION_HARD_MAX_BYTES', 1_048_576, 16_777_216);
  if (
    definitionMaxBytes !== undefined
    && definitionParserMaxBytes !== undefined
    && definitionHardMaxBytes !== undefined
    && !(definitionMaxBytes <= definitionParserMaxBytes && definitionParserMaxBytes <= definitionHardMaxBytes)
  ) {
    throw new Error('Invalid survey definition byte limits: expected MAX_BYTES <= PARSER_MAX_BYTES <= HARD_MAX_BYTES');
  }
  const inventoryReportHash = asOptionalSha256(
    config.SURVEY_DEFINITION_INVENTORY_REPORT_SHA256,
    'SURVEY_DEFINITION_INVENTORY_REPORT_SHA256',
  );
  const inventorySchema = asOptionalIdentity(
    config.SURVEY_DEFINITION_INVENTORY_SCHEMA,
    'SURVEY_DEFINITION_INVENTORY_SCHEMA',
  );
  const inventorySerializer = asOptionalIdentity(
    config.SURVEY_DEFINITION_INVENTORY_SERIALIZER,
    'SURVEY_DEFINITION_INVENTORY_SERIALIZER',
  );
  const inventoryApprover = asOptionalIdentity(
    config.SURVEY_DEFINITION_INVENTORY_APPROVER,
    'SURVEY_DEFINITION_INVENTORY_APPROVER',
  );
  const inventoryReportPayload = asOptionalString(
    config.SURVEY_DEFINITION_INVENTORY_REPORT_JSON,
    'SURVEY_DEFINITION_INVENTORY_REPORT_JSON',
  );
  const expectedInventoryDatabaseIdentity = asOptionalIdentity(
    config.SURVEY_DEFINITION_EXPECTED_DATABASE_IDENTITY,
    'SURVEY_DEFINITION_EXPECTED_DATABASE_IDENTITY',
  );
  const expectedInventoryMigrationIdentity = asOptionalSha256(
    config.SURVEY_DEFINITION_EXPECTED_MIGRATION_IDENTITY,
    'SURVEY_DEFINITION_EXPECTED_MIGRATION_IDENTITY',
  );
  const ssoClientId = asString(config.VITE_SSO_CLIENT_ID, 'VITE_SSO_CLIENT_ID');
  const ssoLoginUrl = asSsoUrl(config.VITE_SSO_LOGIN_URL, 'VITE_SSO_LOGIN_URL');
  const ssoRedirectUri = asSsoUrl(config.VITE_SSO_REDIRECT_URI, 'VITE_SSO_REDIRECT_URI');
  const ssoAuthApiUrl = asSsoUrl(config.SSO_AUTH_API_URL, 'SSO_AUTH_API_URL');
  const ssoClientSecret = asString(config.SSO_CLIENT_SECRET, 'SSO_CLIENT_SECRET');
  if (nodeEnv === 'production') {
    validateProductionSsoConfiguration({
      clientId: ssoClientId,
      loginUrl: ssoLoginUrl,
      redirectUri: ssoRedirectUri,
      authApiUrl: ssoAuthApiUrl,
      clientSecret: ssoClientSecret,
    });
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    API_PORT: asPort(config.API_PORT, 'API_PORT', 3000),
    VITE_SSO_CLIENT_ID: ssoClientId,
    VITE_SSO_LOGIN_URL: ssoLoginUrl,
    VITE_SSO_REDIRECT_URI: ssoRedirectUri,
    SSO_AUTH_API_URL: ssoAuthApiUrl,
    SSO_CLIENT_SECRET: ssoClientSecret,
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
    ASSET_PROVIDER_ENABLED: assetEnabled,
    ASSET_PROVIDER_URL: assetUrl,
    ASSET_PROVIDER_TOKEN: assetToken,
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
    SURVEY_DEFINITION_MAX_BYTES: definitionMaxBytes,
    SURVEY_DEFINITION_PARSER_MAX_BYTES: definitionParserMaxBytes,
    SURVEY_DEFINITION_HARD_MAX_BYTES: definitionHardMaxBytes,
    SURVEY_DEFINITION_INVENTORY_REPORT_SHA256: inventoryReportHash,
    SURVEY_DEFINITION_INVENTORY_REPORT_JSON: inventoryReportPayload,
    SURVEY_DEFINITION_INVENTORY_SCHEMA: inventorySchema,
    SURVEY_DEFINITION_INVENTORY_SERIALIZER: inventorySerializer,
    SURVEY_DEFINITION_INVENTORY_APPROVER: inventoryApprover,
    SURVEY_DEFINITION_EXPECTED_DATABASE_IDENTITY: expectedInventoryDatabaseIdentity,
    SURVEY_DEFINITION_EXPECTED_MIGRATION_IDENTITY: expectedInventoryMigrationIdentity,
  };
};
