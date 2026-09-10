async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

async function encodeImage(image, filename, role) {
  if (!(image instanceof Blob)) throw new Error(`缺少${role}`);
  return { base64: await blobToBase64(image), mimeType: image.type || 'image/png', filename };
}

export function createAgnesClient({ endpoint = '/api/agnes', fetchImpl = fetch } = {}) {
  return {
    configured: true,
    async analyzeChange({
      image,
      currentImage,
      filename = 'historical.png',
      currentFilename = 'current.png',
      poiData,
      historicalPoiData,
      imageMeta,
      currentImageMeta,
      prompt,
      signal,
    } = {}) {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: await encodeImage(image, filename, '历史影像'),
          currentImage: await encodeImage(currentImage, currentFilename, '最新影像'),
          poiData,
          ...(historicalPoiData ? { historicalPoiData } : {}),
          imageMeta,
          currentImageMeta,
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
