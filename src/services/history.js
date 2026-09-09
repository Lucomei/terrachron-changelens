import { mapConcurrent } from './network.js';
import { findClosestObservation, normalizeTimePoint } from '../domain/timepoint.js';

export function validateRange({ startDate, endDate }) {
  const valid = (date) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date || '') &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  if (!valid(startDate) || !valid(endDate) || startDate > endDate)
    throw new Error('请选择有效日期，开始日期不能晚于结束日期');
}

async function collectHistory(region, provider, { signal, onProgress = () => {} } = {}) {
  signal?.throwIfAborted();
  onProgress({ stage: '正在发现区域历史版本', done: 0, total: 0 });
  const releases = await provider.discover(region, { signal, onProgress });
  const warnings = [];
  let done = 0;
  const records = await mapConcurrent(
    releases,
    4,
    async (release) => {
      let metadata;
      try {
        metadata = await provider.metadata(region, release, { signal });
      } catch (error) {
        signal?.throwIfAborted();
        warnings.push(`${release.publishedAt || release.releaseId}：${error.message}`);
        metadata = { capturedDates: [], dateScope: 'unknown', sources: [], error: error.message };
      }
      onProgress({ stage: '正在核实拍摄日期', done: ++done, total: releases.length });
      const dates = [...new Set(metadata.capturedDates || [])].sort();
      return {
        ...release,
        id: `${region.id}_${provider.id}_${release.releaseId}`,
        regionId: region.id,
        providerId: provider.id,
        capturedAt: dates.length === 1 ? dates[0] : null,
        capturedDates: dates,
        partialDateMatch: false,
        metadata,
      };
    },
    signal,
  );
  return { records, warnings, scanned: releases.length };
}

export async function searchHistory(region, range, provider, options = {}) {
  validateRange(range);
  const { records, warnings, scanned } = await collectHistory(region, provider, options);
  const observations = records
    .filter((record) => record.capturedDates.some((date) => date >= range.startDate && date <= range.endDate))
    .map((record) => ({
      ...record,
      partialDateMatch: record.capturedDates.some(
        (date) => date < range.startDate || date > range.endDate,
      ),
      queryRange: { ...range },
    }));
  observations.sort((a, b) => b.capturedDates.at(-1).localeCompare(a.capturedDates.at(-1)));
  return {
    observations,
    unknown: records.filter((record) => !record.capturedDates.length),
    warnings,
    scanned,
  };
}

export async function searchClosestHistory(region, timePoint, provider, options = {}) {
  const target = normalizeTimePoint(timePoint);
  const { records, warnings, scanned } = await collectHistory(region, provider, options);
  const closest = findClosestObservation(records, timePoint);
  return {
    observations: closest.observation ? [closest.observation] : [],
    unknown: records.filter((record) => !record.capturedDates.length),
    warnings,
    scanned,
    closest,
    target,
  };
}
