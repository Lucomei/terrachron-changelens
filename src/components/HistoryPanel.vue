<script setup>
import { computed, inject, ref, watch } from 'vue';
import { useWorkspace } from '../stores/workspace.js';
import { useDraggable } from '../composables/useDraggable.js';
import { historyProviders } from '../services/providers/esri.js';
import HistoryResultsDialog from './HistoryResultsDialog.vue';
const emit = defineEmits(['compare']);
const store = useWorkspace(),
  api = inject('terrachron');
const region = computed(() => store.activeRegion);
const panel = ref(null),
  handle = ref(null),
  error = ref('');
const resultsOpen = ref(false);
useDraggable(panel, handle);
watch(
  () => store.activeId,
  () => {
    error.value = '';
    resultsOpen.value = false;
  },
);
const minimum = Date.parse('1980-01-01') / 86400000;
const maximum = Math.floor(Date.now() / 86400000);
const asDay = (date) => Math.floor(Date.parse(date) / 86400000);
function slide(key, event) {
  const date = new Date(Number(event.target.value) * 86400000).toISOString().slice(0, 10);
  region.value.range[key] = date;
  if (region.value.range.startDate > region.value.range.endDate)
    region.value.range[key === 'startDate' ? 'endDate' : 'startDate'] = date;
}
async function query() {
  error.value = '';
  try {
    await api.queryHistory({
      regionId: region.value.id,
      ...region.value.range,
      providerId: region.value.providerId,
    });
  } catch (e) {
    error.value = e.message;
  }
}
</script>

<template>
  <section class="panel history-panel" ref="panel">
    <header class="panel-heading" ref="handle">
      <div>
        <span class="eyebrow">03 / TIME EXPLORER</span>
        <h2>探索历史影像</h2>
      </div>
      <span class="heading-icon">◷</span>
    </header>
    <div v-if="!region" class="empty-state history-empty">
      <div class="orbit-icon"><span>◷</span></div>
      <strong>同一地点，不同时间</strong>
      <p>先选取一个观测区域<br />沿时间轴查看地表的变化</p>
      <div class="mini-timeline"><i></i><i></i><i></i><i></i><i></i></div>
      <span class="micro">历史查询独立于最新底图</span>
    </div>
    <template v-else>
      <div class="history-controls">
        <div class="active-region-label">
          <i class="color-dot" :style="{ background: region.color }"></i
          ><strong>{{ region.name }}</strong
          ><span>{{ region.center[0].toFixed(4) }}°, {{ region.center[1].toFixed(4) }}°</span>
        </div>
        <div class="date-fields">
          <label
            >开始日期<input
              type="date"
              aria-label="开始日期"
              v-model="region.range.startDate"
              min="1980-01-01"
              :disabled="region.history.status === 'loading'" /></label
          ><span>—</span
          ><label
            >结束日期<input
              type="date"
              aria-label="结束日期"
              v-model="region.range.endDate"
              :disabled="region.history.status === 'loading'"
          /></label>
        </div>
        <div class="range-control" :style="{ '--region-color': region.color }">
          <label class="sr-only" for="range-start">时间轴开始</label
          ><input
            id="range-start"
            type="range"
            :min="minimum"
            :max="maximum"
            :value="asDay(region.range.startDate)"
            :disabled="region.history.status === 'loading'"
            @input="slide('startDate', $event)"
          /><label class="sr-only" for="range-end">时间轴结束</label
          ><input
            id="range-end"
            type="range"
            :min="minimum"
            :max="maximum"
            :value="asDay(region.range.endDate)"
            :disabled="region.history.status === 'loading'"
            @input="slide('endDate', $event)"
          />
          <div class="range-labels">
            <span>1980</span><span>2000</span><span>{{ new Date().getFullYear() }}</span>
          </div>
        </div>
        <div class="source-row">
          <span>历史来源</span
          ><select
            v-if="historyProviders.length > 1"
            v-model="region.providerId"
            aria-label="历史来源"
          >
            <option v-for="provider in historyProviders" :key="provider.id" :value="provider.id">
              {{ provider.label }}
            </option></select
          ><strong v-else>Esri Wayback <i class="status-dot"></i></strong>
        </div>
        <button v-if="region.history.status !== 'loading'" class="primary full" @click="query">
          获取历史图像 <span aria-hidden="true">→</span>
        </button>
        <button v-else class="secondary full" @click="api.cancel(region.id)">取消历史查询</button>
        <p class="micro">按实际拍摄日期筛选 · 档案覆盖因地点而异</p>
        <p v-if="error || region.history.error" class="error" role="alert">
          {{ error || region.history.error }}
        </p>
        <div v-if="region.history.status === 'loading'" class="query-progress">
          <span class="spinner"></span>{{ region.history.progress?.stage || '正在连接历史档案'
          }}<span v-if="region.history.progress?.total"
            >{{ region.history.progress.done }}/{{ region.history.progress.total }}</span
          >
        </div>
        <p v-if="region.history.status === 'cancelled'" class="micro">查询已取消，原有结果保留。</p>
      </div>
      <div v-if="region.history.queryRange" class="history-results-summary">
        <div class="results-heading">
          <h3>
            历史记录 <span>{{ region.history.observations.length }}</span>
          </h3>
          <span class="tag historical">{{
            region.history.unknown.length
              ? `另有 ${region.history.unknown.length} 条日期未知`
              : '日期已核实'
          }}</span>
        </div>
        <p class="micro results-range">
          查询范围 {{ region.history.queryRange.startDate }} —
          {{ region.history.queryRange.endDate }}
        </p>
        <button
          class="primary full view-history-button"
          :disabled="!region.history.observations.length && !region.history.unknown.length"
          @click="resultsOpen = true"
        >
          查看历史影像 <span aria-hidden="true">↗</span>
        </button>
      </div>
      <div v-else-if="region.history.status !== 'loading'" class="history-wait">
        <span>◷</span>
        <p>选择时间范围，开始获取历史影像</p>
      </div>
    </template>
    <HistoryResultsDialog
      v-if="resultsOpen && region"
      :region="region"
      @close="resultsOpen = false"
      @compare="emit('compare', $event)"
    />
  </section>
</template>
