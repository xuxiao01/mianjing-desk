<script setup lang="ts">
import { X } from 'lucide-vue-next';
import CompanyLabel from '@/shared/components/CompanyLabel.vue';
import type { FilterChip, FilterChipKey } from './filterModel';
defineProps<{ chips: FilterChip[] }>();
const emit = defineEmits<{ edit: [key: FilterChipKey]; remove: [key: FilterChipKey]; clear: [] }>();
</script>
<template>
  <div v-if="chips.length" class="filter-condition-row" aria-label="已选筛选条件">
    <div class="filter-condition-chips">
      <div v-for="chip in chips" :key="chip.key" class="filter-condition-chip">
        <button
          type="button"
          class="filter-chip-edit"
          :aria-label="'编辑' + chip.label + '筛选：' + chip.value"
          :title="chip.label + '：' + chip.value"
          @click="emit('edit', chip.key)"
        >
          <span>{{ chip.label }}：</span
          ><CompanyLabel v-if="chip.key === 'company'" :name="chip.value" />
          <span v-else class="filter-chip-value">{{ chip.value }}</span>
        </button>
        <button
          type="button"
          class="filter-chip-remove"
          :aria-label="'移除' + chip.label + '筛选'"
          @click="emit('remove', chip.key)"
        >
          <X :size="13" aria-hidden="true" />
        </button>
      </div>
    </div>
    <button type="button" class="filter-clear" @click="emit('clear')">清除筛选</button>
  </div>
</template>
<style scoped>
.filter-condition-row {
  display: flex;
  align-items: flex-start;
  gap: 8px 16px;
  min-height: 32px;
}
.filter-condition-chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.filter-condition-chip {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  min-height: 32px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text);
}
.filter-chip-edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 280px;
  min-height: 32px;
  padding: 3px 0 3px 8px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
}
.filter-chip-edit > span:first-child {
  flex-shrink: 0;
  color: var(--muted);
}
.filter-chip-edit :deep(.company-label) {
  font-size: 12px;
  line-height: 18px;
}
.filter-chip-value {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.filter-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 30px;
  min-height: 32px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
}
.filter-chip-remove:hover {
  color: var(--text);
  background: var(--line);
}
.filter-clear {
  min-height: 32px;
  flex-shrink: 0;
  padding: 0 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 12px;
}
.filter-clear:hover {
  color: var(--text);
}
button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .filter-condition-row {
    flex-wrap: wrap;
  }
  .filter-chip-edit {
    max-width: 240px;
  }
}
</style>
