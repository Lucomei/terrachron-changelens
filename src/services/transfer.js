import { zip, strToU8 } from 'fflate';
import { request as httpRequest } from './network.js';

export async function createPackage(selections, loadAsset, { signal, onProgress = () => {} } = {}) {
  if (!selections.length) throw new Error('请先选择要输出的区域');
  const manifest = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    crs: 'EPSG:4326',
    regions: [],
    images: [],
  };
  const files = [];
  for (const { region, observations } of selections) {
    manifest.regions.push({
      id: region.id,
      name: region.name,
      color: region.color,
      center: region.center,
      geometry: region.geometry,
      bbox: region.bbox,
      sizeMeters: region.sizeMeters,
      outputSize: region.outputSize,
      pixelProjection: region.projection,
      localExtent: [
        -region.sizeMeters / 2,
        -region.sizeMeters / 2,
        region.sizeMeters / 2,
        region.sizeMeters / 2,
      ],
      queryRange: { ...region.range },
    });
    for (const observation of [null, ...observations]) {
      signal?.throwIfAborted();
      const asset = await loadAsset(region, observation, { signal });
      if (!(asset.blob instanceof Blob) || !asset.blob.size)
        throw new Error(`${region.name} 的影像文件不可用`);
      const file = `images/${String(files.length + 1).padStart(3, '0')}_${observation ? 'historical' : 'latest'}.png`;
      files.push({ path: file, blob: asset.blob });
      manifest.images.push({
        regionId: region.id,
        observationId: observation?.id || null,
        kind: observation ? 'historical' : 'latest',
        file,
        mimeType: asset.blob.type,
        byteLength: asset.blob.size,
        providerId: observation?.providerId || 'esri-current',
        releaseId: observation?.releaseId || null,
        capturedAt: observation?.capturedAt ?? null,
        capturedDates: observation?.capturedDates || [],
        publishedAt: observation?.publishedAt || null,
        snapshotAt: asset.snapshotAt || region.latest.snapshotAt || null,
        metadata: observation?.metadata || null,
        queryRange: observation?.queryRange || null,
        source: observation?.tileTemplate || asset.source || null,
        sourceZoom: asset.zoom ?? null,
        attribution: observation?.attribution || asset.attribution || null,
      });
      onProgress({ done: files.length, regionName: region.name });
    }
  }
  signal?.throwIfAborted();
  return { manifest, files };
}

export async function toZip(pkg) {
  const entries = { 'manifest.json': strToU8(JSON.stringify(pkg.manifest, null, 2)) };
  for (const file of pkg.files) entries[file.path] = new Uint8Array(await file.blob.arrayBuffer());
  const bytes = await new Promise((resolve, reject) =>
    zip(entries, { level: 0 }, (error, output) => (error ? reject(error) : resolve(output))),
  );
  return new Blob([bytes], { type: 'application/zip' });
}

export async function sendPackage(endpoint, pkg, { signal, request = httpRequest } = {}) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('请配置有效的 HTTP 接收地址');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('接收地址须为 HTTP(S)，且不能包含用户名或密码');
  const form = new FormData();
  form.append('manifest', JSON.stringify(pkg.manifest));
  for (const file of pkg.files) form.append('files', file.blob, file.path.replaceAll('/', '__'));
  // Each image's multipart field filename is deterministic from its ZIP path.
  form.append(
    'fileMap',
    JSON.stringify(
      Object.fromEntries(pkg.files.map((f) => [f.path, f.path.replaceAll('/', '__')])),
    ),
  );
  const response = await request(url.href, { method: 'POST', body: form, signal, timeout: 120000 });
  if (!response.ok) throw new Error(`接收服务返回 HTTP ${response.status}`);
  return { status: response.status, body: await response.text() };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
