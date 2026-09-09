"""Exercise the local SSO protocol without creating app users or writing content."""
import json
import re
import secrets
import time
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import ProxyHandler, Request, build_opener

from sso_server import ENV, HOST, PORT

ORIGIN = f"http://{HOST}:{PORT}"
OPENER = build_opener(ProxyHandler({}))


def request(path, form=None):
    data = urlencode(form).encode() if form is not None else None
    req = Request(ORIGIN + path, data=data)
    try:
        with OPENER.open(req, timeout=15) as response:
            return response.status, response.read().decode()
    except HTTPError as error:
        return error.code, error.read().decode()


def wait_for_api_health(timeout_seconds=30):
    deadline = time.monotonic() + timeout_seconds
    last_status = None
    while time.monotonic() < deadline:
        status, payload = request('/health')
        last_status = status
        try:
            if status == 200 and json.loads(payload).get('status') == 'ok':
                return
        except (TypeError, ValueError):
            pass
        time.sleep(0.5)
    raise AssertionError(f'API health did not become ready (last status: {last_status})')


def main():
    assert request('/__local-sso/health')[0] == 200
    assert request('/__local-sso/token', {})[0] == 401
    assert request('/__local-sso/authorize', {'client_id': 'wrong'})[0] == 400
    assert request('/__local-sso/approve', {'transaction': 'invalid', 'profile': 'admin'})[0] == 400
    nonce, state = secrets.token_urlsafe(24), secrets.token_urlsafe(24)
    status, page = request('/__local-sso/authorize', {
        'client_id': ENV['SSO_CLIENT_ID'], 'redirect_uri': '/api/auth/login',
        'nonce': nonce, 'state': state,
    })
    assert status == 200
    transaction = re.search(r'name="transaction" value="([^"]+)"', page)[1]
    approval = {'transaction': transaction, 'profile': 'student'}
    status, page = request('/__local-sso/approve', approval)
    assert status == 200 and f'name="state" value="{state}"' in page
    assert request('/__local-sso/approve', approval)[0] == 400
    code = re.search(r'name="code" value="([^"]+)"', page)[1]
    exchange = {'client_id': ENV['SSO_CLIENT_ID'], 'client_secret': ENV['SSO_CLIENT_SECRET'],
                'redirect_uri': '/api/auth/login', 'code': code}
    assert request('/__local-sso/token', {**exchange, 'client_secret': 'wrong'})[0] == 401
    status, payload = request('/__local-sso/token', exchange)
    result = json.loads(payload)
    assert status == 200 and result['nonce'] == nonce
    assert result['userInfo']['std_no'] == '90990002'
    assert result['userInfo']['email'].endswith('@example.invalid')
    assert request('/__local-sso/token', exchange)[0] == 400
    wait_for_api_health()
    print('PASS: health, invalid client/transaction, state, nonce, synthetic profile, one-time transaction/code, API proxy')
    print('No app users, survey responses, posts, or emails were created by this test.')


if __name__ == '__main__':
    main()
