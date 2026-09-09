import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useWorkspace } from '../src/stores/workspace.js';

test('a history response belongs to its requested region, never overwrites latest imagery', async () => {
  setActivePinia(createPinia());
  const store = useWorkspace();
  const a = store.addRegion([116.39, 39.9]);
  const b = store.addRegion([121.47, 31.23]);
  let resolve;
  const pending = new Promise((r) => {
    resolve = r;
  });
  const job = store.queryRegion(a.id, () => pending);
  store.activeId = b.id;
  resolve({ observations: [{ id: 'history-a' }], unknown: [], warnings: [] });
  await job;
  assert.equal(a.history.observations[0].id, 'history-a');
  assert.equal(b.history.observations.length, 0);
  assert.equal(a.latest.status, 'idle');
  assert.equal(store.basemap, 'esri');
});

test('deleting or canceling a region prevents stale results from being applied', async () => {
  setActivePinia(createPinia());
  const store = useWorkspace();
  const region = store.addRegion([116.39, 39.9]);
  let resolve;
  const pending = new Promise((r) => {
    resolve = r;
  });
  const job = store.queryRegion(region.id, () => pending);
  store.removeRegion(region.id);
  resolve({ observations: [{ id: 'stale' }], unknown: [], warnings: [] });
  await job;
  assert.equal(store.regions.length, 0);
  assert.equal(store.activeId, null);
});

test('ranges and colors are independently owned by each region', () => {
  setActivePinia(createPinia());
  const store = useWorkspace();
  const a = store.addRegion([0, 0]);
  const b = store.addRegion([10, 20]);
  a.range.startDate = '2001-01-01';
  assert.notEqual(a.color, b.color);
  assert.notEqual(a.range.startDate, b.range.startDate);
});

test('region colors remain distinct after the initial palette is exhausted', () => {
  setActivePinia(createPinia());
  const store = useWorkspace();
  for (let i = 0; i < 15; i++) store.addRegion([i, 30]);
  assert.equal(new Set(store.regions.map((r) => r.color)).size, 15);
});
