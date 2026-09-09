<script setup>
import { computed, inject, onMounted, onBeforeUnmount, ref } from 'vue';
import ModalShell from './ModalShell.vue';
const props = defineProps({ region: Object, observation: Object });
const emit = defineEmits(['close']);
const api = inject('terrachron');
const mode = ref('split'),
  position = ref(50),
  scale = ref(1),
  asset = ref(null),
  error = ref('');
const controller = new AbortController();
const swipeRoot = ref(null);
function moveDivider(event) {
  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
  const bounds = swipeRoot.value.getBoundingClientRect();
  position.value = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
}
const dates = computed(() => props.observation.capturedDates.join(' / ') || '拍摄日期未知');
async function load() {
  error.value = '';
  try {
    asset.value = await api.getImageAsset({
      regionId: props.region.id,
      observationId: props.observation.id,
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message;
  }
}
onMounted(load);
onBeforeUnmount(() => controller.abort());
</script>

<template>
  <ModalShell label="影像时序比对" wide @close="emit('close')">
    <header class="modal-heading">
      <div>
        <span class="eyebrow">TEMPORAL COMPARISON</span>
        <h2>
          <i class="color-dot" :style="{ background: region.color }"></i>{{ region.name }} ·
          影像时序比对
        </h2>
      </div>
      <button class="icon-button" aria-label="关闭比对" @click="emit('close')">×</button>
    </header>
    <div class="compare-toolbar">
      <div class="segmented">
        <button :class="{ selected: mode === 'split' }" @click="mode = 'split'">分栏比对</button
        ><button :class="{ selected: mode === 'swipe' }" @click="mode = 'swipe'">卷帘比对</button>
      </div>
      <label class="zoom-control"
        >缩放
        <input type="range" min="1" max="4" step="0.1" v-model="scale" aria-label="比对缩放" /><span
          >{{ Number(scale).toFixed(1) }}×</span
        ></label
      >
    </div>
    <div v-if="error" class="error">{{ error }} <button @click="load">重试</button></div>
    <div v-else-if="!asset" class="compare-loading">
      <span class="spinner"></span>正在加载历史影像…
    </div>
    <div v-else-if="mode === 'split'" class="compare-split">
      <figure>
        <figcaption>
          <span class="tag current">最新影像</span><span>提供方当前底图</span>
        </figcaption>
        <div class="compare-image">
          <img
            v-if="region.latest.url"
            :src="region.latest.url"
            alt="当前最新影像"
            :style="{ transform: `scale(${scale})` }"
          /><span v-else>最新截取不可用，请返回区域库重试</span>
        </div>
      </figure>
      <figure>
        <figcaption>
          <span class="tag historical">历史影像</span><span>{{ dates }}</span>
        </figcaption>
        <div class="compare-image">
          <img :src="asset.url" alt="历史影像" :style="{ transform: `scale(${scale})` }" />
        </div>
      </figure>
    </div>
    <div v-else class="swipe-wrapper">
      <div ref="swipeRoot" class="swipe-comparison">
        <div class="swipe-picture">
          <img
            v-if="region.latest.url"
            :src="region.latest.url"
            alt="最新影像底层"
            :style="{ transform: `scale(${scale})` }"
          /><span v-else>最新截取不可用</span>
        </div>
        <div class="swipe-picture" :style="{ clipPath: `inset(0 ${100 - position}% 0 0)` }">
          <img :src="asset.url" alt="历史影像覆盖层" :style="{ transform: `scale(${scale})` }" />
        </div>
        <button
          class="swipe-line"
          :style="{ left: position + '%' }"
          aria-label="拖动卷帘分界线"
          @pointerdown="(event) => event.currentTarget.setPointerCapture(event.pointerId)"
          @pointermove="moveDivider"
          @pointerup="(event) => event.currentTarget.releasePointerCapture(event.pointerId)"
          @keydown.left.prevent="position = Math.max(0, Number(position) - 2)"
          @keydown.right.prevent="position = Math.min(100, Number(position) + 2)"
        >
          <span>↔</span></button
        ><span class="swipe-label left">历史 · {{ dates }}</span
        ><span class="swipe-label right">最新</span>
      </div>
      <label class="swipe-range-label"
        >拖动分界线<input type="range" min="0" max="100" v-model="position" aria-label="卷帘位置"
      /></label>
    </div>
    <footer class="compare-footer">
      <span
        >{{ region.center[0].toFixed(6) }}°, {{ region.center[1].toFixed(6) }}° · 同一 256 m × 256 m
        区域</span
      ><span>档案发布 {{ observation.publishedAt }}</span>
      <p>日期为区域相交影像的拍摄元数据，拼接区域可能覆盖多个日期。{{ observation.attribution }}</p>
    </footer>
  </ModalShell>
</template>
