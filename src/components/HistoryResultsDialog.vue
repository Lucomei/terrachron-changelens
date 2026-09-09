<script setup>
import { computed, ref, watch } from 'vue';
import ModalShell from './ModalShell.vue';
import ObservationCard from './ObservationCard.vue';
const props = defineProps({ region: Object });
const emit = defineEmits(['close', 'compare']);
const page = ref(1),
  showUnknown = ref(false);
const items = computed(() =>
  showUnknown.value ? props.region.history.unknown : props.region.history.observations,
);
const pages = computed(() => Math.max(1, Math.ceil(items.value.length / 5)));
const visibleItems = computed(() => items.value.slice((page.value - 1) * 5, page.value * 5));
watch(items, () => {
  page.value = 1;
});
</script>
<template>
  <ModalShell label="历史影像列表" wide resizable @close="emit('close')">
    <div class="history-dialog" data-testid="history-dialog">
      <header class="modal-heading">
        <div>
          <span class="eyebrow">HISTORICAL ARCHIVE</span>
          <h2>
            <i class="color-dot" :style="{ background: region.color }"></i>{{ region.name }} ·
            历史影像
          </h2>
          <p class="modal-subtitle">
            {{ region.center[0].toFixed(6) }}°, {{ region.center[1].toFixed(6) }}° · 256 m × 256 m ·
            {{ region.history.queryRange.startDate }} — {{ region.history.queryRange.endDate }}
          </p>
        </div>
        <button class="icon-button" aria-label="关闭历史影像" @click="emit('close')">×</button>
      </header>
      <div class="history-dialog-toolbar">
        <div>
          <strong>{{ showUnknown ? '日期未知记录' : '拍摄日期匹配记录' }}</strong
          ><span>{{ items.length }} 条 · 每页最多 5 条</span>
        </div>
        <button
          v-if="region.history.unknown.length"
          class="text-button"
          @click="showUnknown = !showUnknown"
        >
          {{ showUnknown ? '返回日期匹配' : `查看日期未知 (${region.history.unknown.length})` }}
        </button>
      </div>
      <div v-if="region.history.warnings.length" class="warnings">
        <p v-for="warning in region.history.warnings" :key="warning">{{ warning }}</p>
      </div>
      <div v-if="!items.length" class="empty-state compact">
        <strong>此范围暂无记录</strong>
        <p>可以返回查询窗口扩大时间范围。</p>
      </div>
      <div v-else class="history-dialog-list">
        <ObservationCard
          v-for="observation in visibleItems"
          :key="observation.id"
          :region="region"
          :observation="observation"
          @compare="
            emit('compare', { regionId: region.id, observationId: observation.id });
            emit('close');
          "
        />
      </div>
      <nav v-if="pages > 1" class="pagination dialog-pagination" aria-label="历史影像分页">
        <button :disabled="page === 1" @click="page--">← 上一页</button
        ><span>第 {{ page }} / {{ pages }} 页</span
        ><button :disabled="page === pages" @click="page++">下一页 →</button>
      </nav>
    </div>
  </ModalShell>
</template>
