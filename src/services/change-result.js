export function normalizeModelResult(response) {
  const data = response?.data || {};
  const format = data.result_format;
  const result = data.result;
  if (format === 'markdown')
    return { requestId: response.request_id || '', format, markdown: typeof result === 'string' ? result : '', summary: '', change: null, findings: [], regions: [], artifacts: [], meta: data.meta || {} };
  const change = result?.change;
  return {
    requestId: response?.request_id || '',
    format: 'json',
    markdown: '',
    summary: result?.summary || '',
    change: change
      ? { changed: Boolean(change.changed), beforeType: change.before_type || '', afterType: change.after_type || '', description: change.description || '', confidence: Number.isFinite(change.confidence) ? change.confidence : null, regions: change.regions || [] }
      : null,
    findings: result?.findings || [],
    regions: result?.regions || [],
    artifacts: result?.artifacts || [],
    meta: data.meta || {},
    raw: result || {},
  };
}
