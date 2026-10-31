"""Run the real Bash script with fake ip/getent commands; never touch host routes."""
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("sso-egress-route.sh")


def fake_ip(args):
    path = Path(os.environ["FAKE_ROUTE_STATE"])
    state = json.loads(path.read_text())
    args = [a for a in args if a not in ("-N", "-4", "-o")]
    if args[0] == "link":
        return
    if args[0] == "addr":
        print("2: eth0 inet 192.0.2.10/24 scope global eth0")
        return
    if args[:2] == ["route", "get"]:
        target = args[2]
        if target == "192.0.2.1":
            print(f"{target} dev eth0 src 192.0.2.10")
        else:
            print(state["routes"].get(target + "/32", f"{target} via 203.0.113.1 dev ens19"))
        return
    if args[:2] == ["route", "show"]:
        if "default" in args:
            print("\n".join(state["defaults"]))
        elif "exact" in args:
            print(state["routes"].get(args[-1], ""))
        else:
            for route in state["routes"].values():
                if " proto 242 " in route:
                    print(route)
        return
    prefix = args[2]
    if args[:2] == ["route", "add"]:
        if prefix == os.environ.get("FAKE_FAIL_ADD"):
            sys.exit(2)
        # iproute2 displays a host route without its /32 suffix.
        state["routes"][prefix] = " ".join([prefix.removesuffix("/32"), *args[3:]])
    elif args[:2] == ["route", "del"]:
        route = state["routes"][prefix]
        assert " proto 242 " in route and " metric 42761" in route
        del state["routes"][prefix]
    else:
        raise AssertionError(args)
    state["mutations"].append(args)
    path.write_text(json.dumps(state))


class SsoEgressTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bash = (
            "C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else shutil.which("bash")
        )
        self.assertTrue(self.bash and Path(self.bash).exists(), "Bash is required")
        self.state_file = self.root / "state.json"
        self.state_file.write_text(json.dumps({
            "routes": {}, "mutations": [],
            "defaults": ["default via 203.0.113.1 dev ens19", "default via 192.0.2.1 dev eth0"],
        }))
        config = self.root / "config"
        config.write_text("SSO_EGRESS_GATEWAY=192.0.2.1\nSSO_EGRESS_SOURCE_IP=192.0.2.10\n", newline="\n")
        commands = {
            "ip": "exec " + shlex.quote(Path(sys.executable).as_posix()) + " "
                  + shlex.quote(Path(__file__).resolve().as_posix()) + ' --fake-ip "$@"',
            "getent": '[[ "${FAKE_DNS_FAIL:-}" != 1 ]] || exit 2\n'
                      'for ip in ${FAKE_DNS:-198.51.100.8}; do echo "$ip STREAM sso.example"; done',
            "id": "echo 0", "flock": "exit 0",
        }
        for name, body in commands.items():
            cmd = self.root / name
            cmd.write_text("#!/usr/bin/env bash\n" + body + "\n", encoding="utf-8", newline="\n")
            cmd.chmod(0o755)
        self.env = dict(os.environ, **{
            "PATH": self.root.as_posix() + os.pathsep + os.environ["PATH"],
            "SSO_EGRESS_CONFIG": config.as_posix(),
            "SSO_EGRESS_LOCK_FILE": (self.root / "lock").as_posix(),
            "FAKE_ROUTE_STATE": self.state_file.as_posix(), "MSYS_NO_PATHCONV": "1",
            "FAKE_BIN": self.root.as_posix(),
        })

    def run_script(self, action, success=True, **env):
        result = subprocess.run(
            [self.bash, "-c", 'if command -v cygpath >/dev/null; then FAKE_BIN="$(cygpath -u "$FAKE_BIN")"; fi; '
             'export PATH="$FAKE_BIN:$PATH"; source "$1" "$2"', "_", SCRIPT.as_posix(), action],
            env={**self.env, **env},
            capture_output=True, text=True, timeout=20,
        )
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        return result

    def state(self):
        return json.loads(self.state_file.read_text())

    def test_check_is_read_only(self):
        self.run_script("check")
        self.assertEqual(self.state()["mutations"], [])

    def test_apply_is_idempotent_and_preserves_defaults(self):
        before = self.state()["defaults"]
        self.run_script("apply")
        self.run_script("apply")
        state = self.state()
        self.assertEqual(len(state["mutations"]), 1)
        self.assertIn("via 192.0.2.1 dev eth0 src 192.0.2.10", state["routes"]["198.51.100.8/32"])
        self.assertEqual(state["defaults"], before)

    def test_manual_host_route_conflict_is_detected_before_any_write(self):
        state = self.state()
        state["routes"]["198.51.100.9/32"] = "198.51.100.9 via 203.0.113.1 dev ens19 proto static"
        self.state_file.write_text(json.dumps(state))
        self.run_script("apply", success=False, FAKE_DNS="198.51.100.8 198.51.100.9")
        self.assertEqual(self.state(), state)

    def test_failed_add_rolls_back_new_routes(self):
        self.run_script("apply", success=False, FAKE_DNS="198.51.100.8 198.51.100.9", FAKE_FAIL_ADD="198.51.100.9/32")
        self.assertEqual(self.state()["routes"], {})

    def test_dns_failure_preserves_existing_routes(self):
        self.run_script("apply")
        before = self.state()
        self.run_script("apply", success=False, FAKE_DNS_FAIL="1")
        self.assertEqual(self.state(), before)

    def test_dns_rotation_and_offline_remove_touch_only_owned_routes(self):
        state = self.state()
        manual = "203.0.113.55 via 203.0.113.1 dev ens19 proto static"
        state["routes"]["203.0.113.55/32"] = manual
        self.state_file.write_text(json.dumps(state))
        self.run_script("apply")
        self.run_script("apply", FAKE_DNS="198.51.100.9")
        self.assertNotIn("198.51.100.8/32", self.state()["routes"])
        self.assertIn("198.51.100.9/32", self.state()["routes"])
        self.run_script("remove", FAKE_DNS_FAIL="1")
        self.assertEqual(self.state()["routes"], {"203.0.113.55/32": manual})


if __name__ == "__main__":
    if sys.argv[1:2] == ["--fake-ip"]:
        sys.stdout.reconfigure(newline="\n")
        fake_ip(sys.argv[2:])
    else:
        unittest.main()
