<script setup>
import { computed, inject, ref } from 'vue';
import { useWorkspace } from '../stores/workspace.js';
import { useDraggable } from '../composables/useDraggable.js';
const store = useWorkspace();
const api = inject('terrachron');
const panel = ref(null),
  handle = ref(null),
  prompt = ref('');
useDraggable(panel, handle);
const region = computed(() => store.activeRegion);
const asset = computed(() => {
  const observation = region.value?.history.closest?.observation;
  return observation ? region.value.assets[observation.id] : null;
});
const defaultPrompt = computed(() =>
  region.value
    ? `请分析历史影像与当前 POI 所描述的现状是否存在地表变化。若可判断，请说明变化前后的地类或功能类型、依据与不确定性。区域：${region.value.name}。仅返回 JSON。`
    : '',
);
const effectivePrompt = computed(() => prompt.value.trim() || defaultPrompt.value);
const result = computed(() => region.value?.analysis.result);
function percent(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : '未提供';
}
async function analyze() {
  if (!region.value) return;
  await api.analyzeChange({ regionId: region.value.id, prompt: effectivePrompt.value });
}
</script>

<template>
  <section ref="panel" class="panel model-panel" data-testid="model-panel">
    <header ref="handle" class="panel-heading">
      <div>
        <span class="eyebrow">03 / MODEL</span>
        <h2>
          变化检测模型 <span class="count">{{ region ? region.name : '—' }}</span>
        </h2>
      </div>
      <span class="heading-icon">⌁</span>
    </header>
    <div class="model-panel-body">
      <div v-if="!region" class="empty-state compact">
        <span class="empty-symbol">⌁</span><strong>等待区域选择</strong>
        <p>在区域影像库中选择一个区域<br />模型输入会自动在此处同步</p>
      </div>
      <template v-else>
        <section class="model-inputs">
          <strong>模型输入</strong>
          <div class="model-input-grid">
            <figure>
              <img v-if="asset?.url" :src="asset.url" alt="选中的历史影像" /><span
                v-else
                class="thumb-placeholder"
                >{{ region.history.status === 'loading' ? '查询中' : '等待历史影像' }}</span
              >
              <figcaption>
                历史影像 · {{ region.history.closest?.capturedAt || '尚未选择' }}
              </figcaption>
            </figure>
            <div>
              <span class="input-label">当前 POI 描述</span>
              <p class="model-poi">
                {{ region.poi.description || region.poi.error || '等待区域 POI' }}
              </p>
              <span class="micro"
                >{{ region.center[0].toFixed(4) }}°, {{ region.center[1].toFixed(4) }}° ·
                WGS84</span
              >
            </div>
          </div>
        </section>
        <label class="model-prompt"
          ><span>分析提示词</span
          ><textarea
            v-model="prompt"
            :placeholder="defaultPrompt"
            aria-label="分析提示词"
          ></textarea>
        </label>
        <div class="model-submit">
          <button
            v-if="region.analysis.status !== 'loading'"
            class="primary full"
            :disabled="!asset?.blob"
            @click="analyze"
          >
            发送模型请求 <span>→</span></button
          ><button v-else class="secondary full" @click="api.cancel(region.id, 'analysis')">
            取消请求
          </button>
          <p v-if="!asset?.blob" class="micro">
            先在此区域获取历史图像，即可将图像和 POI 发送给模型。
          </p>
          <p v-if="region.analysis.error" class="error" role="alert">{{ region.analysis.error }}</p>
        </div>
        <section v-if="result" class="model-output">
          <strong>模型输出</strong>
          <div v-if="result.change" class="change-conclusion">
            <span class="tag" :class="result.change.changed ? 'current' : 'historical'">{{
              result.change.changed ? '检测到变化' : '未检测到明确变化'
            }}</span>
            <h3>
              {{ result.change.beforeType || '历史状态未知' }} <span>→</span>
              {{ result.change.afterType || '当前状态未知' }}
            </h3>
            <p>{{ result.change.description }}</p>
            <small>置信度 {{ percent(result.change.confidence) }}</small>
          </div>
          <pre v-else-if="result.markdown" class="model-markdown">{{ result.markdown }}</pre>
          <div v-else class="generic-analysis">
            <p>{{ result.summary || '模型未提供摘要。' }}</p>
            <ul v-if="result.findings?.length">
              <li v-for="finding in result.findings" :key="finding.id || finding.title">
                <strong>{{ finding.title || finding.type || '发现' }}</strong
                ><span>{{ finding.description }}</span>
              </li>
            </ul>
          </div>
          <p class="micro">
            请求 {{ result.requestId || '未提供' }} · {{ result.meta?.model_version || 'Agnes' }}
          </p>
        </section>
      </template>
    </div>
    <footer class="panel-footer">历史影像 + 当前 POI <span>·</span> Agnes 模拟链路</footer>
  </section>
</template>
