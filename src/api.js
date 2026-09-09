import { useWorkspace } from './stores/workspace.js';
import { cropImagery } from './services/imagery.js';
import { searchClosestHistory, searchHistory } from './services/history.js';
import { historyProviders } from './services/providers/esri.js';
import { fetchPoiDescription } from './services/poi.js';

/** Public API factory. All component and external operations use the same boundary. */
export function createTerraChronApi(pinia) {
  const store = useWorkspace(pinia);
  const regionById = (id) => {
    const region = store.regions.find((r) => r.id === id);
    if (!region) throw new Error('找不到该区域');
    return region;
  };

  async function createRegion({ center }) {
    const region = store.addRegion(center);
    await store.captureLatest(region.id, (r, options) => cropImagery(r, null, options));
    await store.loadPoi(region.id, (r, options) => fetchPoiDescription(r.center, options));
    return region;
  }

  async function fetchClosestHistory({ regionId, timePoint, providerId = 'esri-wayback' }) {
    const region = regionById(regionId);
    const provider = historyProviders.find((p) => p.id === providerId);
    if (!provider) throw new Error('该来源不支持历史查询');
    region.timePoint = { ...timePoint };
    region.providerId = providerId;
    await store.queryRegion(regionId, (r, options) =>
      searchClosestHistory(r, options.range, provider, options),
    );
    const observationId = region.history.closest?.observation?.id;
    if (observationId) await getImageAsset({ regionId, observationId });
    return region.history;
  }

  async function queryHistory({ regionId, startDate, endDate, providerId = 'esri-wayback' }) {
    const region = regionById(regionId);
    const provider = historyProviders.find((p) => p.id === providerId);
    if (!provider) throw new Error('该来源不支持历史查询');
    region.range = { startDate, endDate };
    region.providerId = providerId;
    await store.queryRegion(
      regionId,
      (r, options) => searchHistory(r, options.range, provider, options),
      { startDate, endDate },
    );
    return region.history;
  }

  async function getImageAsset({ regionId, observationId = null, signal }) {
    const region = regionById(regionId);
    if (!observationId) {
      if (!region.latest.blob) throw new Error('最新影像尚未截取成功，请先重试截取');
      return region.latest;
    }
    if (region.assets[observationId]?.blob) return region.assets[observationId];
    const observation = [...region.history.observations, ...region.history.unknown].find(
      (o) => o.id === observationId,
    );
    if (!observation) throw new Error('历史记录已失效，请重新查询');
    const asset = await cropImagery(region, observation, { signal });
    signal?.throwIfAborted();
    if (!store.regions.some((r) => r.id === region.id))
      throw new DOMException('区域已删除', 'AbortError');
    // Concurrent consumers may have completed the same asset while this crop ran.
    if (region.assets[observationId]?.blob) return region.assets[observationId];
    region.assets[observationId] = { ...asset, url: URL.createObjectURL(asset.blob) };
    return region.assets[observationId];
  }

  async function packageSelection({ regionIds, observationIds }, options) {
    const { createPackage } = await import('./services/transfer.js');
    const selections = regionIds.map((id) => {
      const region = regionById(id);
      const ids = observationIds ?? region.checkedIds;
      const observations = [...region.history.observations, ...region.history.unknown].filter((o) =>
        ids.includes(o.id),
      );
      return { region, observations };
    });
    return createPackage(
      selections,
      (region, observation, opts) =>
        getImageAsset({ regionId: region.id, observationId: observation?.id, ...opts }),
      options,
    );
  }

  return {
    createRegion,
    queryHistory,
    fetchClosestHistory,
    getImageAsset,
    refreshLatest: (id) => store.captureLatest(id, (r, options) => cropImagery(r, null, options)),
    cancel: (id, kind) => store.cancelRegion(id, kind),
    exportSelection: async (selection, options) => {
      const { toZip } = await import('./services/transfer.js');
      const pkg = await packageSelection(selection, options);
      return { ...pkg, zip: await toZip(pkg) };
    },
    sendSelection: async ({ endpoint, ...selection }, options) => {
      const { sendPackage } = await import('./services/transfer.js');
      const pkg = await packageSelection(selection, options);
      return sendPackage(endpoint, pkg, options);
    },
    getRegions: () =>
      store.regions.map((r) => ({
        id: r.id,
        name: r.name,
        center: [...r.center],
        color: r.color,
        geometry: r.geometry,
      })),
  };
}
