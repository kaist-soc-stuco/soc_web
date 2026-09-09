"""Local Python SSO fixture + same-origin web proxy for viewport QA.

No KAIST credentials are accepted. Test identities are synthetic. The real app
still validates state/nonce, issues cookies, and evaluates server permissions.
"""
import html
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import select
import socket
import threading
import time
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[2]


def read_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        raise SystemExit(f"Environment file does not exist: {path}")
    values = dict(re.findall(r"^([A-Z_][A-Z_0-9]*)=(.*)$", path.read_text(encoding="utf-8-sig"), re.M))
    return {k: v.strip().strip("\"'") for k, v in values.items()}


ENV_PATH = Path(os.environ.get("LOCAL_QA_ENV_FILE", str(ROOT / ".env")))
ENV = read_env_file(ENV_PATH)
# An explicit environment override lets the isolated security E2E harness use
# synthetic configuration without modifying or loading the repository .env.
for key in (
    "NODE_ENV",
    "SSO_CLIENT_ID",
    "SSO_CLIENT_SECRET",
    "LOCAL_QA_BIND",
    "LOCAL_QA_PORT",
    "LOCAL_QA_UPSTREAM",
    "LOCAL_QA_CALLBACK_URL",
):
    if key in os.environ:
        ENV[key] = os.environ[key]
if ENV.get("NODE_ENV") != "development" or ENV.get("SSO_CLIENT_ID") not in {"soc-mobile-qa", "soc-security-e2e"}:
    raise SystemExit("Run configure_env.py or the isolated security E2E harness in a development environment first.")
HOST = ENV.get("LOCAL_QA_BIND", "127.0.0.1")
PORT = int(ENV.get("LOCAL_QA_PORT", "8765"))
if not ipaddress.ip_address(HOST).is_private or ipaddress.ip_address(HOST).is_unspecified:
    raise SystemExit("Bind only to an explicit loopback/private LAN address.")
UPSTREAM = urlsplit(ENV.get("LOCAL_QA_UPSTREAM", "http://127.0.0.1:8080"))
if UPSTREAM.scheme != "http" or UPSTREAM.hostname not in ("127.0.0.1", "localhost"):
    raise SystemExit("The QA reverse proxy upstream must be loopback HTTP.")
CALLBACK_URL = ENV.get("LOCAL_QA_CALLBACK_URL", "/api/auth/login")
LOCK = threading.Lock()
TRANSACTIONS = {}
CODES = {}
MAX_BODY = 22 * 1024 * 1024
PROFILES = {
    "admin": ("QA-MOBILE-ADMIN", "90990001", "모바일 QA 관리자", "Mobile QA Administrator", "mobile-qa-admin@example.invalid"),
    "student": ("QA-MOBILE-STUDENT", "90990002", "모바일 QA 학생", "Mobile QA Student With A Long Display Name", "mobile-qa-student@example.invalid"),
    "new": ("QA-MOBILE-NEW", "90990003", "모바일 QA 동의테스트", "Mobile QA Consent Test", "mobile-qa-consent@example.invalid"),
}


def take(store, key):
    with LOCK:
        item = store.pop(key, None)
    return item if item and item["expires"] > time.monotonic() else None


def put(store, data):
    token = secrets.token_urlsafe(32)
    with LOCK:
        now = time.monotonic()
        for collection in (TRANSACTIONS, CODES):
            for key in [k for k, v in collection.items() if v["expires"] <= now]:
                del collection[key]
        if len(TRANSACTIONS) + len(CODES) >= 500:
            raise ValueError("Too many pending QA logins")
        store[token] = {**data, "expires": now + 120}
    return token


def user_info(profile):
    uid, stdno, ko, en, email = PROFILES[profile]
    return {"user_id": uid, "kaist_uid": uid, "std_no": stdno,
            "user_nm": ko, "user_eng_nm": en, "email": email,
            "std_dept_kor_nm": "전산학부", "std_dept_eng_nm": "School of Computing",
            "std_major_kor_nm": "전산학부", "std_status_kor": "재학", "socps_cd": "S"}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_):
        # No query strings, auth codes, cookies, or upstream data in logs.
        pass

    def reply(self, status, data, content_type="application/json; charset=utf-8"):
        raw = data.encode() if isinstance(data, str) else json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(raw)

    def body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length < 0 or length > MAX_BODY or self.headers.get("Transfer-Encoding"):
            raise ValueError("Unsupported request body")
        return self.rfile.read(length)

    def form(self):
        return {k: v[0] for k, v in parse_qs(self.body().decode("utf-8")).items()}

    def page(self, content):
        return """<!doctype html><html lang="ko"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>로컬 SSO · 모바일 QA</title><style>
body{font:16px system-ui;margin:0;padding:24px;background:#f5f7f6;color:#172033}
main{max-width:440px;margin:24px auto}button{display:block;width:100%;min-height:48px;margin:12px 0;padding:12px;border:1px solid #cdd8d1;border-radius:10px;background:white;font:inherit}small{color:#52625a}h1{font-size:24px}</style><main>""" + content + "</main></html>"

    def local_sso(self, path):
        if path == "/__local-sso/health" and self.command == "GET":
            return self.reply(200, {"status": "ok", "kind": "synthetic-local-sso", "profiles": list(PROFILES)})
        if self.command != "POST":
            return self.reply(405, {"error": "Use the app login button to start."})
        form = self.form()
        if path == "/__local-sso/authorize":
            if form.get("client_id") != ENV["SSO_CLIENT_ID"] or form.get("redirect_uri") != "/api/auth/login":
                return self.reply(400, {"error": "Invalid test client or callback"})
            if not all(10 <= len(form.get(k, "")) <= 200 for k in ("state", "nonce")):
                return self.reply(400, {"error": "Invalid state/nonce"})
            token = put(TRANSACTIONS, {k: form[k] for k in ("state", "nonce", "redirect_uri")})
            buttons = "".join(f'<button name="profile" value="{p}">{html.escape(PROFILES[p][2])}</button>' for p in PROFILES)
            return self.reply(200, self.page('<h1>로컬 테스트 로그인</h1><p>KAIST SSO에 연결하지 않습니다. 합성 계정으로 앱의 실제 동의·세션 흐름을 테스트합니다.</p>'
                f'<form method="post" action="/__local-sso/approve"><input type="hidden" name="transaction" value="{token}">{buttons}</form>'
                '<small>처음 선택한 계정은 앱의 개인정보 동의 화면을 거칩니다. 실제 계정 정보를 입력하지 마세요.</small>'), "text/html; charset=utf-8")
        if path == "/__local-sso/approve":
            transaction = take(TRANSACTIONS, form.get("transaction", ""))
            if not transaction or form.get("profile") not in PROFILES:
                return self.reply(400, {"error": "Expired transaction or unknown profile"})
            code = put(CODES, {**transaction, "profile": form["profile"]})
            markup = (f'<h1>앱으로 돌아가는 중</h1><form id="callback" method="post" action="{html.escape(CALLBACK_URL, quote=True)}">'
                      f'<input type="hidden" name="state" value="{html.escape(transaction["state"], quote=True)}">'
                      f'<input type="hidden" name="code" value="{code}"><button>계속</button></form>'
                      '<script>document.getElementById("callback").submit()</script>')
            return self.reply(200, self.page(markup), "text/html; charset=utf-8")
        if path == "/__local-sso/token":
            valid = (secrets.compare_digest(form.get("client_secret", ""), ENV["SSO_CLIENT_SECRET"])
                     and form.get("client_id") == ENV["SSO_CLIENT_ID"]
                     and form.get("redirect_uri") == "/api/auth/login")
            if not valid:
                return self.reply(401, {"error": "invalid_client"})
            code = take(CODES, form.get("code", ""))
            if not code:
                return self.reply(400, {"error": "invalid_or_expired_code"})
            return self.reply(200, {"nonce": code["nonce"], "userInfo": user_info(code["profile"])})
        return self.reply(404, {"error": "unknown_local_endpoint"})

    def websocket(self):
        # Relay Vite HMR without changing application source or browser behavior.
        with socket.create_connection((UPSTREAM.hostname, UPSTREAM.port or 80), timeout=15) as upstream:
            headers = "\r\n".join(f"{k}: {v}" for k, v in self.headers.items())
            upstream.sendall(f"{self.command} {self.path} HTTP/1.1\r\n{headers}\r\n\r\n".encode("latin1"))
            upstream.settimeout(None)
            self.connection.settimeout(None)
            sockets = [upstream, self.connection]
            while True:
                readable, _, _ = select.select(sockets, [], [], 60)
                if not readable:
                    break
                for source in readable:
                    chunk = source.recv(65536)
                    if not chunk:
                        return
                    (self.connection if source is upstream else upstream).sendall(chunk)
        self.close_connection = True

    def proxy(self):
        if self.headers.get("Upgrade", "").lower() == "websocket":
            return self.websocket()
        connection = http.client.HTTPConnection(UPSTREAM.hostname, UPSTREAM.port or 80, timeout=30)
        hop = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"}
        headers = {k: v for k, v in self.headers.items() if k.lower() not in hop}
        headers["Connection"] = "close"
        try:
            connection.request(self.command, self.path, body=self.body(), headers=headers)
            response = connection.getresponse()
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() not in hop and key.lower() != "content-length":
                    self.send_header(key, value)
            self.send_header("Connection", "close")
            self.end_headers()
            if self.command != "HEAD":
                while chunk := response.read(65536):
                    self.wfile.write(chunk)
        finally:
            connection.close()
            self.close_connection = True

    def dispatch(self):
        path = urlsplit(self.path).path
        if urlsplit(self.path).netloc:
            return self.reply(400, {"error": "Absolute proxy targets are not accepted"})
        try:
            if path.startswith("/__local-sso/"):
                self.local_sso(path)
            else:
                self.proxy()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            self.close_connection = True
        except (ValueError, UnicodeDecodeError):
            self.reply(400, {"error": "invalid_request"})
        except (OSError, http.client.HTTPException):
            self.reply(502, {"error": "local_upstream_unavailable"})

    do_GET = do_POST = do_PATCH = do_PUT = do_DELETE = do_OPTIONS = do_HEAD = dispatch


if __name__ == "__main__":
    print(f"Mobile QA: http://{HOST}:{PORT} (synthetic SSO, development only)", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
