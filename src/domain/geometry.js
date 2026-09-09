import proj4 from 'proj4';

export function createFootprint(center) {
  if (!Array.isArray(center) || center.length !== 2 || !center.every(Number.isFinite)) {
    throw new Error('请输入有效的经度和纬度');
  }
  const [lng, lat] = center;
  if (Math.abs(lng) > 180 || Math.abs(lat) > 75) {
    throw new Error('经度须在 -180° 至 180°，纬度须在 -75° 至 75°');
  }
  const projection = `+proj=tmerc +lat_0=${lat} +lon_0=${lng} +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs`;
  const transform = proj4(projection, 'EPSG:4326');
  const corners = [
    [-128, -128],
    [128, -128],
    [128, 128],
    [-128, 128],
    [-128, -128],
  ];
  const ring = corners.map((point) => transform.forward(point));
  if (ring.some((point) => Math.abs(point[0] - lng) > 1)) {
    throw new Error('暂不支持跨越日期变更线的区域，请稍微移动中心点');
  }
  return {
    center: [...center],
    sizeMeters: 256,
    outputSize: 512,
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
  const zoom = Math.min(
    19,
    Math.ceil(Math.log2((156543.033928 * Math.cos((footprint.center[1] * Math.PI) / 180)) / 0.5)),
  );
  const pixels = footprint.geometry.coordinates[0].map((point) => worldPixel(point, zoom));
  const minX = Math.floor(Math.min(...pixels.map((p) => p[0])) / 256);
  const maxX = Math.floor(Math.max(...pixels.map((p) => p[0])) / 256);
  const minY = Math.floor(Math.min(...pixels.map((p) => p[1])) / 256);
  const maxY = Math.floor(Math.max(...pixels.map((p) => p[1])) / 256);
  const tiles = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      tiles.push({ x, y, z: zoom, center: pixelLonLat([x * 256 + 128, y * 256 + 128], zoom) });
    }
  }
  return { zoom, minX, maxX, minY, maxY, tiles };
}
