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

test('Express reads the nearest untrusted client and ignores a forged leftmost address', async () => {
  const express = require('express');
  const app = express();
  app.get('/ip', (request, response) => response.json({ ip: request.ip }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/ip`;
  try {
    const direct = await (await fetch(url, { headers: { 'x-forwarded-for': '198.51.100.99' } })).json();
    assert.equal(direct.ip, '127.0.0.1');
    app.set('trust proxy', createTrustedProxyCheck(['127.0.0.1', '172.16.0.0/12'], 2));
    const normal = await (await fetch(url, { headers: { 'x-forwarded-for': '203.0.113.8, 172.18.0.1' } })).json();
    assert.equal(normal.ip, '203.0.113.8');
    const forged = await (await fetch(url, { headers: { 'x-forwarded-for': '198.51.100.99, 203.0.113.8, 172.18.0.1' } })).json();
    assert.equal(forged.ip, '203.0.113.8');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
