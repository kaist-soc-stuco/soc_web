#!/bin/sh
set -eu

backup_dir="/backups"
interval_seconds="${AUDIT_LOG_BACKUP_INTERVAL_SECONDS:-86400}"
retention_days="${AUDIT_LOG_BACKUP_RETENTION_DAYS:-370}"

umask 077
mkdir -p "$backup_dir"

backup_audit_logs() {
  backup_date="$(date -u +%Y-%m-%d)"
  csv_path="/tmp/audit-log-${backup_date}.csv"
  archive_path="${backup_dir}/audit-log-${backup_date}.csv.gz"
  temporary_archive_path="${archive_path}.tmp"

  psql --no-psqlrc --set=ON_ERROR_STOP=1 --command='\copy (SELECT audit_log_id, actor_user_id, action, target_type, target_id, payload, ip_address, created_at FROM audit_log ORDER BY audit_log_id) TO STDOUT WITH (FORMAT CSV, HEADER TRUE)' > "$csv_path"
  gzip -c "$csv_path" > "$temporary_archive_path"
  mv "$temporary_archive_path" "$archive_path"
  rm -f "$csv_path"

  find "$backup_dir" -type f -name 'audit-log-*.csv.gz' -mtime "+${retention_days}" -delete
  printf 'Created audit log backup: %s\n' "$archive_path"
}

while true; do
  backup_audit_logs
  sleep "$interval_seconds"
done
