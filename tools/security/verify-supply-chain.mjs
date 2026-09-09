import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const failures = [];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function requireText(condition, message) {
  if (!condition) failures.push(message);
}

const lockfile = read("pnpm-lock.yaml");
const sheetJsUrl = "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz";
const sheetJsIntegrity =
  "sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==";

requireText(lockfile.includes(`specifier: ${sheetJsUrl}`), "SheetJS specifier drifted");
requireText(lockfile.includes(`version: ${sheetJsUrl}`), "SheetJS lock version drifted");
requireText(lockfile.includes(`integrity: ${sheetJsIntegrity}`), "SheetJS tarball integrity is missing or changed");
requireText(lockfile.includes("version: 0.20.3"), "SheetJS locked version is not 0.20.3");
requireText(!/xlsx@(?:\d|\^|~)/.test(lockfile), "registry xlsx resolution detected");

for (const relativePath of ["apps/api/Dockerfile.prod", "apps/web/Dockerfile.prod"]) {
  const dockerfile = read(relativePath);
  const fromLines = dockerfile
    .split(/\r?\n/)
    .filter((line) => /^\s*FROM\s+/i.test(line) && !/^\s*FROM\s+\w+\s+AS\s+/i.test(line));
  requireText(fromLines.length > 0, `${relativePath} has no base image`);
  for (const line of fromLines) {
    requireText(/@sha256:[0-9a-f]{64}/i.test(line), `${relativePath} has an unpinned base image`);
  }
}

const productionCompose = read("infra/docker/compose.prod.yml");
for (const line of productionCompose.split(/\r?\n/)) {
  if (/^\s*image:\s*/.test(line)) {
    requireText(/@sha256:[0-9a-f]{64}/i.test(line), "production Compose image is not digest-pinned");
  }
}
requireText(productionCompose.includes("no-new-privileges:true"), "production Compose lacks no-new-privileges");
requireText(productionCompose.includes("cap_drop:"), "production Compose lacks capability dropping");
requireText(read("apps/api/Dockerfile.prod").includes("USER nodeapp"), "API runtime is not non-root");
requireText(read("apps/web/Dockerfile.prod").includes("USER nginx"), "web runtime is not non-root");
requireText(read("infra/docker/redis/redis.conf").includes("maxmemory-policy noeviction"), "Redis eviction policy is unsafe for durable state");
requireText(read(".dockerignore").includes("tools/mobile_qa/"), "mobile QA fixture is not excluded from Docker context");

let trackedFiles = [];
try {
  trackedFiles = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
  }).split("\0").filter(Boolean);
} catch {
  failures.push("could not enumerate tracked files for secret scan");
}

const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:ghp|github_pat|xox[baprs])_[A-Za-z0-9_-]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:password|secret|token|api[_-]?key)\s*[:=]\s*["'][^"'\r\n]{20,}["']/i,
];
const textExtensions = new Set([
  ".cjs", ".css", ".env", ".example", ".html", ".js", ".json", ".md", ".mjs",
  ".py", ".ts", ".tsx", ".txt", ".yml", ".yaml",
]);

for (const relativePath of trackedFiles) {
  const extension = path.extname(relativePath).toLowerCase();
  if (!textExtensions.has(extension)) continue;
  let content;
  try {
    content = read(relativePath);
  } catch {
    continue;
  }
  content.split(/\r?\n/).forEach((line, index) => {
    if (secretPatterns.some((pattern) => pattern.test(line))) {
      // Never echo the matching line: CI logs must not become a second secret sink.
      failures.push(`possible secret pattern at ${relativePath}:${index + 1}`);
    }
  });
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Supply-chain, production-container, and secret-pattern checks passed.");
