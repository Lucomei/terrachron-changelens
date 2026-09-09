import proj4 from 'proj4';
import { tileCoverage, worldPixel } from '../domain/geometry.js';
import { request, mapConcurrent } from './network.js';
import { CURRENT_TILES, ESRI_ATTRIBUTION } from './providers/esri.js';

export async function cropImagery(region, observation = null, { signal } = {}) {
  const coverage = tileCoverage(region);
  const template = observation?.tileTemplate || CURRENT_TILES;
  if (observation && !observation.tileTemplate) throw new Error('历史记录缺少影像地址');
  const canvas = document.createElement('canvas');
  canvas.width = (coverage.maxX - coverage.minX + 1) * 256;
  canvas.height = (coverage.maxY - coverage.minY + 1) * 256;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  await mapConcurrent(
    coverage.tiles,
    4,
    async (tile) => {
      const url = template.replace('{z}', tile.z).replace('{y}', tile.y).replace('{x}', tile.x);
      const response = await request(url, { signal });
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('影像服务没有返回图片');
      const bitmap = await createImageBitmap(blob);
      try {
        signal?.throwIfAborted();
        context.drawImage(
          bitmap,
          (tile.x - coverage.minX) * 256,
          (tile.y - coverage.minY) * 256,
          256,
          256,
        );
      } finally {
        bitmap.close();
      }
    },
    signal,
  );
  signal?.throwIfAborted();
  const input = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const output = document.createElement('canvas');
  output.width = region.outputSize;
  output.height = region.outputSize;
  const ctx = output.getContext('2d');
  const raster = ctx.createImageData(output.width, output.height);
  const inverse = proj4(region.projection, 'EPSG:4326');
  // Reproject every output pixel from the local ground-meter grid to the source mosaic.
  // This avoids latitude-dependent distances and stretching a geographic bounding box.
  for (let row = 0; row < output.height; row++) {
    if (row % 64 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      signal?.throwIfAborted();
    }
    for (let col = 0; col < output.width; col++) {
      const ground = [
        ((col + 0.5) / output.width) * 256 - 128,
        128 - ((row + 0.5) / output.height) * 256,
      ];
      const [px, py] = worldPixel(inverse.forward(ground), coverage.zoom);
      const x = Math.floor(px - coverage.minX * 256),
        y = Math.floor(py - coverage.minY * 256);
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height)
        throw new Error('区域超出下载影像范围');
      const src = (y * canvas.width + x) * 4,
        dest = (row * output.width + col) * 4;
      raster.data[dest] = input[src];
      raster.data[dest + 1] = input[src + 1];
      raster.data[dest + 2] = input[src + 2];
      raster.data[dest + 3] = input[src + 3];
    }
  }
  ctx.putImageData(raster, 0, 0);
  const blob = await new Promise((resolve, reject) =>
    output.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('影像编码失败'))),
      'image/png',
    ),
  );
  signal?.throwIfAborted();
  return {
    blob,
    snapshotAt: new Date().toISOString(),
    source: template,
    zoom: coverage.zoom,
    attribution: ESRI_ATTRIBUTION,
  };
}
