function endpoint(baseUrl, path) {
  if (!baseUrl?.trim())
    throw new Error('尚未配置本地模型地址：请设置 VITE_MODEL_API_BASE');
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function readResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.code !== 0)
    throw new Error(payload?.message || `模型服务返回 HTTP ${response.status}`);
  return payload;
}

export function createModelClient({ baseUrl = '', fetchImpl = fetch } = {}) {
  const request = async (path, options = {}) => readResponse(await fetchImpl(endpoint(baseUrl, path), options));
  return {
    configured: Boolean(baseUrl?.trim()),
    health: ({ signal } = {}) => request('/health', { signal }),
    modelInfo: ({ signal } = {}) => request('/model/info', { signal }),
    async analyzeChange({ image, filename = 'historical.png', poiData, imageMeta, taskType = 'comprehensive', resultFormat = 'json', options = {}, signal } = {}) {
      const url = endpoint(baseUrl, '/analyze');
      if (!(image instanceof Blob) || !image.size) throw new Error('请选择已获取的历史影像后再进行模型检测');
      const form = new FormData();
      form.append('image', image, filename);
      form.append('poi_data', JSON.stringify(poiData || { pois: [] }));
      form.append('image_meta', JSON.stringify(imageMeta || {}));
      form.append('task_type', taskType);
      form.append('result_format', resultFormat);
      form.append('options', JSON.stringify({ language: 'zh-CN', return_confidence: true, return_regions: true, return_poi_analysis: true, ...options }));
      return readResponse(await fetchImpl(url, { method: 'POST', body: form, signal }));
    },
  };
}
