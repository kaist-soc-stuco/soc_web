const asString = (value: unknown, name: string): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  throw new Error(`Missing environment variable: ${name}`);
};

const asPort = (value: unknown, name: string): number => {
  const raw =
    typeof value === 'string'
      ? value.trim()
      : typeof value === 'number'
        ? String(value)
        : '';

  if (!raw) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  const port = Number.parseInt(raw, 10);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid port value for ${name}: ${raw}`);
  }

  return port;
};

const asPositiveInt = (value: unknown, name: string): number => {
  const raw =
    typeof value === 'string'
      ? value.trim()
      : typeof value === 'number'
        ? String(value)
        : '';

  if (!raw) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  const parsed = Number.parseInt(raw, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer value for ${name}: ${raw}`);
  }

  return parsed;
};

const asOptionalPositiveInt = (
  value: unknown,
  name: string,
  fallback: number,
): number => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return asPositiveInt(value, name);
};

export const validateEnv = (config: Record<string, unknown>): Record<string, unknown> => {
  const postgresHost = asString(config.POSTGRES_HOST, 'POSTGRES_HOST');
  const postgresPort = asPort(config.POSTGRES_PORT, 'POSTGRES_PORT');
  const postgresUser = asString(config.POSTGRES_USER, 'POSTGRES_USER');
  const postgresPassword = asString(config.POSTGRES_PASSWORD, 'POSTGRES_PASSWORD');
  const postgresDb = asString(config.POSTGRES_DB, 'POSTGRES_DB');

  const redisUrl = asString(config.REDIS_URL, 'REDIS_URL');

  return {
    ...config,
    NODE_ENV: asString(config.NODE_ENV, 'NODE_ENV'),
    API_PORT: asPort(config.API_PORT, 'API_PORT'),
    SSO_CLIENT_ID: asString(config.SSO_CLIENT_ID, 'SSO_CLIENT_ID'),
    SSO_LOGIN_URL: asString(config.SSO_LOGIN_URL, 'SSO_LOGIN_URL'),
    SSO_REDIRECT_URI: asString(config.SSO_REDIRECT_URI, 'SSO_REDIRECT_URI'),
    SSO_AUTH_API_URL: asString(config.SSO_AUTH_API_URL, 'SSO_AUTH_API_URL'),
    SSO_CLIENT_SECRET: asString(config.SSO_CLIENT_SECRET, 'SSO_CLIENT_SECRET'),
    AUTH_JWT_SECRET: asString(
      config.AUTH_JWT_SECRET,
      'AUTH_JWT_SECRET'
    ),
    AUTH_PENDING_LOGIN_ENCRYPTION_KEY: asString(
      config.AUTH_PENDING_LOGIN_ENCRYPTION_KEY,
      'AUTH_PENDING_LOGIN_ENCRYPTION_KEY',
    ),
    REDIS_AUTH_TTL_SECONDS: asPositiveInt(
      config.REDIS_AUTH_TTL_SECONDS ?? 300,
      'REDIS_AUTH_TTL_SECONDS',
    ),
    ASSET_ORPHAN_GRACE_HOURS: asOptionalPositiveInt(
      config.ASSET_ORPHAN_GRACE_HOURS,
      'ASSET_ORPHAN_GRACE_HOURS',
      24,
    ),
    ASSET_ORPHAN_CLEANUP_INTERVAL_HOURS: asOptionalPositiveInt(
      config.ASSET_ORPHAN_CLEANUP_INTERVAL_HOURS,
      'ASSET_ORPHAN_CLEANUP_INTERVAL_HOURS',
      6,
    ),
    POSTGRES_HOST: postgresHost,
    POSTGRES_PORT: postgresPort,
    POSTGRES_USER: postgresUser,
    POSTGRES_PASSWORD: postgresPassword,
    POSTGRES_DB: postgresDb,
    REDIS_URL: redisUrl,
  };
};
