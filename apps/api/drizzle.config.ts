import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infrastructure/postgres/postgres.schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://localhost:5432/soc_web?sslmode=disable",
  },
  verbose: true,
});
