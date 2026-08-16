import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const envFile = resolve(root, ".env");

if (!existsSync(envFile)) {
  console.error(`Environment file not found: ${envFile}`);
  console.error("Create the test server .env first, then run 'pnpm db:reset'.");
  process.exit(1);
}

function runCompose(args) {
  const result = spawnSync(process.env.DOCKER_BIN || "docker", ["compose", ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Failed to run Docker Compose: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Resetting disposable test database and Redis volumes...");
runCompose(["down", "-v"]);

console.log("Starting PostgreSQL and Redis...");
runCompose(["up", "-d", "--build", "postgres", "redis"]);

console.log("Applying migrations without the production cutover gates...");
runCompose([
  "--profile",
  "maintenance",
  "run",
  "--rm",
  "db-migrate",
  "pnpm",
  "--filter",
  "@soc/api",
  "db:migrate",
]);

console.log("Loading site-test users, permissions, and mock content...");
runCompose(["--profile", "maintenance", "run", "--rm", "seed-production"]);

console.log("Building and starting the test site...");
runCompose(["up", "-d", "--build"]);

console.log("Test reset completed");
