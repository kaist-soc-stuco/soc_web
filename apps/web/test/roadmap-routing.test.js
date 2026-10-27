const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRoadmapRouter, routeConnection, roundedPath, uniqueRoutePaths } = require('../dist/test-src/features/roadmap/roadmap-routing.js');

test('layout router reuses ordered routes and preserves obstacle avoidance', () => {
  const source = { id: 'source', x: 0, y: 0 };
  const target = { id: 'target', x: 500, y: 0 };
  const obstacle = { id: 'obstacle', x: 250, y: 0 };
  const cards = [source, target, obstacle];
  const route = createRoadmapRouter(cards);
  const forward = route(source.id, target.id);
  assert.ok(forward);
  assert.deepEqual(forward, routeConnection(source, target, cards));
  assert.strictEqual(route(source.id, target.id), forward, 'repeat selections reuse the same route');
  for (let i = 1; i < forward.points.length; i++) {
    const a = forward.points[i - 1], b = forward.points[i];
    const crosses = a.x === b.x
      ? a.x > obstacle.x && a.x < obstacle.x + 184 && Math.max(a.y, b.y) > obstacle.y && Math.min(a.y, b.y) < obstacle.y + 108
      : a.y > obstacle.y && a.y < obstacle.y + 108 && Math.max(a.x, b.x) > obstacle.x && Math.min(a.x, b.x) < obstacle.x + 184;
    assert.equal(crosses, false, 'routed edge must stay outside another course');
  }
  assert.deepEqual(route(target.id, source.id), routeConnection(target, source, cards));
  assert.equal(route('filtered-out-course', target.id), null);
  const unobstructed = createRoadmapRouter([source, target])(source.id, target.id);
  assert.notDeepEqual(unobstructed.points, forward.points, 'new layouts must not inherit old obstacles');
});

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
