<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { NInput, NPopover } from 'naive-ui';
import {
  Search,
  Building2,
  ChartNoAxesColumn,
  SlidersHorizontal,
  ArrowDownWideNarrow,
  ChevronDown,
  Check,
  ArrowDown,
} from 'lucide-vue-next';
import type { QuestionFilters } from '@/shared/types/domain';
import { masteries } from '@/shared/types/domain';
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';
import { companyColorStyle } from '@/shared/utils/companyColors';
import MasteryBadge from '@/shared/components/MasteryBadge.vue';
import CompanyLabel from '@/shared/components/CompanyLabel.vue';
import QuestionCategoryTabs from './QuestionCategoryTabs.vue';
import QuestionFilterChips from './QuestionFilterChips.vue';
import {
  activeFilterChips,
  filterCount,
  sortOptions,
  type FilterTool,
  type FilterCompany,
  type FilterChipKey,
} from './filterModel';

const props = defineProps<{
  filters: QuestionFilters;
  companies: FilterCompany[];
  panel?: boolean;
}>();
const emit = defineEmits<{
  filter: [key: keyof QuestionFilters, value: string | number | null];
  clear: [];
  overlay: [open: boolean];
}>();
const catalog = useCompanyCatalog();
const search = ref<InstanceType<typeof NInput>>();
const companySearch = ref('');
const companyInput = ref<InstanceType<typeof NInput>>();
function setCompanyInput(instance: unknown) {
  companyInput.value = instance as InstanceType<typeof NInput> | undefined;
}
const open = ref<FilterTool | null>(null);
const panels = new Map<FilterTool, HTMLElement>();
const triggers = new Map<FilterTool, HTMLElement>();
let returnFocus: HTMLElement | null = null;
const selectedCompany = computed(
  () =>
    props.companies.find((item) => item.value === props.filters.company)?.label ||
    catalog.value.items.find((item) => item.id === props.filters.company)?.name ||
    '未找到的公司',
);
const chips = computed(() => activeFilterChips(props.filters, selectedCompany.value));
const count = computed(() => filterCount(props.filters));
const companyChoices = computed(() => {
  const query = companySearch.value.trim().toLocaleLowerCase();
  return props.companies.filter((item) =>
    [
      item.label,
      ...(catalog.value.items.find((company) => company.id === item.value)?.aliases || []),
    ].some((name) => name.toLocaleLowerCase().includes(query)),
  );
});
const tools = computed(() => [
  {
    key: 'company' as const,
    label: props.filters.company ? selectedCompany.value : '公司',
    name: '筛选公司',
    icon: Building2,
    active: !!props.filters.company,
  },
  {
    key: 'mastery' as const,
    label: props.filters.mastery || '掌握程度',
    name: '筛选掌握程度',
    icon: ChartNoAxesColumn,
    active: !!props.filters.mastery,
  },
  {
    key: 'organized' as const,
    label: '筛选',
    name: '筛选整理状态',
    icon: SlidersHorizontal,
    active: !!props.filters.organized,
  },
  {
    key: 'sort' as const,
    label: sortOptions.find((item) => item.value === props.filters.sort)?.label || '优先级',
    name: '排序',
    icon: ArrowDownWideNarrow,
    active: props.filters.sort !== 'priority',
  },
]);
function setPanel(key: FilterTool, element: unknown) {
  if (element instanceof HTMLElement) panels.set(key, element);
  else panels.delete(key);
}
function setTrigger(key: FilterTool, element: unknown) {
  if (element instanceof HTMLElement) triggers.set(key, element);
  else triggers.delete(key);
}
async function close(restore = false) {
  const previous = open.value;
  open.value = null;
  emit('overlay', false);
  if (restore) {
    await nextTick();
    (returnFocus?.isConnected ? returnFocus : previous ? triggers.get(previous) : null)?.focus({
      preventScroll: true,
    });
  }
}
async function show(key: FilterTool, trigger?: HTMLElement) {
  if (open.value === key) return;
  returnFocus = trigger || (document.activeElement as HTMLElement | null);
  companySearch.value = '';
  open.value = key;
  emit('overlay', true);
  await nextTick();
  if (key === 'company') companyInput.value?.focus();
  else
    (
      panels.get(key)?.querySelector<HTMLElement>('[aria-pressed="true"]') ||
      panels.get(key)?.querySelector<HTMLElement>('button')
    )?.focus();
}
function triggerEscape(event: KeyboardEvent, key: FilterTool) {
  if (open.value !== key || event.isComposing) return;
  event.preventDefault();
  event.stopPropagation();
  void close(true);
}
function updateOpen(key: FilterTool, value: boolean) {
  if (value) void show(key, triggers.get(key));
  else if (open.value === key) void close();
}
function choose(key: FilterTool, value: string) {
  emit('filter', key, value);
  void close(true);
}
function popupKey(event: KeyboardEvent, key: FilterTool) {
  if (event.isComposing) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    void close(true);
  } else if (
    ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) &&
    !(event.target as HTMLElement).closest('input')
  ) {
    const items = [
      ...(panels.get(key)?.querySelectorAll<HTMLButtonElement>('.filter-choice') || []),
    ];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[index]?.focus();
  }
}
function focusSearch(select = false) {
  search.value?.focus();
  if (select) search.value?.select();
}
function editChip(key: FilterChipKey) {
  if (key === 'search') {
    void close();
    focusSearch(true);
  } else void show(key);
}
function clear() {
  void close();
  emit('clear');
}
onBeforeUnmount(() => {
  if (open.value) emit('overlay', false);
});
defineExpose({ focusSearch, closePopovers: close });
</script>
<template>
  <div class="question-filters" :class="{ 'question-filters--panel': panel }">
    <QuestionCategoryTabs :value="filters.category" @change="emit('filter', 'category', $event)" />
    <div class="filter-tools-row">
      <NInput
        ref="search"
        class="filter-search-input"
        :class="{ 'reading-panel-search': panel }"
        :value="filters.search"
        clearable
        placeholder="搜索题目、问法、知识点…"
        aria-label="搜索题目"
        @update:value="emit('filter', 'search', $event)"
      >
        <template #prefix><Search :size="16" aria-hidden="true" /></template>
        <template v-if="!panel" #suffix><kbd>/</kbd></template>
      </NInput>
      <NPopover
        v-for="tool in tools"
        :key="tool.key"
        :show="open === tool.key"
        trigger="click"
        placement="bottom-start"
        :show-arrow="false"
        @update:show="updateOpen(tool.key, $event)"
      >
        <template #trigger>
          <button
            :ref="(element) => setTrigger(tool.key, element)"
            type="button"
            class="filter-tool"
            :class="{ 'filter-tool-active': tool.active }"
            :aria-label="tool.name"
            :title="tool.label"
            aria-haspopup="dialog"
            :aria-expanded="open === tool.key"
            @keydown.down.prevent="show(tool.key, $event.currentTarget as HTMLElement)"
            @keydown.esc="triggerEscape($event, tool.key)"
          >
            <component :is="tool.icon" :size="16" aria-hidden="true" /><span>{{ tool.label }}</span>
            <span v-if="tool.key === 'organized' && count" class="filter-count">{{ count }}</span>
            <ArrowDown v-if="tool.key === 'sort'" :size="13" aria-hidden="true" /><ChevronDown
              v-else
              :size="13"
              aria-hidden="true"
            />
          </button>
        </template>
        <div
          :ref="(element) => setPanel(tool.key, element)"
          class="question-filter-popover"
          :class="{ 'company-filter-popover': tool.key === 'company' }"
          data-question-filter-popover
          role="dialog"
          aria-modal="false"
          :aria-label="tool.name"
          @keydown="popupKey($event, tool.key)"
        >
          <template v-if="tool.key === 'company'">
            <NInput
              :ref="setCompanyInput"
              v-model:value="companySearch"
              clearable
              placeholder="输入公司名称"
              :input-props="{ 'aria-label': '搜索筛选公司' }"
              ><template #prefix><Search :size="15" /></template
            ></NInput>
            <button
              type="button"
              class="filter-choice filter-all-company"
              :aria-pressed="!filters.company"
              @click="choose('company', '')"
            >
              全部公司<Check v-if="!filters.company" :size="14" />
            </button>
            <div class="filter-company-options" role="group" aria-label="可筛选公司">
              <button
                v-for="company in companyChoices"
                :key="company.value"
                type="button"
                class="filter-choice filter-company-choice"
                :style="companyColorStyle(company.label, catalog)"
                :aria-pressed="filters.company === company.value"
                :title="company.label"
                @click="choose('company', company.value)"
              >
                <Check
                  v-if="filters.company === company.value"
                  class="filter-company-check"
                  :size="14"
                  aria-hidden="true"
                /><CompanyLabel :name="company.label" bare />
              </button>
              <p v-if="!companyChoices.length" class="filter-option-empty">
                {{ companySearch.trim() ? '没有匹配的公司' : '暂无可筛选公司' }}
              </p>
            </div>
          </template>
          <template v-else-if="tool.key === 'mastery'">
            <button
              type="button"
              class="filter-choice filter-menu-choice"
              :aria-pressed="!filters.mastery"
              @click="choose('mastery', '')"
            >
              <span>全部掌握程度</span><Check v-if="!filters.mastery" :size="14" />
            </button>
            <button
              v-for="mastery in masteries"
              :key="mastery"
              type="button"
              class="filter-choice filter-menu-choice"
              :aria-pressed="filters.mastery === mastery"
              @click="choose('mastery', mastery)"
            >
              <MasteryBadge :mastery="mastery" /><Check
                v-if="filters.mastery === mastery"
                :size="14"
              />
            </button>
          </template>
          <template v-else-if="tool.key === 'organized'">
            <div class="filter-popover-heading">整理状态</div>
            <button
              v-for="option in [
                { value: '', label: '全部整理状态' },
                { value: 'true', label: '已整理' },
                { value: 'false', label: '待整理' },
              ]"
              :key="option.value"
              type="button"
              class="filter-choice filter-menu-choice"
              :aria-pressed="filters.organized === option.value"
              @click="choose('organized', option.value)"
            >
              <span>{{ option.label }}</span
              ><Check v-if="filters.organized === option.value" :size="14" />
            </button>
          </template>
          <template v-else>
            <button
              v-for="option in sortOptions"
              :key="option.value"
              type="button"
              class="filter-choice filter-menu-choice"
              :aria-pressed="filters.sort === option.value"
              @click="choose('sort', option.value)"
            >
              <span>{{ option.label }}</span
              ><Check v-if="filters.sort === option.value" :size="14" />
            </button>
          </template>
        </div>
      </NPopover>
    </div>
    <QuestionFilterChips
      :chips="chips"
      @edit="editChip"
      @remove="emit('filter', $event, '')"
      @clear="clear"
    />
  </div>
</template>
<style scoped>
.question-filters {
  display: grid;
  flex-shrink: 0;
  gap: 14px;
  min-width: 0;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--line);
  font-size: 14px;
}
.filter-tools-row {
  display: grid;
  grid-template-columns: minmax(260px, 420px) 132px 140px 116px 152px;
  align-items: center;
  gap: 8px;
}
.filter-search-input {
  width: 100%;
  min-width: 0;
}
.filter-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  max-width: 172px;
  height: 38px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}
.filter-tool > span:first-of-type {
  overflow: hidden;
  text-overflow: ellipsis;
}
.filter-tool > svg {
  flex-shrink: 0;
}
.filter-tool:hover,
.filter-tool[aria-expanded='true'] {
  background: var(--surface-2);
}
.filter-tool-active {
  background: var(--primary-soft);
}
.filter-count {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 3px;
  border-radius: 4px;
  background: var(--primary-soft);
  color: var(--text);
  font-size: 12px;
}
.filter-tool:focus-visible,
.filter-choice:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.question-filter-popover {
  width: 190px;
  max-width: calc(100vw - 56px);
  color: var(--text);
  font-size: 14px;
}
.company-filter-popover {
  width: 300px;
}
.filter-popover-heading {
  padding: 4px 9px 8px;
  color: var(--muted);
  font-size: 12px;
}
.filter-choice {
  font: inherit;
  font-size: 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
}
.filter-menu-choice,
.filter-all-company {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 38px;
  padding: 6px 9px;
  text-align: left;
}
.filter-menu-choice :deep(.mastery-badge) {
  font-size: 14px;
  line-height: 22px;
}
.filter-menu-choice:hover,
.filter-menu-choice[aria-pressed='true'],
.filter-all-company:hover {
  background: var(--surface-2);
}
.filter-all-company {
  margin: 8px 0;
}
.filter-company-options {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 10px;
  max-height: 240px;
  overflow-y: auto;
  padding: 3px;
  margin: -3px;
}
.filter-company-choice {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  max-width: 100%;
  min-height: 36px;
  padding: 5px 24px;
  border: 1px solid var(--company-border);
  border-radius: 999px;
  background: var(--company-background);
  color: var(--company-color);
  line-height: 24px;
}
.filter-company-choice:hover {
  background: var(--company-hover-background);
}
.filter-company-choice[aria-pressed='true'] {
  background: var(--company-selected-background);
}
.filter-company-check {
  position: absolute;
  left: 7px;
  top: 50%;
  transform: translateY(-50%);
}
.filter-option-empty {
  margin: 8px 0;
  color: var(--muted);
  font-size: 12px;
}
@container (max-width: 900px) {
  .filter-tools-row {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .filter-search-input {
    grid-column: 1 / -1;
  }
  .filter-tool {
    width: 100%;
    max-width: none;
  }
}
@container (max-width: 620px) {
  .filter-tools-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.question-filters--panel {
  padding: 0;
  border: 0;
  gap: 14px;
}
.question-filters--panel .filter-tools-row {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.question-filters--panel .filter-search-input {
  grid-column: 1 / -1;
}
.question-filters--panel .filter-tool {
  width: 100%;
  max-width: none;
  padding: 0 5px;
}
@media (max-width: 760px) {
  .question-filters:not(.question-filters--panel) {
    padding: 12px 16px;
  }
  .question-filters--panel .filter-tools-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
