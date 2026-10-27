const { test } = require('node:test');
const assert = require('node:assert/strict');
const { easeRoadmapCamera, getCourseFocusViewport, isCourseComfortablyVisible } = require('../dist/test-src/features/roadmap/roadmap-camera.js');

test('visible course selection keeps the camera still only when the whole card is readable', () => {
  const size = { width: 800, height: 600 }, card = { x: 100, y: 100, width: 184, height: 108 };
  assert.equal(isCourseComfortablyVisible({ x: 0, y: 0, zoom: 1.2 }, size, card), true);
  assert.equal(isCourseComfortablyVisible({ x: 0, y: 0, zoom: 0.3 }, size, card), false, 'overview cards still need readable zoom');
  assert.equal(isCourseComfortablyVisible({ x: -150, y: 0, zoom: 1.2 }, size, card), false, 'clipped cards need repositioning');
  assert.equal(isCourseComfortablyVisible({ x: 500, y: 0, zoom: 1.2 }, size, card), false, 'right edge must be fully visible');
});

test('course focus preserves readable zoom and centers courses after resizing', () => {
  for (const width of [700, 1200]) {
    const { viewport, duration } = getCourseFocusViewport({ x: 0, y: 0, zoom: 1.5 }, { width, height: 600 }, { x: 1000, y: 500 });
    assert.equal(viewport.zoom, 1.5);
    assert.equal(viewport.x + 1000 * viewport.zoom, width / 2);
    assert.equal(viewport.y + 500 * viewport.zoom, 300);
    assert.ok(duration >= 500 && duration <= 750);
  }
});

test('overview focus becomes readable, bounds long trips and honors reduced motion', () => {
  const current = { x: 0, y: 0, zoom: 0.2 }, size = { width: 1000, height: 600 }, course = { x: 10000, y: 10000 };
  const normal = getCourseFocusViewport(current, size, course);
  assert.equal(normal.viewport.zoom, 1.1);
  assert.equal(normal.duration, 750);
  const instant = getCourseFocusViewport(current, size, course, true);
  assert.equal(instant.duration, 0);
  assert.deepEqual(instant.viewport, normal.viewport);
  assert.equal(getCourseFocusViewport(normal.viewport, size, course).duration, 0);
});

test('camera easing accelerates and decelerates without overshooting', () => {
  assert.equal(easeRoadmapCamera(0), 0);
  assert.equal(easeRoadmapCamera(0.5), 0.5);
  assert.equal(easeRoadmapCamera(1), 1);
  const samples = Array.from({ length: 101 }, (_, i) => easeRoadmapCamera(i / 100));
  assert.ok(samples.every((value, i) => value >= 0 && value <= 1 && (i === 0 || value >= samples[i - 1])));
  assert.ok(samples[1] - samples[0] < (samples[50] - samples[49]) / 100);
  assert.ok(samples[100] - samples[99] < (samples[50] - samples[49]) / 100);
});
