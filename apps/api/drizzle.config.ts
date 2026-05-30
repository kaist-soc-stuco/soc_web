/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

const findWorkspaceEnvFile = (): string | null => {
  let currentDir = process.cwd();

  while (true) {
    const candidate = path.join(currentDir, ".env");
    if (existsSync(candidate)) return candidate;

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return null;
    currentDir = parentDir;
  }
};

const loadWorkspaceEnv = (): void => {
  const envFile = findWorkspaceEnvFile();
  if (!envFile) return;

  const content = readFileSync(envFile, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
};

loadWorkspaceEnv();

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
