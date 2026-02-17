const asString = (value: unknown, name: string, fallback?: string): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Missing environment variable: ${name}`);
};

const asPort = (value: unknown, name: string, fallback: number): number => {
  const raw = typeof value === 'string' ? value : String(fallback);
  const port = Number.parseInt(raw, 10);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid port value for ${name}: ${raw}`);
  }

  return port;
};

export const validateEnv = (config: Record<string, unknown>): Record<string, unknown> => {
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
