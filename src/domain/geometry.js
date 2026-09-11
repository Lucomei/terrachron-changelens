import proj4 from 'proj4';

// Esri World Imagery is sampled from its highest supported, practical tile level.
// The output count is derived from this source grid, rather than chosen by the user.
export const CAPTURE_LIMITS = { minMeters: 32, maxMeters: 2048, maxPixels: 2048, maxZoom: 19 };

export function sourceGroundResolution(latitude, zoom = CAPTURE_LIMITS.maxZoom) {
  return (156543.033928 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
}

export function recommendedOutputSize(center, sizeMeters) {
  const nativePixels = Math.ceil(sizeMeters / sourceGroundResolution(center[1]));
  return Math.min(CAPTURE_LIMITS.maxPixels, nativePixels);
}

function specification(center, { sizeMeters = 256, outputSize } = {}) {
  const meters = Number(sizeMeters);
  if (
    !Number.isInteger(meters) ||
    meters < CAPTURE_LIMITS.minMeters ||
    meters > CAPTURE_LIMITS.maxMeters
  )
    throw new Error(`范围须为 ${CAPTURE_LIMITS.minMeters} 至 ${CAPTURE_LIMITS.maxMeters} 米的整数`);
  const pixels = outputSize == null ? recommendedOutputSize(center, meters) : Number(outputSize);
  if (!Number.isInteger(pixels) || pixels < 1 || pixels > CAPTURE_LIMITS.maxPixels)
    throw new Error(`自动输出像素须在 1 至 ${CAPTURE_LIMITS.maxPixels} 之间`);
  return { sizeMeters: meters, outputSize: pixels };
}

export function createFootprint(center, options = {}) {
  if (!Array.isArray(center) || center.length !== 2 || !center.every(Number.isFinite))
    throw new Error('请输入有效的经度和纬度');
  const [lng, lat] = center;
  if (Math.abs(lng) > 180 || Math.abs(lat) > 75)
    throw new Error('经度须在 -180° 至 180°，纬度须在 -75° 至 75°');
  const { sizeMeters, outputSize } = specification(center, options);
  const half = sizeMeters / 2;
  const projection = `+proj=tmerc +lat_0=${lat} +lon_0=${lng} +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs`;
  const transform = proj4(projection, 'EPSG:4326');
  const corners = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
    [-half, -half],
  ];
  const ring = corners.map((point) => transform.forward(point));
  if (ring.some((point) => Math.abs(point[0] - lng) > 1))
    throw new Error('暂不支持跨越日期变更线的区域，请稍微移动中心点');
  return {
    center: [...center],
    sizeMeters,
    outputSize,
    projection,
    geometry: { type: 'Polygon', coordinates: [ring] },
    bbox: [
      Math.min(...ring.map((p) => p[0])),
      Math.min(...ring.map((p) => p[1])),
      Math.max(...ring.map((p) => p[0])),
      Math.max(...ring.map((p) => p[1])),
    ],
  };
}

export function worldPixel([lng, lat], zoom) {
  const scale = 256 * 2 ** zoom;
  const sine = Math.sin((lat * Math.PI) / 180);
  return [
    ((lng + 180) / 360) * scale,
    (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale,
  ];
}
export function pixelLonLat([x, y], zoom) {
  const scale = 256 * 2 ** zoom;
  return [
    (x / scale) * 360 - 180,
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI,
  ];
}
export function tileCoverage(footprint) {
  // Match the fetched Esri source grid to the generated raster.  For a small
  // footprint this reaches level 19; when the 2048 px output safety cap is
  // reached, a coarser level is the highest useful level instead of downloading
  // hundreds of unused high-resolution tiles.
  const desiredMetersPerPixel = footprint.sizeMeters / footprint.outputSize;
  const zoom = Math.min(
    CAPTURE_LIMITS.maxZoom,
    Math.max(
      0,
      Math.ceil(
        Math.log2(
          (156543.033928 * Math.cos((footprint.center[1] * Math.PI) / 180)) /
            desiredMetersPerPixel,
        ),
      ),
    ),
  );
  const pixels = footprint.geometry.coordinates[0].map((point) => worldPixel(point, zoom));
  const minX = Math.floor(Math.min(...pixels.map((p) => p[0])) / 256),
    maxX = Math.floor(Math.max(...pixels.map((p) => p[0])) / 256),
    minY = Math.floor(Math.min(...pixels.map((p) => p[1])) / 256),
    maxY = Math.floor(Math.max(...pixels.map((p) => p[1])) / 256);
  const tiles = [];
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++)
      tiles.push({ x, y, z: zoom, center: pixelLonLat([x * 256 + 128, y * 256 + 128], zoom) });
  return { zoom, minX, maxX, minY, maxY, tiles };
}
