<script setup>
import { inject, ref } from 'vue';
import { useWorkspace } from '../stores/workspace.js';
import { useDraggable } from '../composables/useDraggable.js';
const emit = defineEmits(['compare']);
const store = useWorkspace();
const api = inject('terrachron');
const panel = ref(null), handle = ref(null);
useDraggable(panel, handle);
const years = Array.from({ length: new Date().getFullYear() - 1979 }, (_, i) => String(new Date().getFullYear() - i));
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
function days(region) { if (!region.timePoint.month) return []; const count = new Date(Number(region.timePoint.year) || 2000, Number(region.timePoint.month), 0).getDate(); return Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, '0')); }
function updateMonth(region, value) { region.timePoint.month = value; if (!value || !days(region).includes(region.timePoint.day)) region.timePoint.day = ''; }
function asset(region) { const id = region.history.closest?.observation?.id; return id ? region.assets[id] : null; }
async function query(region) { await api.fetchClosestHistory({ regionId: region.id, timePoint: region.timePoint, providerId: region.providerId }); }
</script>

<template>
  <section class="panel region-panel" ref="panel" data-testid="region-panel">
    <header class="panel-heading" ref="handle"><div><span class="eyebrow">02 / REGIONS</span><h2>区域影像库 <span class="count">{{ store.regions.length.toString().padStart(2, '0') }}</span></h2></div><span class="heading-icon">▧</span></header>
    <div v-if="!store.regions.length" class="empty-state compact"><span class="empty-symbol">▧</span><strong>从一个地点开始</strong><p>截取后会获取区域 POI 描述<br />在每个区域中按时间点获取历史影像</p></div>
    <div v-else class="region-list">
      <article v-for="region in store.regions" :key="region.id" class="region-item region-card" :class="{ active: region.id === store.activeId }" :style="{ '--region-color': region.color }">
        <button class="region-select" @click="store.activeId = region.id" :aria-label="`选择${region.name}`">
          <span v-if="asset(region)?.url" class="history-thumb" data-testid="history-preview"><img :src="asset(region).url" alt="最接近时间点的历史影像" /><small>{{ region.history.closest.capturedAt }}</small></span>
          <span v-else class="thumb-placeholder" :class="{ loading: region.history.status === 'loading' }">{{ region.history.status === 'loading' ? '查询中' : '历史影像待获取' }}</span>
          <span class="region-info"><strong><i class="color-dot" :style="{ background: region.color }"></i>{{ region.name }}</strong><span>{{ region.center[0].toFixed(4) }}°, {{ region.center[1].toFixed(4) }}°</span><small>256 m × 256 m <b>历史候选</b></small></span>
        </button>
        <div class="region-actions"><button :aria-label="`${region.visible ? '隐藏' : '显示'}${region.name}`" @click="region.visible = !region.visible">{{ region.visible ? '◉' : '○' }}</button><button :aria-label="`删除${region.name}`" @click="store.removeRegion(region.id)">×</button></div>
        <div class="poi-row"><span>区域 POI</span><div class="poi-description"><p data-testid="poi-description">{{ region.poi.status === 'loading' ? '正在获取周边描述…' : region.poi.description || region.poi.error || '等待截取完成后获取' }}</p><span class="poi-tooltip" data-testid="poi-tooltip" role="tooltip">{{ region.poi.description || region.poi.error || '等待截取完成后获取' }}</span></div></div>
        <div class="timepoint-row"><span>目标时间点</span><div class="timepoint-fields"><label><span class="sr-only">目标年份</span><select v-model="region.timePoint.year" aria-label="目标年份" :disabled="region.history.status === 'loading'"><option value="">选择年份</option><option v-for="year in years" :key="year" :value="year">{{ year }} 年</option></select></label><label><span class="sr-only">目标月份</span><select :value="region.timePoint.month" aria-label="目标月份" :disabled="!region.timePoint.year || region.history.status === 'loading'" @change="updateMonth(region, $event.target.value)"><option value="">月（可选）</option><option v-for="month in months" :key="month" :value="month">{{ month }} 月</option></select></label><label><span class="sr-only">目标日期</span><select v-model="region.timePoint.day" aria-label="目标日期" :disabled="!region.timePoint.month || region.history.status === 'loading'"><option value="">日（可选）</option><option v-for="day in days(region)" :key="day" :value="day">{{ day }} 日</option></select></label></div></div>
        <div class="history-card-action"><button v-if="region.history.status !== 'loading'" class="primary" :disabled="!region.timePoint.year" @click="query(region)">获取历史图像 <span>→</span></button><button v-else class="secondary" @click="api.cancel(region.id)">取消查询</button><button v-if="asset(region)" class="secondary compare-button" @click="emit('compare', { regionId: region.id, observationId: region.history.closest.observation.id })">比对影像</button></div>
        <p v-if="region.history.target" class="micro timepoint-note">按{{ region.history.target.precision === 'year' ? '年' : region.history.target.precision === 'month' ? '月' : '日' }}匹配 · 目标 {{ region.history.target.date }} · {{ region.history.closest?.capturedAt || '未找到带拍摄日期的影像' }}</p>
        <p v-if="region.history.status === 'loading'" class="micro query-progress"><span class="spinner"></span>{{ region.history.progress?.stage || '正在查询历史档案' }}</p><p v-if="region.history.error" class="error" role="alert">{{ region.history.error }}</p>
      </article>
    </div>
    <footer class="panel-footer">独立分色 <span>·</span> POI 与历史影像按区域保存</footer>
  </section>
</template>
