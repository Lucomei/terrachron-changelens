import test from 'node:test';
import assert from 'node:assert/strict';
import { searchHistory } from '../src/services/history.js';
import { createFootprint } from '../src/domain/geometry.js';

test('filters acquisition dates, preserves unknown dates and discoveries outside the center tile', async () => {
  const region = { id: 'r1', ...createFootprint([116.397, 39.908]) };
  const provider = {
    id: 'esri-wayback',
    async discover() {
      return [
        { releaseId: 'new', publishedAt: '2025-01-01' },
        { releaseId: 'old', publishedAt: '2023-01-01' },
        { releaseId: 'unknown', publishedAt: '2021-01-01' },
        { releaseId: 'partial', publishedAt: '2024-01-01' },
      ];
    },
    async metadata(region, release) {
      const dates = {
        new: ['2020-06-01'],
        old: ['2018-01-01'],
        unknown: [],
        partial: ['2019-01-01', '2020-07-01'],
      };
      return { capturedDates: dates[release.releaseId], dateScope: 'area', sources: [] };
    },
  };
  const result = await searchHistory(
    region,
    { startDate: '2020-01-01', endDate: '2020-12-31' },
    provider,
  );
  assert.deepEqual(result.observations.map((r) => r.releaseId).sort(), ['new', 'partial']);
  assert.equal(result.observations.find((r) => r.releaseId === 'partial').partialDateMatch, true);
  assert.equal(result.unknown[0].capturedAt, null);
  assert.equal(result.unknown[0].publishedAt, '2021-01-01');
});

test('reports metadata failures as partial results, never as certain no coverage', async () => {
  const provider = {
    id: 'test',
    discover: async () => [{ releaseId: '1' }],
    metadata: async () => {
      throw new Error('offline');
    },
  };
  const result = await searchHistory(
    { id: 'r' },
    { startDate: '2020-01-01', endDate: '2020-12-31' },
    provider,
  );
  assert.equal(result.warnings.length, 1);
  assert.equal(result.unknown.length, 1);
});

test('invalid date ranges and cancellation reject without querying', async () => {
  const provider = {
    discover: () => {
      throw new Error('should not query');
    },
  };
  await assert.rejects(
    searchHistory({}, { startDate: '2021-01-01', endDate: '2020-01-01' }, provider),
    /日期/,
  );
  await assert.rejects(
    searchHistory({}, { startDate: '2020-02-31', endDate: '2021-01-01' }, provider),
    /日期/,
  );
  await assert.rejects(
    searchHistory({}, { startDate: '2020-01-01', endDate: '2021-01-01' }, provider, {
      signal: AbortSignal.abort(),
    }),
    { name: 'AbortError' },
  );
});
