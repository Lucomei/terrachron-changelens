<script setup>
import { inject, onMounted, onBeforeUnmount, ref } from 'vue';
const props = defineProps({ region: Object, observation: Object });
const emit = defineEmits(['compare']);
const api = inject('terrachron');
const root = ref(null),
  asset = ref(null),
  error = ref(''),
  loading = ref(false);
let observer, controller;
async function load() {
  if (loading.value || asset.value) return;
  loading.value = true;
  error.value = '';
  controller = new AbortController();
  try {
    asset.value = await api.getImageAsset({
      regionId: props.region.id,
      observationId: props.observation.id,
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect();
      load();
    }
  });
  observer.observe(root.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  controller?.abort();
});
</script>

<template>
  <article
    ref="root"
    class="observation-card"
    data-testid="observation-card"
    :class="{ selected: region.selectedObservationId === observation.id }"
    :style="{ '--region-color': region.color }"
  >
    <button
      class="history-image"
      @click="
        region.selectedObservationId = observation.id;
        emit('compare', observation);
      "
    >
      <img v-if="asset" :src="asset.url" alt="历史卫星影像" />
      <span v-else class="thumb-placeholder" :class="{ loading }">{{
        loading ? '加载历史影像…' : error ? '预览加载失败' : '历史影像'
      }}</span>
      <span class="image-corner">{{ region.sizeMeters }} m</span>
    </button>
    <div class="observation-info">
      <label class="observation-date"
        ><input
          type="checkbox"
          v-model="region.checkedIds"
          :value="observation.id"
          aria-label="选择此历史影像用于输出"
        /><strong>{{
          observation.capturedAt ||
          (observation.capturedDates.length ? '多日期拼接' : '拍摄日期未知')
        }}</strong></label
      >
      <p v-if="observation.capturedDates.length > 1" class="micro">
        {{ observation.capturedDates.join(' / ') }}
      </p>
      <p class="micro">
        发布 {{ observation.publishedAt }}
        <span v-if="observation.partialDateMatch">· 部分范围匹配</span>
      </p>
      <p class="micro source-line">
        {{
          observation.metadata.sources
            .map((s) => s.provider)
            .filter(Boolean)
            .filter((s, i, a) => a.indexOf(s) === i)
            .join(' / ') || 'Esri Wayback'
        }}
      </p>
      <p v-if="observation.metadata.hasUnknownDates" class="micro warning">部分覆盖日期未知</p>
      <div class="card-bottom">
        <span class="tag historical">历史档案</span
        ><button
          class="text-button"
          @click="
            region.selectedObservationId = observation.id;
            emit('compare', observation);
          "
        >
          比对 <span aria-hidden="true">↗</span>
        </button>
      </div>
    </div>
    <div v-if="error" class="asset-error">{{ error }} <button @click="load">重试</button></div>
  </article>
</template>
