"""Run browser acceptance checks in disposable Docker services on Windows/Linux.

Never reads the project's .env, contacts KAIST, sends email, or uses a live DB.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import ProxyHandler, build_opener

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "output" / "product-e2e"
PROJECT = "soc-product-e2e"
APP_URL = "http://127.0.0.1:38765"


def wait_for(path: str, *, timeout: int = 180) -> None:
    opener = build_opener(ProxyHandler({}))
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with opener.open(APP_URL + path, timeout=3) as response:
                if response.status == 200:
                    return
        except (OSError, TimeoutError):
            pass
        time.sleep(1)
    raise RuntimeError(f"Disposable test service did not become ready: {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--keep-stack", action="store_true")
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--headed", action="store_true")
    args = parser.parse_args()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    env_file = ARTIFACTS / "e2e.env"
    template = (ROOT / "tools/security_qa/e2e.env.example").read_text(encoding="utf-8-sig")
    template = template.replace("__HOST_IP__", "127.0.0.1").replace(":28765", ":38765").replace(":28080", ":38080")
    template += "\nSSO_LOGIN_URL=/__local-sso/authorize\nSSO_AUTH_API_URL=http://sso:38765/__local-sso/token\n"
    template += "SECURITY_E2E_DB_PORT=127.0.0.1:35432\nSECURITY_E2E_API_PORT=127.0.0.1:33000\nSECURITY_E2E_WEB_PORT=127.0.0.1:35173\nSECURITY_E2E_APP_PORT=127.0.0.1:38080\n"
    env_file.write_text(template, encoding="utf-8")
    for pattern in ("test_*.png", "test_*.zip", "report.json"):
        for artifact in ARTIFACTS.glob(pattern):
            artifact.unlink()
    env = {**os.environ, "SECURITY_E2E_ENV_FILE": str(env_file)}
    compose = ["docker", "compose", "--project-name", PROJECT, "--env-file", str(env_file),
               "--file", "tools/security_qa/compose.yml", "--file", "tools/product_qa/compose.yml"]
    try:
        with (ARTIFACTS / "stack.log").open("w", encoding="utf-8") as log:
            subprocess.run(compose + ["down", "--volumes", "--remove-orphans"],
                           cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
            subprocess.run(compose + ["up", "-d"] + ([] if args.skip_build else ["--build"]),
                           cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
        wait_for("/__local-sso/health")
        wait_for("/health")
        wait_for("/")
        if args.prepare_only:
            print(f"Disposable test stack ready at {APP_URL}")
            return
        command = [sys.executable, "tools/product_qa/browser_product_e2e.py", "--app-url", APP_URL]
        if args.headed:
            command.append("--headed")
        subprocess.run(command, cwd=ROOT, env=env, check=True)
    finally:
        with (ARTIFACTS / "services.log").open("w", encoding="utf-8") as log:
            subprocess.run(compose + ["logs", "--no-color", "--tail", "150"], cwd=ROOT, env=env,
                           stdout=log, stderr=subprocess.STDOUT, check=False)
        if not (args.keep_stack or args.prepare_only):
            # This fixed project owns only the disposable test volumes above.
            subprocess.run(compose + ["down", "--volumes", "--remove-orphans"], cwd=ROOT, env=env, check=False)
            env_file.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
