const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../../..");

test("recovery backup rotation is independent of source audit-record retention", () => {
  const sources = [
    ".env.example",
    "infra/docker/compose.prod.yml",
    "infra/docker/scripts/backup-audit-logs.sh",
  ];

  for (const source of sources) {
    const content = fs.readFileSync(path.join(repositoryRoot, source), "utf8");
    const match = content.match(/AUDIT_LOG_BACKUP_RETENTION_DAYS(?::-|=)(\d+)/);
    assert.ok(match, `${source} must configure audit-log retention`);
    assert.equal(Number(match[1]), 30, `${source} must rotate recovery backups after 30 days`);
  }

  const script = fs.readFileSync(
    path.join(repositoryRoot, "infra/docker/scripts/backup-audit-logs.sh"),
    "utf8",
  );
  assert.match(script, /retention_cutoff_days=\$\(\(retention_days - 1\)\)/);
  assert.match(script, /find "\$backup_dir".+-mtime "\+\$\{retention_cutoff_days\}" -delete/);
  assert.doesNotMatch(script, /\bDELETE\s+FROM\s+audit_log\b/i);
});
