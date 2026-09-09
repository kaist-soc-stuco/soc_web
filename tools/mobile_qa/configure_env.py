"""Enable/restore the local-only SSO fixture without printing existing secrets."""
import argparse
import ipaddress
import json
from pathlib import Path
import re
import secrets

ROOT = Path(__file__).resolve().parents[2]
ENV = ROOT / ".env"
BACKUP = ROOT / "tmp/mobile-qa/env-backup.json"


def read_env():
    return ENV.read_text(encoding="utf-8-sig")


def values(text):
    return dict(re.findall(r"^([A-Z_][A-Z_0-9]*)=(.*)$", text, re.M))


def update(text, changes):
    for key, value in changes.items():
        pattern = rf"^{re.escape(key)}=.*(?:\n|$)"
        line = "" if value is None else f"{key}={value}\n"
        if re.search(pattern, text, re.M):
            text = re.sub(pattern, lambda _: line, text, flags=re.M)
        elif value is not None:
            text = text.rstrip("\n") + "\n" + line
    return text


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="192.168.0.3")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--restore", action="store_true")
    args = parser.parse_args()
    text = read_env()
    current = values(text)
    if args.restore:
        backup = json.loads(BACKUP.read_text(encoding="utf-8"))
        conflicts = [k for k, v in backup["applied"].items() if current.get(k) != v]
        if conflicts:
            raise SystemExit("Refusing to overwrite subsequent edits: " + ", ".join(conflicts))
        ENV.write_text(update(text, backup["original"]), encoding="utf-8")
        BACKUP.rename(BACKUP.with_name("env-backup-restored-" + secrets.token_hex(4) + ".json"))
        print("Restored only the QA-modified environment keys. Recreate the API container.")
        return
    host = ipaddress.ip_address(args.host)
    if not host.is_private or host.is_unspecified or host.is_multicast:
        raise SystemExit("Use an explicit loopback or private LAN address.")
    if current.get("NODE_ENV", "").strip("\"'") != "development":
        raise SystemExit("Only an explicit NODE_ENV=development environment is supported.")
    if not 1024 <= args.port <= 65535:
        raise SystemExit("Invalid port")
    if BACKUP.exists():
        raise SystemExit("QA environment already configured; restore before reconfiguring.")
    changes = {
        "SSO_LOGIN_URL": "/__local-sso/authorize",
        "SSO_REDIRECT_URI": "/api/auth/login",
        "SSO_AUTH_API_URL": f"http://{host}:{args.port}/__local-sso/token",
        "SSO_CLIENT_ID": "soc-mobile-qa",
        "SSO_CLIENT_SECRET": secrets.token_urlsafe(32),
        "INITIAL__ADMIN_STDNOS": ",".join(filter(None, [current.get("INITIAL__ADMIN_STDNOS", ""), "90990001"])),
        "LOCAL_QA_BIND": str(host),
        "LOCAL_QA_PORT": str(args.port),
        "LOCAL_QA_UPSTREAM": "http://127.0.0.1:8080",
        "EMAIL_DRY_RUN": "true",
        "BULK_EMAIL_SCHEDULER_ENABLED": "false",
        "GOOGLE_CALENDAR_SYNC_ENABLED": "false",
        "KAIST_CALENDAR_SYNC_ENABLED": "false",
        "ASSET_ORPHAN_CLEANUP_ENABLED": "false",
    }
    BACKUP.parent.mkdir(parents=True, exist_ok=True)
    BACKUP.write_text(json.dumps({"original": {k: current.get(k) for k in changes}, "applied": changes}, indent=2), encoding="utf-8")
    ENV.write_text(update(text, changes), encoding="utf-8")
    print(f"QA origin: http://{host}:{args.port}")
    print("Changed keys: " + ", ".join(changes))
    print("Original values saved under ignored tmp/mobile-qa; no credentials printed.")


if __name__ == "__main__":
    main()
