async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function createAgnesClient({ endpoint = '/api/agnes', fetchImpl = fetch } = {}) {
  return {
    configured: true,
    async analyzeChange({
      image,
      filename = 'historical.png',
      poiData,
      imageMeta,
      prompt,
      signal,
    } = {}) {
      if (!(image instanceof Blob)) throw new Error('缺少可提交的历史影像');
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: {
            base64: await blobToBase64(image),
            mimeType: image.type || 'image/png',
            filename,
          },
          poiData,
          imageMeta,
          prompt,
        }),
        signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.code !== 0)
        throw new Error(payload.error || payload.message || 'Agnes 请求失败');
      return payload;
    },
    health: async () => ({ status: 'proxy' }),
    modelInfo: async () => ({ model: 'agnes-2.5-flash' }),
  };
}
