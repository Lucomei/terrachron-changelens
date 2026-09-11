<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { Fill, Stroke, Style, Text } from 'ol/style.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { ScaleLine, defaults as controls } from 'ol/control.js';
import { useWorkspace } from '../stores/workspace.js';
import { createFootprint } from '../domain/geometry.js';
import { CURRENT_TILES, ESRI_ATTRIBUTION } from '../services/providers/esri.js';

const store = useWorkspace();
const target = ref(null);
const mapError = ref('');
let map, base;
const vector = new VectorSource();
const current = new XYZ({
  url: CURRENT_TILES,
  maxZoom: 19,
  crossOrigin: 'anonymous',
  attributions: ESRI_ATTRIBUTION,
});
const streets = new OSM();
function draw() {
  vector.clear();
  const regions = store.regions.filter((r) => r.visible);
  const draftIsCaptured = regions.some((r) =>
    r.center.every((value, i) => value === store.draftCenter[i]),
  );
  try {
    if (!draftIsCaptured || store.pickMode)
      regions.push({
        ...createFootprint(store.draftCenter, store.draftSpec),
        id: 'draft',
        name: store.draftSpec.sizeMeters + ' × ' + store.draftSpec.sizeMeters + ' m',
        color: '#ffffff',
      });
  } catch {
    /* Invalid draft stays outside the map. */
  }
  for (const region of regions) {
    const feature = new Feature(
      new Polygon(region.geometry.coordinates).transform('EPSG:4326', 'EPSG:3857'),
    );
    feature.set('regionId', region.id);
    const draft = region.id === 'draft';
    feature.setStyle(
      new Style({
        stroke: new Stroke({
          color: region.color,
          width: region.id === store.activeId ? 3 : 2,
          lineDash: draft ? [6, 6] : undefined,
        }),
        fill: new Fill({ color: `${region.color}${draft ? '09' : '18'}` }),
        text: new Text({
          text: region.name,
          font: '600 12px sans-serif',
          offsetY: -14,
          fill: new Fill({ color: region.color }),
          stroke: new Stroke({ color: '#0a1725', width: 4 }),
        }),
      }),
    );
    vector.addFeature(feature);
  }
}

onMounted(() => {
  base = new TileLayer({ source: current });
  map = new Map({
    target: target.value,
    layers: [base, new VectorLayer({ source: vector })],
    controls: controls({ attributionOptions: { collapsible: true, collapsed: true } }).extend([
      new ScaleLine(),
    ]),
    view: new View({ center: fromLonLat(store.draftCenter), zoom: 16, minZoom: 2, maxZoom: 20 }),
  });
  current.on('tileloaderror', () => {
    mapError.value = '底图暂时无法加载，请检查网络或切换街道图定位';
  });
  current.on('tileloadend', () => {
    mapError.value = '';
  });
  map.on('singleclick', (event) => {
    if (store.pickMode) {
      const center = toLonLat(event.coordinate);
      center[0] = ((((center[0] + 180) % 360) + 360) % 360) - 180;
      store.draftCenter = center.map((v) => Number(v.toFixed(6)));
      store.pickMode = false;
    } else {
      const id = map.forEachFeatureAtPixel(event.pixel, (feature) => feature.get('regionId'));
      if (id && id !== 'draft') store.activeId = id;
    }
  });
  draw();
});
watch(
  () => [
    store.regions.map((r) => [r.id, r.visible, r.color]),
    store.activeId,
    store.draftCenter,
    store.draftSpec,
    store.pickMode,
  ],
  draw,
  { deep: true },
);
watch(
  () => store.basemap,
  (value) => {
    base?.setSource(value === 'osm' ? streets : current);
    mapError.value = '';
  },
);
watch(
  () => store.focusRequest,
  () => map?.getView().animate({ center: fromLonLat(store.draftCenter), zoom: 18, duration: 650 }),
);
watch(
  () => store.activeId,
  () => {
    if (store.activeRegion)
      map?.getView().animate({ center: fromLonLat(store.activeRegion.center), duration: 500 });
  },
);
onBeforeUnmount(() => {
  map?.setTarget(undefined);
  map?.dispose();
});
</script>

<template>
  <div
    ref="target"
    class="main-map"
    :class="{ picking: store.pickMode }"
    data-testid="main-map"
    :data-basemap="store.basemap === 'esri' ? 'esri-current' : 'osm-current'"
    aria-label="最新底图与区域范围"
  ></div>
  <div v-if="mapError" class="map-message">{{ mapError }}</div>
  <div v-if="store.pickMode" class="pick-message">
    点击地图选取中心坐标 <button @click="store.pickMode = false">取消</button>
  </div>
</template>
