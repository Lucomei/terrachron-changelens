<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
defineProps({ label: String, wide: Boolean, resizable: Boolean });
const emit = defineEmits(['close']);
const dialog = ref(null);
let previous;
onMounted(() => {
  previous = document.activeElement;
  dialog.value.showModal();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  previous?.focus?.();
});
</script>
<template>
  <Teleport to="body"
    ><dialog
      ref="dialog"
      class="modal-shell"
      :class="{ wide, resizable }"
      :aria-label="label"
      @cancel.prevent="emit('close')"
      @click="
        (event) => {
          if (event.target === dialog) emit('close');
        }
      "
    >
      <div class="modal-inner"><slot /></div></dialog
  ></Teleport>
</template>
