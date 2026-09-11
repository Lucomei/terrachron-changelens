async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

// The original PNG remains in the region library.  This is only the transport
// copy sent to the serverless proxy: two large base64 PNGs can exceed Vercel's
// request-body limit before the request ever reaches the Agnes API.
async function modelTransportImage(blob) {
  const maxSide = 1024;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const compressed = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    return compressed || blob;
  } finally {
    bitmap.close();
  }
}

async function encodeImage(image, filename, role) {
  if (!(image instanceof Blob)) throw new Error(`缺少${role}`);
  const transport = await modelTransportImage(image);
  const isJpeg = transport.type === 'image/jpeg';
  return {
    base64: await blobToBase64(transport),
    mimeType: transport.type || 'image/png',
    filename: isJpeg ? filename.replace(/\.[^.]+$/, '.jpg') : filename,
  };
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
