const asString = (value: unknown, name: string): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  throw new Error(`Missing environment variable: ${name}`);
};

const asOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
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

const asOptionalBoolean = (
  value: unknown,
  name: string,
  fallback: boolean,
): boolean => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  throw new Error(`Invalid boolean value for ${name}: ${String(value)}`);
};

const asAssetStorageProvider = (value: unknown): "local" | "s3" => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "local";
  if (normalized === "local" || normalized === "s3") return normalized;
  throw new Error(`Invalid ASSET_STORAGE_PROVIDER value: ${String(value)}`);
};

export const validateEnv = (config: Record<string, unknown>): Record<string, unknown> => {
  const postgresHost = asString(config.POSTGRES_HOST, 'POSTGRES_HOST');
  const postgresPort = asPort(config.POSTGRES_PORT, 'POSTGRES_PORT');
  const postgresUser = asString(config.POSTGRES_USER, 'POSTGRES_USER');
  const postgresPassword = asString(config.POSTGRES_PASSWORD, 'POSTGRES_PASSWORD');
  const postgresDb = asString(config.POSTGRES_DB, 'POSTGRES_DB');

  const redisUrl = asString(config.REDIS_URL, 'REDIS_URL');
  const assetStorageProvider = asAssetStorageProvider(config.ASSET_STORAGE_PROVIDER);
  const awsS3Bucket = asOptionalString(config.AWS_S3_BUCKET);
  const awsRegion = asOptionalString(config.AWS_REGION);

  if (assetStorageProvider === "s3") {
    if (!awsS3Bucket) throw new Error("Missing environment variable: AWS_S3_BUCKET");
    if (!awsRegion) throw new Error("Missing environment variable: AWS_REGION");
  }

  return {
    ...config,
    NODE_ENV: asString(config.NODE_ENV, 'NODE_ENV'),
    API_PORT: asPort(config.API_PORT, 'API_PORT'),
    SSO_CLIENT_ID: asString(config.SSO_CLIENT_ID, 'SSO_CLIENT_ID'),
    SSO_LOGIN_URL: asString(config.SSO_LOGIN_URL, 'SSO_LOGIN_URL'),
    SSO_REDIRECT_URI: asString(config.SSO_REDIRECT_URI, 'SSO_REDIRECT_URI'),
    SSO_AUTH_API_URL: asString(config.SSO_AUTH_API_URL, 'SSO_AUTH_API_URL'),
    SSO_CLIENT_SECRET: asString(config.SSO_CLIENT_SECRET, 'SSO_CLIENT_SECRET'),
    CHANNELTALK_PLUGIN_KEY: asOptionalString(config.CHANNELTALK_PLUGIN_KEY),
    CHANNELTALK_SECRET_KEY: asOptionalString(config.CHANNELTALK_SECRET_KEY),
    CALENDAR_EXTERNAL_ICS_URLS: asOptionalString(config.CALENDAR_EXTERNAL_ICS_URLS),
    GOOGLE_CALENDAR_ID: asOptionalString(config.GOOGLE_CALENDAR_ID),
    GOOGLE_KAIST_CALENDAR_ID: asOptionalString(config.GOOGLE_KAIST_CALENDAR_ID),
    GOOGLE_SERVICE_ACCOUNT_KEY_FILE: asOptionalString(
      config.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    ),
    GOOGLE_OAUTH_CLIENT_KEY_FILE: asOptionalString(
      config.GOOGLE_OAUTH_CLIENT_KEY_FILE,
    ),
    GOOGLE_OAUTH_TOKEN_FILE: asOptionalString(config.GOOGLE_OAUTH_TOKEN_FILE),
    GOOGLE_SURVEY_RESULTS_FOLDER_ID: asOptionalString(
      config.GOOGLE_SURVEY_RESULTS_FOLDER_ID,
    ),
    GOOGLE_SURVEY_RESULTS_FOLDER_NAME:
      asOptionalString(config.GOOGLE_SURVEY_RESULTS_FOLDER_NAME) ??
      "KAIST SOC 설문 결과",
    GOOGLE_CALENDAR_SYNC_ENABLED: asOptionalBoolean(
      config.GOOGLE_CALENDAR_SYNC_ENABLED,
      "GOOGLE_CALENDAR_SYNC_ENABLED",
      false,
    ),
    KAIST_CALENDAR_SYNC_ENABLED: asOptionalBoolean(
      config.KAIST_CALENDAR_SYNC_ENABLED,
      "KAIST_CALENDAR_SYNC_ENABLED",
      false,
    ),
    DOORAY_SMTP_HOST: asOptionalString(config.DOORAY_SMTP_HOST),
    DOORAY_SMTP_PORT: asOptionalPositiveInt(config.DOORAY_SMTP_PORT, 'DOORAY_SMTP_PORT', 587),
    DOORAY_SMTP_USER: asOptionalString(config.DOORAY_SMTP_USER),
    DOORAY_SMTP_PASSWORD: asOptionalString(config.DOORAY_SMTP_PASSWORD),
    DOORAY_SMTP_SECURE: asOptionalBoolean(config.DOORAY_SMTP_SECURE, 'DOORAY_SMTP_SECURE', false),
    EMAIL_FROM: asOptionalString(config.EMAIL_FROM),
    EMAIL_DRY_RUN: asOptionalBoolean(
      config.EMAIL_DRY_RUN,
      'EMAIL_DRY_RUN',
      config.NODE_ENV !== 'production',
    ),
    BULK_EMAIL_SCHEDULER_ENABLED: asOptionalBoolean(
      config.BULK_EMAIL_SCHEDULER_ENABLED,
      'BULK_EMAIL_SCHEDULER_ENABLED',
      true,
    ),
    BULK_EMAIL_SCHEDULER_INTERVAL_MS: asOptionalPositiveInt(
      config.BULK_EMAIL_SCHEDULER_INTERVAL_MS,
      'BULK_EMAIL_SCHEDULER_INTERVAL_MS',
      30000,
    ),
    BULK_EMAIL_MAX_ATTACHMENT_BYTES: asOptionalPositiveInt(
      config.BULK_EMAIL_MAX_ATTACHMENT_BYTES,
      'BULK_EMAIL_MAX_ATTACHMENT_BYTES',
      25 * 1024 * 1024,
    ),
    AUTH_JWT_SECRET: asString(
      config.AUTH_JWT_SECRET,
      'AUTH_JWT_SECRET'
    ),
    AUTH_PENDING_LOGIN_ENCRYPTION_KEY: asString(
      config.AUTH_PENDING_LOGIN_ENCRYPTION_KEY,
      'AUTH_PENDING_LOGIN_ENCRYPTION_KEY',
    ),
    VOTE_BALLOT_ENCRYPTION_KEY: asOptionalString(config.VOTE_BALLOT_ENCRYPTION_KEY),
    AUTH_ELIGIBLE_DEPARTMENTS:
      asOptionalString(config.AUTH_ELIGIBLE_DEPARTMENTS) ?? '전산학부',
    REDIS_AUTH_TTL_SECONDS: asPositiveInt(
      config.REDIS_AUTH_TTL_SECONDS ?? 300,
      'REDIS_AUTH_TTL_SECONDS',
    ),
    ASSET_ORPHAN_GRACE_HOURS: asOptionalPositiveInt(
      config.ASSET_ORPHAN_GRACE_HOURS,
      'ASSET_ORPHAN_GRACE_HOURS',
      24,
    ),
    ASSET_ORPHAN_CLEANUP_ENABLED: asOptionalBoolean(
      config.ASSET_ORPHAN_CLEANUP_ENABLED,
      'ASSET_ORPHAN_CLEANUP_ENABLED',
      false,
    ),
    ASSET_ORPHAN_CLEANUP_INTERVAL_HOURS: asOptionalPositiveInt(
      config.ASSET_ORPHAN_CLEANUP_INTERVAL_HOURS,
      'ASSET_ORPHAN_CLEANUP_INTERVAL_HOURS',
      6,
    ),
    ASSET_STORAGE_PROVIDER: assetStorageProvider,
    ASSET_UPLOAD_DIR: asOptionalString(config.ASSET_UPLOAD_DIR),
    AWS_REGION: awsRegion,
    AWS_S3_BUCKET: awsS3Bucket,
    AWS_S3_PREFIX: asOptionalString(config.AWS_S3_PREFIX) ?? "assets",
    AWS_S3_ENDPOINT: asOptionalString(config.AWS_S3_ENDPOINT),
    AWS_S3_FORCE_PATH_STYLE: asOptionalBoolean(
      config.AWS_S3_FORCE_PATH_STYLE,
      "AWS_S3_FORCE_PATH_STYLE",
      false,
    ),
    AWS_ACCESS_KEY_ID: asOptionalString(config.AWS_ACCESS_KEY_ID),
    AWS_SECRET_ACCESS_KEY: asOptionalString(config.AWS_SECRET_ACCESS_KEY),
    POSTGRES_HOST: postgresHost,
    POSTGRES_PORT: postgresPort,
    POSTGRES_USER: postgresUser,
    POSTGRES_PASSWORD: postgresPassword,
    POSTGRES_DB: postgresDb,
    REDIS_URL: redisUrl,
  };
};
