import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { createFootprint } from '../domain/geometry.js';

const palette = ['#60b6ff', '#f6bd60', '#79d5b0', '#c5a3ff', '#fa8e9b', '#64d8e8'];
const today = () => new Date().toISOString().slice(0, 10);
function regionColor(number, used) {
  if (number <= palette.length) return palette[number - 1];
  let attempt = 0;
  let color;
  do {
    const hue = ((number + attempt++) * 137.507764) % 360;
    const channel = (n) => {
      const k = (n + hue / 30) % 12;
      return Math.round(255 * (0.68 - 0.24 * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
        .toString(16)
        .padStart(2, '0');
    };
    color = `#${channel(0)}${channel(8)}${channel(4)}`;
  } while (used.has(color));
  return color;
}

export const useWorkspace = defineStore('workspace', () => {
  const regions = ref([]);
  const activeId = ref(null);
  const basemap = ref('esri');
  const pickMode = ref(false);
  const draftCenter = ref([121.4737, 31.2304]);
  const focusRequest = ref(0);
  const activeRegion = computed(() => regions.value.find((r) => r.id === activeId.value) || null);
  const jobs = new Map();
  let sequence = 0;

  function addRegion(center) {
    const footprint = createFootprint(center);
    const number = ++sequence;
    const region = {
      ...footprint,
      id: crypto.randomUUID(),
      name: `区域 ${String(number).padStart(2, '0')}`,
      color: regionColor(number, new Set(regions.value.map((r) => r.color))),
      visible: true,
      range: { startDate: '2014-01-01', endDate: today() },
      providerId: 'esri-wayback',
      latest: { status: 'idle', url: null, blob: null, error: '', acquiredAt: null },
      history: {
        status: 'idle',
        observations: [],
        unknown: [],
        warnings: [],
        progress: null,
        error: '',
        queryRange: null,
      },
      selectedObservationId: null,
      checkedIds: [],
      assets: {},
    };
    regions.value.push(region);
    activeId.value = region.id;
    return regions.value.at(-1);
  }

  function cancelRegion(id, kind = 'history') {
    const key = `${id}:${kind}`;
    jobs.get(key)?.abort();
    jobs.delete(key);
    const region = regions.value.find((r) => r.id === id);
    if (region && kind === 'history' && region.history.status === 'loading')
      region.history.status = 'cancelled';
    if (region && kind === 'latest' && region.latest.status === 'loading')
      region.latest.status = 'cancelled';
  }

  async function queryRegion(id, query) {
    const region = regions.value.find((r) => r.id === id);
    if (!region) throw new Error('区域已删除');
    cancelRegion(id);
    const key = `${id}:history`;
    const controller = new AbortController();
    jobs.set(key, controller);
    region.history.status = 'loading';
    region.history.error = '';
    const range = { ...region.range };
    try {
      const result = await query(region, {
        signal: controller.signal,
        range,
        onProgress: (progress) => {
          if (!controller.signal.aborted) region.history.progress = progress;
        },
      });
      if (controller.signal.aborted || !regions.value.includes(region)) return;
      Object.assign(region.history, result, { status: 'ready', queryRange: range });
      const ids = new Set([...result.observations, ...result.unknown].map((r) => r.id));
      region.checkedIds = region.checkedIds.filter((id) => ids.has(id));
      region.selectedObservationId = result.observations[0]?.id || null;
    } catch (error) {
      if (!controller.signal.aborted)
        Object.assign(region.history, { status: 'error', error: error.message });
    } finally {
      if (jobs.get(key) === controller) jobs.delete(key);
    }
  }

  async function captureLatest(id, capture) {
    const region = regions.value.find((r) => r.id === id);
    if (!region) throw new Error('区域已删除');
    cancelRegion(id, 'latest');
    const key = `${id}:latest`;
    const controller = new AbortController();
    jobs.set(key, controller);
    Object.assign(region.latest, { status: 'loading', error: '' });
    try {
      const asset = await capture(region, { signal: controller.signal });
      if (controller.signal.aborted || !regions.value.includes(region)) return;
      if (region.latest.url) URL.revokeObjectURL(region.latest.url);
      Object.assign(region.latest, asset, {
        url: URL.createObjectURL(asset.blob),
        status: 'ready',
      });
    } catch (error) {
      if (!controller.signal.aborted)
        Object.assign(region.latest, { status: 'error', error: error.message });
    } finally {
      if (jobs.get(key) === controller) jobs.delete(key);
    }
  }

  function removeRegion(id) {
    const region = regions.value.find((r) => r.id === id);
    if (!region) return;
    cancelRegion(id);
    cancelRegion(id, 'latest');
    for (const asset of [region.latest, ...Object.values(region.assets)]) {
      if (asset.url) URL.revokeObjectURL(asset.url);
    }
    regions.value = regions.value.filter((r) => r.id !== id);
    if (activeId.value === id) activeId.value = regions.value[0]?.id || null;
  }

  return {
    regions,
    activeId,
    activeRegion,
    basemap,
    pickMode,
    draftCenter,
    focusRequest,
    addRegion,
    removeRegion,
    cancelRegion,
    queryRegion,
    captureLatest,
  };
});
