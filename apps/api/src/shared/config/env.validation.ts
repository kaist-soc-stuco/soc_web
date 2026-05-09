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

export const validateEnv = (config: Record<string, unknown>): Record<string, unknown> => {
  const postgresHost = asString(config.POSTGRES_HOST, 'POSTGRES_HOST');
  const postgresPort = asPort(config.POSTGRES_PORT, 'POSTGRES_PORT');
  const postgresUser = asString(config.POSTGRES_USER, 'POSTGRES_USER');
  const postgresPassword = asString(config.POSTGRES_PASSWORD, 'POSTGRES_PASSWORD');
  const postgresDb = asString(config.POSTGRES_DB, 'POSTGRES_DB');

  const redisHost = asString(config.REDIS_HOST, 'REDIS_HOST');
  const redisPort = asPort(config.REDIS_PORT, 'REDIS_PORT');
  const redisUrl = asString(config.REDIS_URL, 'REDIS_URL');

  return {
    ...config,
    NODE_ENV: asString(config.NODE_ENV, 'NODE_ENV'),
    API_PORT: asPort(config.API_PORT, 'API_PORT'),
    VITE_SSO_CLIENT_ID: asString(config.VITE_SSO_CLIENT_ID, 'VITE_SSO_CLIENT_ID'),
    VITE_SSO_LOGIN_URL: asString(config.VITE_SSO_LOGIN_URL, 'VITE_SSO_LOGIN_URL'),
    VITE_SSO_REDIRECT_URI: asString(
      config.VITE_SSO_REDIRECT_URI,
      'VITE_SSO_REDIRECT_URI',
    ),
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
