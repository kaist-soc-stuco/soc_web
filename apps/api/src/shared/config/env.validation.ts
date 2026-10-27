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

const MIN_PRODUCTION_SECRET_BYTES = 32;
const KNOWN_SECRET_PLACEHOLDER = /^(?:replace[-_ ]with|change[-_ ]me|changeme|example|test(?:[-_ ]only)?|default|secret|password)(?:$|[-_ ])/i;

const validateProductionSecret = (value: string, name: string): string => {
  const normalized = value.trim();
  if (Buffer.byteLength(normalized, "utf8") < MIN_PRODUCTION_SECRET_BYTES) {
    throw new Error(
      `${name} must be at least ${MIN_PRODUCTION_SECRET_BYTES} bytes in production`,
    );
  }
  if (KNOWN_SECRET_PLACEHOLDER.test(normalized)) {
    throw new Error(`${name} must not use a documented or predictable placeholder`);
  }
  return normalized;
};

const rejectReusedProductionSecrets = (
  secrets: Array<[name: string, value: string]>,
): void => {
  for (let left = 0; left < secrets.length; left += 1) {
    for (let right = left + 1; right < secrets.length; right += 1) {
      if (secrets[left][1] === secrets[right][1]) {
        throw new Error(
          `${secrets[left][0]} and ${secrets[right][0]} must use different production secrets`,
        );
      }
    }
  }
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

export const validateEnv = (config: Record<string, unknown>): Record<string, unknown> => {
  const nodeEnv = asString(config.NODE_ENV, 'NODE_ENV').trim();
  const isProduction = nodeEnv === 'production';
  const postgresHost = asString(config.POSTGRES_HOST, 'POSTGRES_HOST');
  const postgresPort = asPort(config.POSTGRES_PORT, 'POSTGRES_PORT');
  const postgresUser = asString(config.POSTGRES_USER, 'POSTGRES_USER');
  const postgresPassword = asString(config.POSTGRES_PASSWORD, 'POSTGRES_PASSWORD');
  const postgresDb = asString(config.POSTGRES_DB, 'POSTGRES_DB');

  const redisUrl = asString(config.REDIS_URL, 'REDIS_URL');
  const authJwtSecret = asString(config.AUTH_JWT_SECRET, 'AUTH_JWT_SECRET');
  const pendingLoginEncryptionKey = asString(
    config.AUTH_PENDING_LOGIN_ENCRYPTION_KEY,
    'AUTH_PENDING_LOGIN_ENCRYPTION_KEY',
  );
  const voteBallotEncryptionKey = isProduction
    ? asString(config.VOTE_BALLOT_ENCRYPTION_KEY, 'VOTE_BALLOT_ENCRYPTION_KEY')
    : asOptionalString(config.VOTE_BALLOT_ENCRYPTION_KEY);
  const redisPassword = isProduction
    ? asString(config.REDIS_PASSWORD, 'REDIS_PASSWORD')
    : asOptionalString(config.REDIS_PASSWORD);

  if (isProduction) {
    const productionSecrets: Array<[string, string]> = [
      ['AUTH_JWT_SECRET', validateProductionSecret(authJwtSecret, 'AUTH_JWT_SECRET')],
      [
        'AUTH_PENDING_LOGIN_ENCRYPTION_KEY',
        validateProductionSecret(
          pendingLoginEncryptionKey,
          'AUTH_PENDING_LOGIN_ENCRYPTION_KEY',
        ),
      ],
      [
        'VOTE_BALLOT_ENCRYPTION_KEY',
        validateProductionSecret(
          voteBallotEncryptionKey as string,
          'VOTE_BALLOT_ENCRYPTION_KEY',
        ),
      ],
      [
        'REDIS_PASSWORD',
        validateProductionSecret(redisPassword as string, 'REDIS_PASSWORD'),
      ],
    ];
    rejectReusedProductionSecrets(productionSecrets);
  }

  const rawMailPort = config.MAIL_PORT;
  const mailPort = Number(typeof rawMailPort === "string" ? rawMailPort.trim() || 465 : rawMailPort ?? 465);
  if (!Number.isInteger(mailPort) || mailPort < 1 || mailPort > 65535) {
    throw new Error("Invalid MAIL_PORT: expected an integer between 1 and 65535");
  }
  const mailSecure = asOptionalBoolean(config.MAIL_SECURE, "MAIL_SECURE", mailPort === 465);
  if ((mailPort === 465 && !mailSecure) || (mailPort === 587 && mailSecure)) {
    throw new Error("MAIL_PORT 465 requires MAIL_SECURE=true; MAIL_PORT 587 requires MAIL_SECURE=false");
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    API_PORT: asPort(config.API_PORT, 'API_PORT'),
    SSO_CLIENT_ID: asString(config.SSO_CLIENT_ID, 'SSO_CLIENT_ID'),
    SSO_LOGIN_URL: asString(config.SSO_LOGIN_URL, 'SSO_LOGIN_URL'),
    SSO_REDIRECT_URI: asString(config.SSO_REDIRECT_URI, 'SSO_REDIRECT_URI'),
    SSO_AUTH_API_URL: asString(config.SSO_AUTH_API_URL, 'SSO_AUTH_API_URL'),
    SSO_CLIENT_SECRET: asString(config.SSO_CLIENT_SECRET, 'SSO_CLIENT_SECRET'),
    CHANNELTALK_PLUGIN_KEY: asOptionalString(config.CHANNELTALK_PLUGIN_KEY),
    CHANNELTALK_SECRET_KEY: asOptionalString(config.CHANNELTALK_SECRET_KEY),
    CHANNELTALK_MEMBER_HASH_SECRET: asOptionalString(
      config.CHANNELTALK_MEMBER_HASH_SECRET,
    ),
    CALENDAR_EXTERNAL_ICS_URLS: asOptionalString(config.CALENDAR_EXTERNAL_ICS_URLS),
    CALENDAR_EXTERNAL_ICS_ALLOWED_HOSTS: asOptionalString(
      config.CALENDAR_EXTERNAL_ICS_ALLOWED_HOSTS,
    ),
    GOOGLE_CALENDAR_ID: asOptionalString(config.GOOGLE_CALENDAR_ID),
    GOOGLE_SERVICE_ACCOUNT_KEY_FILE: asOptionalString(
      config.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    ),
    GOOGLE_OAUTH_CLIENT_KEY_FILE: asOptionalString(
      config.GOOGLE_OAUTH_CLIENT_KEY_FILE,
    ),
    GOOGLE_OAUTH_TOKEN_FILE: asOptionalString(config.GOOGLE_OAUTH_TOKEN_FILE),
    GOOGLE_OPERATIONS_FOLDER_ID: asOptionalString(config.GOOGLE_OPERATIONS_FOLDER_ID),
    GOOGLE_CONTACTS_SPREADSHEET_ID: asOptionalString(config.GOOGLE_CONTACTS_SPREADSHEET_ID),
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
    MAIL_HOST: asOptionalString(config.MAIL_HOST) ?? "smtp.gmail.com",
    MAIL_PORT: mailPort,
    MAIL_SECURE: mailSecure,
    MAIL_USER: asOptionalString(config.MAIL_USER),
    MAIL_PASS: asOptionalString(config.MAIL_PASS),
    MAIL_FROM: asOptionalString(config.MAIL_FROM),
    EMAIL_DRY_RUN: asOptionalBoolean(
      config.EMAIL_DRY_RUN,
      'EMAIL_DRY_RUN',
      !isProduction,
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
    AUTH_JWT_SECRET: authJwtSecret,
    AUTH_PENDING_LOGIN_ENCRYPTION_KEY: pendingLoginEncryptionKey,
    VOTE_BALLOT_ENCRYPTION_KEY: voteBallotEncryptionKey,
    INITIAL__ADMIN_STDNOS: asOptionalString(config.INITIAL__ADMIN_STDNOS),
    INITIAL_ADMIN_STDNOS: asOptionalString(config.INITIAL_ADMIN_STDNOS),
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
    ASSET_UPLOAD_DIR: asOptionalString(config.ASSET_UPLOAD_DIR),
    ASSET_USER_MAX_COUNT: asOptionalPositiveInt(
      config.ASSET_USER_MAX_COUNT,
      'ASSET_USER_MAX_COUNT',
      100,
    ),
    ASSET_USER_MAX_BYTES: asOptionalPositiveInt(
      config.ASSET_USER_MAX_BYTES,
      'ASSET_USER_MAX_BYTES',
      512 * 1024 * 1024,
    ),
    POSTGRES_HOST: postgresHost,
    POSTGRES_PORT: postgresPort,
    POSTGRES_USER: postgresUser,
    POSTGRES_PASSWORD: postgresPassword,
    POSTGRES_DB: postgresDb,
    REDIS_URL: redisUrl,
    REDIS_PASSWORD: redisPassword,
  };
};
