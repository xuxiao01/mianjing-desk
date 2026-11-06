<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { NPopover } from 'naive-ui';
import { MoreHorizontal, Trash2 } from 'lucide-vue-next';
defineProps<{ label: string; deleteLabel: string; disabled?: boolean }>();
const emit = defineEmits<{ delete: []; overlay: [open: boolean] }>();
const open = ref(false),
  trigger = ref<HTMLButtonElement>(),
  item = ref<HTMLButtonElement>();
watch(open, async (value) => {
  emit('overlay', value);
  if (value) {
    await nextTick();
    item.value?.focus();
  }
});
function close() {
  open.value = false;
  trigger.value?.focus();
}
function remove() {
  close();
  emit('delete');
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    close();
  } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    item.value?.focus();
  }
}
</script>
<template>
  <NPopover
    :show="open"
    trigger="click"
    placement="bottom-end"
    @update:show="
      (value) => {
        if (!disabled) open = value;
      }
    "
  >
    <template #trigger
      ><button
        ref="trigger"
        type="button"
        class="detail-icon"
        :aria-label="label"
        aria-haspopup="menu"
        :aria-expanded="open"
        :disabled="disabled"
        @keydown.down.prevent="open = !disabled"
      >
        <MoreHorizontal :size="20" /></button
    ></template>
    <div role="menu" :aria-label="label" @keydown="key">
      <button
        ref="item"
        type="button"
        role="menuitem"
        class="detail-delete-item"
        :aria-label="deleteLabel"
        :disabled="disabled"
        @click="remove"
      >
        <Trash2 :size="15" />{{ deleteLabel }}
      </button>
    </div>
  </NPopover>
</template>
<style scoped>
.detail-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
}
.detail-icon:hover {
  background: var(--surface-2);
}
.detail-delete-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--danger);
  font: inherit;
}
.detail-delete-item:hover {
  background: var(--danger-soft);
}
</style>
