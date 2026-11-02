<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NInput, NButton } from 'naive-ui';
import { Check, Settings2, X } from 'lucide-vue-next';
import type { CompanyCatalog } from '@/shared/types/domain';
import { companyName } from '@/shared/utils/companyCatalog';
import { companyColorStyle } from '@/shared/utils/companyColors';

const props = defineProps<{
  catalog: CompanyCatalog;
  modelValue: string[];
  multiple?: boolean;
  compact?: boolean;
  disabled?: boolean;
  label?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]]; manage: [] }>();
const search = ref('');
const allCandidates = computed(() => {
  const items = props.catalog.items.filter(
    (item) =>
      item.enabled || ((props.compact || !props.multiple) && props.modelValue.includes(item.id)),
  );
  if (!props.compact) return items;
  const configuredIds = new Set(props.catalog.items.map((item) => item.id));
  return [
    ...items,
    ...[...new Set(props.modelValue)]
      .filter((id) => !configuredIds.has(id))
      .map((id) => ({
        id,
        name: companyName(props.catalog, id),
        aliases: [],
        enabled: false,
      })),
  ];
});
const showSearch = computed(() => !props.compact || allCandidates.value.length > 12);
watch(showSearch, (show) => {
  if (!show) search.value = '';
});
const candidates = computed(() => {
  const query = showSearch.value ? search.value.trim().toLocaleLowerCase() : '';
  return allCandidates.value.filter((item) =>
    [item.name, ...item.aliases].some((name) => name.toLocaleLowerCase().includes(query)),
  );
});
function toggle(id: string) {
  if (props.disabled) return;
  const selected = props.modelValue.includes(id);
  const company = props.catalog.items.find((item) => item.id === id);
  if (!selected && !company?.enabled) return;
  emit(
    'update:modelValue',
    selected
      ? props.modelValue.filter((key) => key !== id)
      : props.multiple
        ? [...props.modelValue, id]
        : [id],
  );
}
</script>

<template>
  <div class="company-picker" :class="{ 'company-picker-compact': compact }">
    <div v-if="multiple && !compact" class="company-picker-selected">
      <span class="company-picker-caption">已选公司</span>
      <div class="company-tag-drafts" aria-label="当前公司标签">
        <span
          v-for="id in modelValue"
          :key="id"
          class="company-tag-draft"
          :style="companyColorStyle(companyName(catalog, id), catalog)"
        >
          <span>{{ companyName(catalog, id) }}</span>
          <button
            type="button"
            :aria-label="'删除公司标签' + companyName(catalog, id)"
            :disabled="disabled"
            @click="toggle(id)"
          >
            <X :size="14" />
          </button>
        </span>
        <span v-if="!modelValue.length" class="picker-hint">暂无公司标签，可在下方选择</span>
      </div>
    </div>
    <div v-if="!compact" class="company-picker-top">
      <span>选择公司</span
      ><NButton text :disabled="disabled" @click="emit('manage')"
        ><template #icon><Settings2 :size="15" /></template>管理公司标签</NButton
      >
    </div>
    <NInput
      v-if="showSearch"
      v-model:value="search"
      :disabled="disabled"
      clearable
      placeholder="搜索公司标签"
      :input-props="{ 'aria-label': '搜索公司标签' }"
    />
    <div class="company-picker-options" role="group" :aria-label="label || '来源公司'">
      <button
        v-for="item in candidates"
        :key="item.id"
        type="button"
        class="bubble-choice"
        :style="companyColorStyle(item.name, catalog)"
        :aria-pressed="modelValue.includes(item.id)"
        :disabled="disabled"
        @click="toggle(item.id)"
      >
        <Check
          v-if="modelValue.includes(item.id)"
          class="picker-check"
          :size="14"
          aria-hidden="true"
        />
        {{ item.name
        }}<span v-if="!item.enabled && !compact" class="picker-inactive">（已停用）</span>
      </button>
      <p v-if="!candidates.length" class="picker-hint">
        {{
          compact
            ? allCandidates.length
              ? '没有匹配标签'
              : '暂无标签'
            : '没有可选公司，请在「管理公司标签」中添加或启用。'
        }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.company-picker {
  width: 100%;
  min-width: 0;
  display: grid;
  gap: 12px;
}
.company-picker-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 14px;
}
.company-picker-options {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 12px 10px;
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
}
.company-picker-compact .company-picker-options {
  gap: 10px;
  padding: 5px;
  margin: -5px;
}
.bubble-choice {
  position: relative;
  min-height: 36px;
  max-width: 100%;
  padding: 7px 22px;
  border: 1px solid var(--company-border);
  border-radius: 999px;
  color: var(--company-color);
  background: var(--company-background);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
  cursor: pointer;
  transition: background-color 120ms;
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
  cursor: wait;
}
.picker-check {
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
}
.picker-inactive {
  font-size: 12px;
  color: inherit;
}
.picker-hint {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}
.company-picker-selected {
  display: grid;
  gap: 8px;
  margin-bottom: 8px;
}
.company-picker-caption {
  font-size: 12px;
  color: var(--muted);
}
.company-tag-drafts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
}
.company-tag-draft {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  border: 1px solid var(--company-border);
  border-radius: 999px;
  color: var(--company-color);
  background: var(--company-background);
}
.company-tag-draft > span {
  padding: 5px 10px;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.company-tag-draft button:hover:not(:disabled) {
  background: rgb(127 127 127 / 18%);
}
.company-tag-draft button:focus-visible {
  outline: 2px solid var(--company-focus-color);
  outline-offset: 2px;
}
.company-tag-draft button:disabled {
  opacity: 1;
  cursor: wait;
}
.company-tag-draft button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: 4px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
</style>
