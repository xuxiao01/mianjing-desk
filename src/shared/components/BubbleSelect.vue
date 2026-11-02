<script setup lang="ts" generic="T extends string">
import type { CompanyCatalog } from '@/shared/types/domain';
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';
import { Check } from 'lucide-vue-next';
import { companyColorStyle } from '@/shared/utils/companyColors';

const props = defineProps<{
  modelValue: T | null;
  options: readonly { label: string; value: T; company?: string }[];
  label: string;
  company?: string;
  catalog?: CompanyCatalog;
  disabled?: boolean;
}>();
const inheritedCatalog = useCompanyCatalog();
const emit = defineEmits<{ 'update:modelValue': [value: T | null] }>();
function select(value: T) {
  if (!props.disabled) emit('update:modelValue', props.modelValue === value ? null : value);
}
</script>

<template>
  <div class="bubble-select" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="bubble-choice"
      :style="companyColorStyle(option.company ?? company, catalog || inheritedCatalog)"
      :aria-pressed="modelValue === option.value"
      :disabled="disabled"
      @click="select(option.value)"
    >
      <span class="bubble-check" aria-hidden="true">
        <Check v-if="modelValue === option.value" :size="14" :stroke-width="2.5" />
      </span>
      <span class="bubble-label">{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.bubble-select {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 10px;
  min-width: 0;
}
.bubble-choice {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 7px 22px;
  border: 1px solid var(--company-border);
  border-radius: 999px;
  background: var(--company-background);
  color: var(--company-color);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
  transition:
    background-color 120ms,
    border-color 120ms;
}
.bubble-choice:hover:not(:disabled) {
  background: var(--company-hover-background);
}
.bubble-choice[aria-pressed='true'] {
  background: var(--company-selected-background);
}
.bubble-choice:focus-visible {
  outline: 2px solid var(--company-focus-color);
  outline-offset: 3px;
}
.bubble-choice:disabled {
  opacity: 1;
  border-style: dashed;
  cursor: not-allowed;
}
.bubble-check {
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  width: 14px;
  height: 14px;
}
.bubble-label {
  text-align: center;
}
</style>
