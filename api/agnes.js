const AGNES_URL = 'https://apihub.agnes-ai.com/v1/chat/completions';
function jsonFromModel(content) {
  if (typeof content === 'object' && content) return content;
  const text = String(content || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(text);
  } catch {
    return { summary: text || '模型未返回可解析内容。', findings: [] };
  }
}
export default async function handler(request, response) {
  if (request.method !== 'POST')
    return response.status(405).json({ code: 405, error: '只支持 POST 请求' });
  if (!process.env.AGNES_API_KEY)
    return response.status(503).json({ code: 503, error: '服务端尚未配置 AGNES_API_KEY' });
  const { image, currentImage, poiData, historicalPoiData, imageMeta, currentImageMeta, prompt } =
    request.body || {};
  if (!image?.base64 || !image?.mimeType || !currentImage?.base64 || !currentImage?.mimeType)
    return response.status(400).json({ code: 400, error: '请同时提供历史影像和最新影像' });
  const system =
    '你是卫星遥感变化检测助手。仅依据给定的历史影像、最新影像与 POI 上下文作出谨慎分析，不足以判断时必须说明不确定性。必须只返回合法 JSON。';
  const userPrompt = prompt || '比较历史卫星影像和最新卫星影像，结合最新 POI 判断地表变化。';
  const expected = {
    changed: 'boolean 或 null',
    before_type: '字符串或 null',
    after_type: '字符串或 null',
    description: '中文说明',
    confidence: '0 到 1',
    findings: [{ title: '发现', description: '说明', confidence: '0 到 1' }],
  };
  try {
    const upstream = await fetch(AGNES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AGNES_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'agnes-2.5-flash',
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${userPrompt}\n\n第一张为历史影像（${imageMeta?.acquired_at || '日期未知'}），第二张为最新影像（${currentImageMeta?.acquired_at || '获取日期未知'}）。请对比两张图，并以最新 POI 为当前参考。\n最新 POI：${JSON.stringify(poiData || {})}\n历史 POI（仅在可获得时提供）：${JSON.stringify(historicalPoiData || null)}\n历史影像元数据：${JSON.stringify(imageMeta || {})}\n最新影像元数据：${JSON.stringify(currentImageMeta || {})}\n\n按此结构返回：${JSON.stringify(expected)}`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
              },
              {
                type: 'image_url',
                image_url: { url: `data:${currentImage.mimeType};base64,${currentImage.base64}` },
              },
            ],
          },
        ],
      }),
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok)
      return response.status(upstream.status).json({
        code: upstream.status,
        error: payload.error?.message || payload.message || 'Agnes 服务请求失败',
      });
    const result = jsonFromModel(payload.choices?.[0]?.message?.content);
    return response.status(200).json({
      code: 0,
      message: 'success',
      request_id: payload.id || `agnes_${Date.now()}`,
      data: {
        task_type: 'comprehensive',
        result_format: 'json',
        result: {
          change: result,
          summary: result.description || '',
          findings: result.findings || [],
        },
        meta: { model_version: payload.model || 'agnes-2.5-flash', provider: 'Agnes' },
      },
    });
  } catch (error) {
    return response.status(502).json({ code: 502, error: error.message || 'Agnes 服务不可用' });
  }
}
