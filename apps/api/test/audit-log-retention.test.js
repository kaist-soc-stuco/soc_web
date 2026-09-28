const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../../..");

test("audit log backups default to at least two years of retention", () => {
  const sources = [
    ".env.example",
    "infra/docker/compose.prod.yml",
    "infra/docker/scripts/backup-audit-logs.sh",
  ];

  for (const source of sources) {
    const content = fs.readFileSync(path.join(repositoryRoot, source), "utf8");
    const match = content.match(/AUDIT_LOG_BACKUP_RETENTION_DAYS(?::-|=)(\d+)/);
    assert.ok(match, `${source} must configure audit-log retention`);
    assert.ok(Number(match[1]) >= 730, `${source} must retain audit logs for at least 730 days`);
  }

  const script = fs.readFileSync(
    path.join(repositoryRoot, "infra/docker/scripts/backup-audit-logs.sh"),
    "utf8",
  );
  assert.match(script, /find "\$backup_dir".+-mtime "\+\$\{retention_days\}" -delete/);
});
