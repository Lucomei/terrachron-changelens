<script setup>
import { inject, ref } from 'vue';
import { useWorkspace } from '../stores/workspace.js';
import { useDraggable } from '../composables/useDraggable.js';
const store = useWorkspace();
const api = inject('terrachron');
const panel = ref(null),
  handle = ref(null);
useDraggable(panel, handle);
</script>

<template>
  <section class="panel region-panel" ref="panel">
    <header class="panel-heading" ref="handle">
      <div>
        <span class="eyebrow">02 / REGIONS</span>
        <h2>
          区域影像库
          <span class="count">{{ store.regions.length.toString().padStart(2, '0') }}</span>
        </h2>
      </div>
      <span class="heading-icon">▧</span>
    </header>
    <div v-if="!store.regions.length" class="empty-state compact">
      <span class="empty-symbol">▧</span><strong>从一个地点开始</strong>
      <p>截取的最新影像会保存在这里<br />每个区域拥有独立的颜色与时间轴</p>
    </div>
    <div v-else class="region-list">
      <article
        v-for="region in store.regions"
        :key="region.id"
        class="region-item"
        :class="{ active: region.id === store.activeId }"
        :style="{ '--region-color': region.color }"
      >
        <button
          class="region-select"
          @click="store.activeId = region.id"
          :aria-label="`选择${region.name}`"
        >
          <img
            v-if="region.latest.url"
            :src="region.latest.url"
            alt="最新区域截取"
            data-testid="latest-preview"
          />
          <span
            v-else
            class="thumb-placeholder"
            :class="{ loading: region.latest.status === 'loading' }"
            >{{ region.latest.status === 'loading' ? '截取中' : '待截取' }}</span
          >
          <span class="region-info"
            ><strong
              ><i class="color-dot" :style="{ background: region.color }"></i
              >{{ region.name }}</strong
            ><span>{{ region.center[0].toFixed(4) }}°, {{ region.center[1].toFixed(4) }}°</span
            ><small>256 m × 256 m <b>最新影像</b></small></span
          >
        </button>
        <div class="region-actions">
          <button
            :aria-label="`${region.visible ? '隐藏' : '显示'}${region.name}`"
            :title="region.visible ? '隐藏范围' : '显示范围'"
            @click="region.visible = !region.visible"
          >
            {{ region.visible ? '◉' : '○' }}</button
          ><button
            :aria-label="`删除${region.name}`"
            title="删除区域"
            @click="store.removeRegion(region.id)"
          >
            ×
          </button>
        </div>
        <div
          v-if="region.latest.status === 'error' || region.latest.status === 'cancelled'"
          class="region-error"
        >
          <p>{{ region.latest.error || '截取已取消' }}</p>
          <button @click="api.refreshLatest(region.id)">重试截取</button>
        </div>
      </article>
    </div>
    <footer class="panel-footer">独立分色 <span>·</span> 最新影像与历史档案分别保存</footer>
  </section>
</template>
