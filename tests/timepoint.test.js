import test from 'node:test';
import assert from 'node:assert/strict';
import { findClosestObservation, normalizeTimePoint } from '../src/domain/timepoint.js';

test('normalizes a year, year-month, or complete date to an explicit matching point', () => {
  assert.deepEqual(normalizeTimePoint({ year: '2020', month: '', day: '' }), {
    precision: 'year',
    date: '2020-07-01',
  });
  assert.deepEqual(normalizeTimePoint({ year: '2020', month: '02', day: '' }), {
    precision: 'month',
    date: '2020-02-15',
  });
  assert.deepEqual(normalizeTimePoint({ year: '2020', month: '02', day: '29' }), {
    precision: 'day',
    date: '2020-02-29',
  });
});

test('requires a year and a month before a day', () => {
  assert.throws(() => normalizeTimePoint({ year: '', month: '', day: '' }), /年份/);
  assert.throws(() => normalizeTimePoint({ year: '2020', month: '', day: '12' }), /月份/);
});

test('finds the record with the captured date closest to the selected time point', () => {
  const result = findClosestObservation(
    [
      { id: 'old', capturedDates: ['2019-12-20'] },
      { id: 'near', capturedDates: ['2020-07-03', '2020-09-01'] },
      { id: 'far', capturedDates: ['2021-01-01'] },
      { id: 'unknown', capturedDates: [] },
    ],
    { year: '2020', month: '', day: '' },
  );
  assert.equal(result.observation.id, 'near');
  assert.equal(result.capturedAt, '2020-07-03');
  assert.equal(result.target.date, '2020-07-01');
});
