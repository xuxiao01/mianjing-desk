<script setup lang="ts">
import { categoryOptions } from './filterModel';
defineProps<{ value: string }>();
const emit = defineEmits<{ change: [value: string] }>();
</script>
<template>
  <div class="filter-category-scroll">
    <div class="filter-category-tabs" role="group" aria-label="题目分类">
      <button
        v-for="option in categoryOptions"
        :key="option.value"
        type="button"
        :aria-pressed="value === option.value"
        @click="emit('change', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
<style scoped>
.filter-category-scroll {
  min-width: 0;
  overflow-x: auto;
  padding: 3px;
  margin: -3px;
}
.filter-category-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(88px, 1fr));
  gap: 4px;
  min-width: 462px;
  padding: 3px;
  border-radius: 8px;
  background: var(--surface-2);
}
.filter-category-tabs button {
  box-sizing: border-box;
  height: 40px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}
.filter-category-tabs button:hover {
  color: var(--text);
}
.filter-category-tabs button[aria-pressed='true'] {
  background: var(--surface);
  color: var(--heading);
  border-color: var(--line-strong);
}
.filter-category-tabs button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}
</style>
