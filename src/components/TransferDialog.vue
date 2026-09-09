<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue';
import { useWorkspace } from '../stores/workspace.js';
import { downloadBlob } from '../services/transfer.js';
import ModalShell from './ModalShell.vue';
const emit = defineEmits(['close']);
const store = useWorkspace(),
  api = inject('terrachron');
const selected = ref(store.activeId ? [store.activeId] : []);
const endpoint = ref(import.meta.env.VITE_TRANSFER_URL || '');
const busy = ref(false),
  message = ref(''),
  error = ref('');
const count = computed(() =>
  store.regions
    .filter((r) => selected.value.includes(r.id))
    .reduce((n, r) => n + 1 + r.checkedIds.length, 0),
);
let controller;
async function run(send = false) {
  if (!selected.value.length) {
    error.value = '请选择至少一个区域';
    return;
  }
  if (send && !endpoint.value.trim()) {
    error.value = '请填写接收服务地址';
    return;
  }
  busy.value = true;
  error.value = '';
  message.value = '正在准备影像文件…';
  controller = new AbortController();
  const options = {
    signal: controller.signal,
    onProgress: (progress) => {
      message.value = `正在准备 ${progress.regionName} · 已完成 ${progress.done} 张`;
    },
  };
  try {
    if (send) {
      const result = await api.sendSelection(
        { endpoint: endpoint.value.trim(), regionIds: [...selected.value] },
        options,
      );
      message.value = `已传递至接收服务 · HTTP ${result.status}`;
    } else {
      const result = await api.exportSelection({ regionIds: [...selected.value] }, options);
      controller.signal.throwIfAborted();
      downloadBlob(result.zip, `terrachron_${new Date().toISOString().slice(0, 10)}.zip`);
      message.value = `数据包已生成 · ${result.manifest.images.length} 张影像及元数据`;
    }
  } catch (e) {
    error.value = e.name === 'AbortError' ? '操作已取消' : e.message;
    message.value = '';
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <ModalShell label="数据输出" @close="emit('close')">
    <header class="modal-heading">
      <div>
        <span class="eyebrow">EXPORT & CONNECT</span>
        <h2>数据输出</h2>
      </div>
      <button class="icon-button" aria-label="关闭数据输出" @click="emit('close')">×</button>
    </header>
    <div class="transfer-content">
      <p class="subtle">将观测区域的实际影像与地理信息打包，交给后续分析流程。</p>
      <div class="export-regions">
        <label v-for="region in store.regions" :key="region.id"
          ><input type="checkbox" v-model="selected" :value="region.id" :disabled="busy" /><i
            class="color-dot"
            :style="{ background: region.color }"
          ></i
          ><strong>{{ region.name }}</strong
          ><span>最新影像 + {{ region.checkedIds.length }} 张已选历史影像</span></label
        >
        <p v-if="!store.regions.length" class="subtle">请先截取一个区域。</p>
      </div>
      <div class="export-summary">
        <strong>{{ count }} <small>张影像</small></strong
        ><span>PNG 文件 + JSON 元数据<br />坐标、边界、日期、来源、区域颜色</span>
      </div>
      <button class="primary full" :disabled="busy || !count" @click="run(false)">
        下载影像数据包 <span aria-hidden="true">↓</span>
      </button>
      <div class="receiver-section">
        <h3>传递到外部服务</h3>
        <label
          >接收地址<input
            v-model="endpoint"
            type="url"
            :disabled="busy"
            placeholder="https://your-service.example/imagery"
            aria-label="接收地址"
        /></label>
        <p class="micro">POST 传递实际图片与清单。接收服务需支持跨域访问。</p>
        <button class="secondary full" :disabled="busy || !count" @click="run(true)">
          发送到接收服务 <span aria-hidden="true">↗</span>
        </button>
      </div>
      <p v-if="message" class="success" role="status">{{ message }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button v-if="busy" class="text-button" @click="controller?.abort()">取消当前操作</button>
      <p class="micro">历史图卡勾选后加入输出。清单保留来源署名和拍摄日期的不确定性。</p>
    </div>
  </ModalShell>
</template>
