import { jsonRequest, mapConcurrent } from '../network.js';
import { tileCoverage } from '../../domain/geometry.js';

export const CURRENT_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const ESRI_ATTRIBUTION = 'Esri, Vantor, Earthstar Geographics, and the GIS User Community';
const CATALOG = 'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json';
const WAYBACK = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer';

export function createEsriProvider(getJSON = jsonRequest) {
  let catalog = null;
  let catalogAt = 0;

  async function releases({ signal } = {}) {
    if (catalog && Date.now() - catalogAt < 300000) return catalog;
    const data = await getJSON(CATALOG, { signal });
    catalog = Object.entries(data)
      .map(([id, item]) => ({
        releaseId: id,
        publishedAt: item.itemTitle.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '',
        tileTemplate: item.itemURL
          .replace('{level}', '{z}')
          .replace('{row}', '{y}')
          .replace('{col}', '{x}'),
        metadataLayerUrl: item.metadataLayerUrl,
        itemId: item.itemID,
        attribution: ESRI_ATTRIBUTION,
      }))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    catalogAt = Date.now();
    return catalog;
  }

  async function discover(region, { signal, onProgress = () => {} } = {}) {
    const all = await releases({ signal });
    if (!all.length) throw new Error('历史版本目录为空');
    const indices = new Map(all.map((item, index) => [item.releaseId, index]));
    const coverage = tileCoverage(region);
    const found = new Set();
    let done = 0;
    await mapConcurrent(
      coverage.tiles,
      4,
      async (tile) => {
        let index = 0;
        while (index < all.length) {
          signal?.throwIfAborted();
          const data = await getJSON(
            `${WAYBACK}/tilemap/${all[index].releaseId}/${tile.z}/${tile.y}/${tile.x}`,
            { signal },
          );
          if (!Array.isArray(data.data)) throw new Error('历史覆盖服务返回了无法识别的数据');
          if (!data.data[0]) break;
          const selected = String(data.select?.[0] ?? '');
          const selectedIndex = indices.get(selected);
          if (selectedIndex === undefined || selectedIndex < index)
            throw new Error('历史覆盖与版本目录不一致，请重试');
          found.add(selected);
          index = selectedIndex + 1;
        }
        onProgress({ stage: '正在扫描区域覆盖', done: ++done, total: coverage.tiles.length });
      },
      signal,
    );
    return all.filter((item) => found.has(item.releaseId));
  }

  async function metadata(region, release, { signal } = {}) {
    if (!release.metadataLayerUrl) throw new Error('该版本未提供拍摄元数据');
    const { zoom } = tileCoverage(region);
    const params = new URLSearchParams({
      f: 'json',
      where: '1=1',
      outFields: 'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC',
      geometry: JSON.stringify({
        rings: [region.geometry.coordinates[0].slice().reverse()],
        spatialReference: { wkid: 4326 },
      }),
      geometryType: 'esriGeometryPolygon',
      spatialRel: 'esriSpatialRelIntersects',
      inSR: '4326',
      outSR: '4326',
      returnGeometry: 'true',
      resultRecordCount: '1000',
    });
    const data = await getJSON(`${release.metadataLayerUrl}/${23 - zoom}/query?${params}`, {
      signal,
    });
    if (data.exceededTransferLimit)
      throw new Error('区域元数据超过服务返回上限，无法确定完整日期覆盖');
    if (!Array.isArray(data.features)) throw new Error('元数据服务没有返回有效记录');
    const sources = data.features.map((feature) => {
      const raw = feature.attributes;
      const timestamp = Number(raw.SRC_DATE2);
      const capturedAt =
        raw.SRC_DATE2 != null && timestamp > 0 && Number.isFinite(timestamp)
          ? new Date(timestamp).toISOString().slice(0, 10)
          : null;
      return {
        capturedAt,
        provider: raw.NICE_DESC || null,
        source: raw.SRC_DESC || null,
        resolution: raw.SAMP_RES ?? null,
        accuracy: raw.SRC_ACC ?? null,
        coverageGeometry: feature.geometry || null,
        raw,
      };
    });
    return {
      dateScope: 'area-intersections',
      capturedDates: [...new Set(sources.map((s) => s.capturedAt).filter(Boolean))].sort(),
      hasUnknownDates: !sources.length || sources.some((s) => !s.capturedAt),
      sources,
      metadataUrl: `${release.metadataLayerUrl}/${23 - zoom}/query?${params}`,
    };
  }

  return {
    id: 'esri-wayback',
    label: 'Esri Wayback',
    supportsHistory: true,
    releases,
    discover,
    metadata,
  };
}

export const esriProvider = createEsriProvider();
export const historyProviders = [esriProvider];
