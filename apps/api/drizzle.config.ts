import { defineConfig } from "drizzle-kit";

const readRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Drizzle config`);
  }
  return value;
};

const buildDatabaseUrl = (): string => {
  const explicitUrl = process.env.DATABASE_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const user = encodeURIComponent(readRequiredEnv("POSTGRES_USER"));
  const password = encodeURIComponent(readRequiredEnv("POSTGRES_PASSWORD"));
  const host = readRequiredEnv("POSTGRES_HOST");
  const port = readRequiredEnv("POSTGRES_PORT");
  const database = readRequiredEnv("POSTGRES_DB");

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
};

const databaseUrl = buildDatabaseUrl();

export default defineConfig({
  schema: "./src/infrastructure/postgres/postgres.schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
});
