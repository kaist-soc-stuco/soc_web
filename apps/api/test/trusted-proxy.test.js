const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createTrustedProxyCheck,
} = require('../dist/apps/api/src/infrastructure/http/trusted-proxy.js');

test('trusted proxy check accepts only configured Docker hops', () => {
  const isTrusted = createTrustedProxyCheck(['172.16.0.0/12'], 2);

  assert.equal(isTrusted('::ffff:172.18.0.7', 0), true);
  assert.equal(isTrusted('172.18.0.1', 1), true);
  assert.equal(isTrusted('172.18.0.1', 2), false);
  assert.equal(isTrusted('203.0.113.10', 0), false);
});

test('trusted proxy check supports exact IPv4 and IPv6 addresses', () => {
  const isTrusted = createTrustedProxyCheck(['127.0.0.1', '::1'], 1);

  assert.equal(isTrusted('::ffff:127.0.0.1', 0), true);
  assert.equal(isTrusted('::1', 0), true);
  assert.equal(isTrusted('::2', 0), false);
});

test('trusted proxy check rejects invalid configuration', () => {
  assert.throws(
    () => createTrustedProxyCheck(['172.16.0.0/99'], 2),
    /Invalid trusted proxy CIDR/,
  );
  assert.throws(
    () => createTrustedProxyCheck(['172.16.0.0/'], 2),
    /Invalid trusted proxy address/,
  );
  assert.throws(
    () => createTrustedProxyCheck(['not-an-ip'], 2),
    /Invalid trusted proxy address/,
  );
  assert.throws(
    () => createTrustedProxyCheck(['127.0.0.1'], 0),
    /TRUST_PROXY_HOPS/,
  );
});
