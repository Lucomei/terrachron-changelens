<script setup>
import { computed } from 'vue';
import ModalShell from './ModalShell.vue';
const props = defineProps({ region: Object });
const emit = defineEmits(['close']);
const result = computed(() => props.region.analysis.result);
const historyAsset = computed(() => {
  const id = props.region.history.closest?.observation?.id;
  return id ? props.region.assets[id] : null;
});
const percent = (value) => (Number.isFinite(value) ? `${Math.round(value * 100)}%` : '未提供');
</script>

<template>
  <ModalShell label="模型变化检测结果" wide resizable @close="emit('close')">
    <header class="modal-heading"><div><span class="eyebrow">MODEL CHANGE DETECTION</span><h2><i class="color-dot" :style="{ background: region.color }"></i>{{ region.name }} · 模型变化检测</h2></div><button class="icon-button" aria-label="关闭模型结果" @click="emit('close')">×</button></header>
    <div class="model-result-content">
      <figure v-if="historyAsset?.url" class="model-input-preview"><img :src="historyAsset.url" alt="提交给模型的历史影像" /><figcaption>历史影像 · {{ region.history.closest?.capturedAt || '拍摄日期未知' }}</figcaption></figure>
      <section class="model-context"><strong>当前 POI 上下文</strong><p>{{ region.poi.description || '未获取到 POI 描述' }}</p></section>
      <section v-if="result.change" class="change-conclusion" :class="{ changed: result.change.changed }"><span class="tag" :class="result.change.changed ? 'historical' : 'current'">{{ result.change.changed ? '检测到变化' : '未检测到明确变化' }}</span><h3 v-if="result.change.beforeType || result.change.afterType">{{ result.change.beforeType || '未说明' }} <span>→</span> {{ result.change.afterType || '未说明' }}</h3><p>{{ result.change.description || '模型未提供文字说明。' }}</p><small>模型置信度 {{ percent(result.change.confidence) }}</small></section>
      <section v-else-if="result.markdown" class="model-markdown"><pre>{{ result.markdown }}</pre></section>
      <section v-else class="generic-analysis"><h3>模型分析</h3><p>{{ result.summary || '模型未提供摘要。' }}</p><ul v-if="result.findings.length"><li v-for="finding in result.findings" :key="finding.id || finding.title"><strong>{{ finding.title || finding.type }}</strong><span>{{ finding.description }}</span><small v-if="Number.isFinite(finding.confidence)">{{ percent(finding.confidence) }}</small></li></ul><p v-else class="micro">结果未包含明确的变化结论；此处仅展示模型的通用分析，前端不会将其解释为变化检测结果。</p></section>
      <footer class="model-result-footer"><span>请求 {{ result.requestId || '未提供' }}</span><span v-if="result.meta?.model_version">模型 {{ result.meta.model_version }}</span><span v-if="result.meta?.inference_time_ms">{{ result.meta.inference_time_ms }} ms</span></footer>
    </div>
  </ModalShell>
</template>
