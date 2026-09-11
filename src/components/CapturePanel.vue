<script setup>
import { computed, inject, ref, watch } from 'vue';
import { useWorkspace } from '../stores/workspace.js';
import { createFootprint } from '../domain/geometry.js';
import { useDraggable } from '../composables/useDraggable.js';
const store = useWorkspace();
const api = inject('terrachron');
const longitude = ref(String(store.draftCenter[0]));
const latitude = ref(String(store.draftCenter[1]));
const sizeMeters = ref(String(store.draftSpec.sizeMeters));
const outputSize = ref(String(store.draftSpec.outputSize));
const error = ref(''),
  busy = ref(false),
  panel = ref(null),
  handle = ref(null);
useDraggable(panel, handle);
const pixelArea = computed(() => {
  const side = Number(sizeMeters.value) / Number(outputSize.value);
  return Number.isFinite(side) ? side * side : NaN;
});
const areaLabel = computed(() =>
  Number.isFinite(pixelArea.value)
    ? `${pixelArea.value.toLocaleString('zh-CN', { maximumFractionDigits: 4 })} m²`
    : '—',
);
watch(
  () => store.draftCenter,
  (center) => {
    longitude.value = String(center[0]);
    latitude.value = String(center[1]);
  },
);
function specification() {
  const spec = { sizeMeters: Number(sizeMeters.value), outputSize: Number(outputSize.value) };
  createFootprint(store.draftCenter, spec);
  store.draftSpec = spec;
  return spec;
}
function locate() {
  if (!longitude.value.trim() || !latitude.value.trim()) throw new Error('请填写经度和纬度');
  const center = [Number(longitude.value), Number(latitude.value)];
  const spec = specification();
  createFootprint(center, spec);
  store.draftCenter = center;
  store.focusRequest++;
  return { center, spec };
}
function preview() {
  error.value = '';
  try {
    locate();
  } catch (e) {
    error.value = e.message;
  }
}
async function capture() {
  error.value = '';
  try {
    const { center, spec } = locate();
    busy.value = true;
    await api.createRegion({ center, ...spec });
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="panel capture-panel" ref="panel">
    <header class="panel-heading" ref="handle">
      <div>
        <span class="eyebrow">01 / CAPTURE</span>
        <h2>选取观测区域</h2>
      </div>
      <span class="heading-icon">⌖</span>
    </header>
    <div class="panel-content">
      <p class="subtle">输入中心坐标，或直接在地图上选点。</p>
      <div class="coordinate-grid">
        <label
          >经度 <span>LONGITUDE</span
          ><input
            v-model="longitude"
            aria-label="经度"
            inputmode="decimal"
            @keydown.enter="preview"
        /></label>
        <label
          >纬度 <span>LATITUDE</span
          ><input v-model="latitude" aria-label="纬度" inputmode="decimal" @keydown.enter="preview"
        /></label>
      </div>
      <div class="button-row">
        <button class="secondary" @click="preview">定位到坐标</button
        ><button
          class="secondary"
          :class="{ chosen: store.pickMode }"
          @click="store.pickMode = !store.pickMode"
        >
          {{ store.pickMode ? '取消地图选点' : '⌖ 地图选点' }}
        </button>
      </div>
      <div class="capture-settings">
        <label
          >地面范围 <span>METERS</span
          ><input
            v-model="sizeMeters"
            aria-label="地面范围（米）"
            type="number"
            min="32"
            max="2048"
            step="1"
            @change="preview"
          /><small>正方形边长 · 32–2048 m</small></label
        >
        <label
          >输出像素 <span>PIXELS</span
          ><input
            v-model="outputSize"
            aria-label="输出像素"
            type="number"
            min="64"
            max="2048"
            step="1"
            @change="preview"
          /><small>正方形边长 · 64–2048 px</small></label
        >
      </div>
      <div class="capture-spec">
        <span class="sample-square"></span>
        <div>
          <strong>{{ sizeMeters }} × {{ sizeMeters }} <small>m</small></strong
          ><span>地面范围 · {{ outputSize }} × {{ outputSize }} px</span
          ><span>每像素 {{ areaLabel }}</span>
        </div>
        <span class="tag current">最新</span>
      </div>
      <button class="primary full" :disabled="busy" @click="capture">
        {{ busy ? '正在截取最新影像…' : '截取并加入区域库' }} <span v-if="!busy">＋</span>
      </button>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p class="micro">采样源：Esri 当前卫星影像 · WGS84</p>
    </div>
  </section>
</template>
