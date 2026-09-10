import { onMounted, onBeforeUnmount } from 'vue';

export function useDraggable(panel, handle) {
  let release = () => {};
  const down = (event) => {
    if (
      event.button !== 0 ||
      window.innerWidth < 900 ||
      event.target.closest('button, input, select, a')
    )
      return;
    const element = panel.value;
    const bounds = element.getBoundingClientRect();
    const start = [event.clientX, event.clientY];
    const move = (e) => {
      const left = Math.max(
        8,
        Math.min(window.innerWidth - bounds.width - 8, bounds.left + e.clientX - start[0]),
      );
      const top = Math.max(
        78,
        Math.min(window.innerHeight - 90, bounds.top + e.clientY - start[1]),
      );
      const slot = element.parentElement?.classList.contains('panel-slot')
        ? element.parentElement
        : null;
      if (slot) slot.style.minHeight = `${bounds.height}px`;
      Object.assign(element.style, {
        position: 'fixed',
        width: `${bounds.width}px`,
        left: `${left}px`,
        top: `${top}px`,
        right: 'auto',
        bottom: 'auto',
      });
    };
    release();
    release = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    event.preventDefault();
  };
  onMounted(() => handle.value?.addEventListener('pointerdown', down));
  onBeforeUnmount(() => {
    release();
    handle.value?.removeEventListener('pointerdown', down);
  });
}
