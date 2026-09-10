import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeModelResult } from '../src/services/change-result.js';

test('renders an explicit change conclusion only when the model provides one', () => {
  const result = normalizeModelResult({
    request_id: 'req_1',
    data: {
      result_format: 'json',
      result: { summary: '更新', change: { changed: true, before_type: '农田', after_type: '住宅', confidence: 0.91 } },
      meta: { inference_time_ms: 4200 },
    },
  });
  assert.deepEqual(result.change, { changed: true, beforeType: '农田', afterType: '住宅', description: '', confidence: 0.91, regions: [] });
  assert.equal(result.requestId, 'req_1');
});

test('keeps generic model analysis separate from a change-detection claim', () => {
  const result = normalizeModelResult({
    data: { result_format: 'json', result: { summary: '城市建成区', findings: [] }, meta: {} },
  });
  assert.equal(result.change, null);
  assert.equal(result.summary, '城市建成区');
});

test('preserves a markdown report', () => {
  const result = normalizeModelResult({ data: { result_format: 'markdown', result: '# 分析报告', meta: {} } });
  assert.equal(result.markdown, '# 分析报告');
});
