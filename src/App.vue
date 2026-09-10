<script setup>
import { computed, ref, defineAsyncComponent } from 'vue';
import { useWorkspace } from './stores/workspace.js';
const MapCanvas = defineAsyncComponent(() => import('./components/MapCanvas.vue'));
import CapturePanel from './components/CapturePanel.vue';
import RegionPanel from './components/RegionPanel.vue';
import ModelPanel from './components/ModelPanel.vue';
const CompareDialog = defineAsyncComponent(() => import('./components/CompareDialog.vue'));
const TransferDialog = defineAsyncComponent(() => import('./components/TransferDialog.vue'));
const iconUrl = `${import.meta.env.BASE_URL}favicon.svg`;
const store = useWorkspace();
const transferOpen = ref(false),
  comparison = ref(null);
const compareRegion = computed(() =>
  store.regions.find((r) => r.id === comparison.value?.regionId),
);
const observation = computed(
  () =>
    compareRegion.value &&
    [...compareRegion.value.history.observations, ...compareRegion.value.history.unknown].find(
      (o) => o.id === comparison.value?.observationId,
    ),
);
</script>

<template>
  <div class="app-shell">
    <MapCanvas />
    <header class="app-header">
      <div class="brand">
        <img :src="iconUrl" alt="" />
        <div>
          <h1>TerraChron</h1>
          <span>地表时序 · SATELLITE TIME EXPLORER</span>
        </div>
      </div>
      <div class="header-status">
        <i class="status-dot"></i>最新底图 <span class="divider">/</span> 独立历史档案
      </div>
      <button class="export-button" @click="transferOpen = true">
        <span aria-hidden="true">↗</span> 数据输出
      </button>
    </header>
    <div class="basemap-bar">
      <span class="micro">底图</span
      ><button :class="{ selected: store.basemap === 'esri' }" @click="store.basemap = 'esri'">
        卫星影像 <span class="tiny-dot"></span></button
      ><button :class="{ selected: store.basemap === 'osm' }" @click="store.basemap = 'osm'">
        街道定位</button
      ><span class="basemap-note">提供方当前版本</span>
    </div>
    <main class="workspace-panels">
      <div class="left-panels"><CapturePanel /></div>
      <div class="right-panels">
        <div class="panel-slot"><RegionPanel @compare="comparison = $event" /></div>
        <div class="panel-slot"><ModelPanel /></div>
      </div>
    </main>
    <div class="map-caption">
      <span class="crosshair-mark">＋</span>
      <div>在空间中选取<span>在时间中探索</span></div>
    </div>
    <footer class="app-footer">
      <span
        ><i class="status-dot"></i> WGS84 <span class="footer-divider">/</span> 256 m × 256 m</span
      ><span>当前底图为最新发布版本，非实时拍摄</span>
    </footer>
    <CompareDialog
      v-if="compareRegion && observation"
      :key="observation.id"
      :region="compareRegion"
      :observation="observation"
      @close="comparison = null"
    />
    <TransferDialog v-if="transferOpen" @close="transferOpen = false" />
  </div>
</template>
