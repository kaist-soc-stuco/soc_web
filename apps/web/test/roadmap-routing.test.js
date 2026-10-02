const { test } = require('node:test');
const assert = require('node:assert/strict');
const { roundedPath, uniqueRoutePaths } = require('../dist/test-src/features/roadmap/roadmap-routing.js');

test('successor routes keep shared buses dashed by drawing each shared segment once', () => {
  const routes = [
    [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 50 }, { x: 70, y: 50 }],
    [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 100 }, { x: 70, y: 100 }],
    [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 150 }, { x: 70, y: 150 }],
  ];
  const paths = uniqueRoutePaths(routes);
  assert.deepEqual(paths[0], [routes[0]]);
  assert.deepEqual(paths[1], [[{ x: 20, y: 50 }, { x: 20, y: 100 }, { x: 70, y: 100 }]]);
  assert.deepEqual(paths[2], [[{ x: 20, y: 100 }, { x: 20, y: 150 }, { x: 70, y: 150 }]]);
});

test('shared branch junctions stay connected while other corners remain rounded', () => {
  const path = roundedPath([
    { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 50 }, { x: 70, y: 50 },
  ], new Set(['20,50']));
  assert.match(path, /Q 20 0/);
  assert.match(path, /L 20 50 L 70 50/);
  assert.doesNotMatch(path, /Q 20 50/);
});

test('partially overlapping reversed segments preserve uncovered endpoints', () => {
  assert.deepEqual(uniqueRoutePaths([
    [{ x: 10, y: 5 }, { x: 30, y: 5 }],
    [{ x: 40, y: 5 }, { x: 0, y: 5 }],
  ])[1], [
    [{ x: 40, y: 5 }, { x: 30, y: 5 }],
    [{ x: 10, y: 5 }, { x: 0, y: 5 }],
  ]);
});
