const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseRoadmapViewState, restoreRoadmapViewport, readRoadmapViewState, saveRoadmapViewState } = require('../dist/test-src/features/roadmap/roadmap-view-state.js');

const state = {
  selectedTerm: '2026-spring', offeredOnly: true, selectedTrackIds: ['data'], searchText: '데이터',
  selectedCourseCode: 'CS30600', selectedInstanceId: 'social:CS30600',
  viewport: { x: -800, y: -500, zoom: 1.3, width: 1000, height: 700, courseCode: 'CS30600' },
};

test('saved roadmap state rejects corrupt or invalid browser storage', () => {
  assert.deepEqual(parseRoadmapViewState(JSON.stringify(state)), state);
  assert.equal(parseRoadmapViewState('{broken'), null);
  assert.equal(parseRoadmapViewState(null), null);
  assert.equal(parseRoadmapViewState(JSON.stringify({ ...state, viewport: { ...state.viewport, zoom: 0 } })), null);
  assert.equal(parseRoadmapViewState(JSON.stringify({ ...state, selectedTrackIds: [1] })), null);
  assert.equal(parseRoadmapViewState(JSON.stringify({ ...state, viewport: { ...state.viewport, width: '1000' } })), null);
});

test('restoring at a different viewport size preserves world center and zoom', () => {
  const restored = restoreRoadmapViewport(state.viewport, { width: 800, height: 600 });
  assert.equal(restored.zoom, state.viewport.zoom);
  assert.equal((800 / 2 - restored.x) / restored.zoom, (1000 / 2 - state.viewport.x) / state.viewport.zoom);
  assert.equal((600 / 2 - restored.y) / restored.zoom, (700 / 2 - state.viewport.y) / state.viewport.zoom);
});

test('navigation memory survives unavailable browser storage', () => {
  saveRoadmapViewState(state);
  assert.deepEqual(readRoadmapViewState(), state);
});
