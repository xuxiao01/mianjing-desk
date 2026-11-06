<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { NButton, NDropdown, NInput, NSelect } from 'naive-ui';
import { Search, SlidersHorizontal, MoreHorizontal, X, ChevronDown } from 'lucide-vue-next';
import { categories, masteries, type QuestionFilters } from '@/shared/types/domain';
import { canEdit, identity, clearSession } from '@/modules/auth/session';
import { useRouter } from 'vue-router';

const props = defineProps<{
  filters: QuestionFilters;
  pageSize: number;
  loaded: number;
  total: number;
  companies: { label: string; value: string }[];
  blocked: boolean;
  fullscreen: boolean;
  supportsFullscreen: boolean;
}>();
const emit = defineEmits<{
  filter: [key: keyof QuestionFilters | 'pageSize', value: string | number | null];
  clear: [];
  add: [];
  fullscreen: [];
}>();
const router = useRouter();
const open = ref(false);
const expanded = ref(false);
const menuOpen = ref(false);
const selectorOpen = ref(false);
const panel = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
const input = ref<InstanceType<typeof NInput>>();
let returnFocus: HTMLElement | null = null;
const shortcutLabel = ref('Ctrl+F');
const nestedEscapes = new WeakSet<KeyboardEvent>();
const count = computed(
  () =>
    [
      props.filters.search.trim(),
      props.filters.category,
      props.filters.company,
      props.filters.mastery,
      props.filters.organized,
      props.filters.sort !== 'priority',
    ].filter(Boolean).length,
);
function visible(element: Element) {
  return (
    element.getAttribute('aria-hidden') !== 'true' &&
    !element.closest('[aria-hidden="true"]') &&
    getComputedStyle(element).display !== 'none'
  );
}
function otherOverlay() {
  return [
    ...document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"], [aria-modal="true"]',
    ),
  ].some((element) => element !== panel.value && visible(element));
}
async function show() {
  if (props.blocked) return;
  if (!open.value) returnFocus = document.activeElement as HTMLElement | null;
  open.value = true;
  await nextTick();
  input.value?.focus();
  input.value?.select();
}
function close(restore = true) {
  open.value = false;
  menuOpen.value = false;
  selectorOpen.value = false;
  if (restore) {
    const target =
      returnFocus?.isConnected && returnFocus !== document.body ? returnFocus : trigger.value;
    target?.focus({ preventScroll: true });
  }
}
function shortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.repeat || props.blocked) return;
  const target = event.target instanceof HTMLElement ? event.target : document.body;
  const find = event.key.toLowerCase() === 'f' && (event.ctrlKey || event.metaKey) && !event.altKey;
  const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;
  if (!find && !slash) return;
  if (menuOpen.value || selectorOpen.value || otherOverlay()) return;
  const editable =
    target.isContentEditable ||
    !!target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]',
    );
  const ownSearch = !!target.closest('.reading-panel-search');
  if (editable && !(find && open.value && ownSearch)) return;
  event.preventDefault();
  void show();
}
function panelKey(event: KeyboardEvent) {
  if (
    event.isComposing ||
    event.defaultPrevented ||
    nestedEscapes.has(event) ||
    menuOpen.value ||
    selectorOpen.value
  )
    return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    close();
  } else if (
    event.key === 'Enter' &&
    (event.target as HTMLElement).closest('.reading-panel-search')
  ) {
    event.preventDefault();
    close();
  }
}
function capturePanelKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && (selectorOpen.value || menuOpen.value)) nestedEscapes.add(event);
}
function outside(event: PointerEvent) {
  if (!open.value) return;
  const target = event.target as HTMLElement;
  if (panel.value?.contains(target) || trigger.value?.contains(target)) return;
  // Selects and dropdowns are teleported; their selection must not dismiss this panel.
  if (target.closest('.n-base-select-menu, .n-dropdown-menu, .v-binder-follower-container')) return;
  close(false);
}
const menuOptions = computed(() => [
  { label: '返回普通题库', key: 'back' },
  ...(props.supportsFullscreen
    ? [{ label: props.fullscreen ? '退出全屏' : '进入全屏', key: 'fullscreen' }]
    : []),
  ...(canEdit.value ? [{ label: '添加题目', key: 'add' }] : []),
  {
    label: identity.value?.role === 'admin' ? '管理员' : '游客 · 只读',
    key: 'identity',
    disabled: true,
  },
  { label: '退出登录', key: 'logout' },
]);
async function action(key: string) {
  menuOpen.value = false;
  if (key === 'fullscreen') {
    emit('fullscreen');
    return;
  }
  close(false);
  if (key === 'add') emit('add');
  else if (key === 'back') {
    const query = { ...router.currentRoute.value.query };
    delete query.page;
    await router.push({ path: '/questions', query });
  } else if (key === 'logout') {
    const failure = await router.push('/login');
    if (!failure) clearSession();
  }
}
watch(
  () => props.blocked,
  (blocked) => {
    if (blocked) close(false);
  },
);
onMounted(() => {
  shortcutLabel.value = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘F' : 'Ctrl+F';
  window.addEventListener('keydown', shortcut);
  document.addEventListener('pointerdown', outside);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', shortcut);
  document.removeEventListener('pointerdown', outside);
});
</script>

<template>
  <button
    ref="trigger"
    class="reading-find-trigger"
    type="button"
    :aria-expanded="open"
    aria-controls="reading-search-panel"
    aria-haspopup="dialog"
    aria-label="查找和筛选题目"
    :disabled="blocked"
    @click="open ? close() : show()"
  >
    <Search :size="15" aria-hidden="true" /><span>查找</span>
    <span v-if="count" class="reading-filter-count">{{ count }}</span
    ><kbd>{{ shortcutLabel }}</kbd>
  </button>
  <section
    v-if="open"
    id="reading-search-panel"
    ref="panel"
    class="reading-search-panel"
    role="dialog"
    aria-modal="false"
    aria-labelledby="reading-search-title"
    @keydown.capture="capturePanelKey"
    @keydown="panelKey"
  >
    <header>
      <h2 id="reading-search-title">查找题目</h2>
      <NDropdown
        :show="menuOpen"
        :options="menuOptions"
        :node-props="
          (option) => ({
            role: 'menuitem',
            'aria-disabled': option.disabled ? ('true' as const) : ('false' as const),
          })
        "
        trigger="click"
        @update:show="menuOpen = $event"
        @select="action"
      >
        <button
          class="reading-panel-icon"
          type="button"
          aria-label="阅读更多操作"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
        >
          <MoreHorizontal :size="19" />
        </button>
      </NDropdown>
      <button class="reading-panel-icon" type="button" aria-label="关闭查询面板" @click="close()">
        <X :size="19" />
      </button>
    </header>
    <NInput
      ref="input"
      class="reading-panel-search"
      :value="filters.search"
      clearable
      placeholder="搜索题目、问法、知识点…"
      aria-label="搜索题目"
      @update:value="emit('filter', 'search', $event)"
    >
      <template #prefix><Search :size="16" /></template>
    </NInput>
    <div class="reading-panel-categories" aria-label="题目分类">
      <button
        type="button"
        :aria-pressed="!filters.category"
        @click="emit('filter', 'category', '')"
      >
        全部题目
      </button>
      <button
        v-for="category in categories"
        :key="category"
        type="button"
        :aria-pressed="filters.category === category"
        @click="emit('filter', 'category', category)"
      >
        {{ { 八股: '八股基础', 手撕: '手撕代码', 算法: '算法练习', 场景题: '场景应用' }[category] }}
      </button>
    </div>
    <button
      class="reading-expand-filters"
      type="button"
      :aria-expanded="expanded"
      aria-controls="reading-extra-filters"
      @click="expanded = !expanded"
    >
      <SlidersHorizontal :size="14" /><span>更多筛选</span
      ><ChevronDown :size="14" :class="{ rotated: expanded }" />
    </button>
    <div v-if="expanded" id="reading-extra-filters" class="reading-extra-filters">
      <label
        >公司<NSelect
          :value="filters.company || null"
          :options="companies"
          clearable
          placeholder="全部公司"
          aria-label="筛选公司"
          @update:show="selectorOpen = $event"
          @update:value="emit('filter', 'company', $event)"
      /></label>
      <label
        >掌握程度<NSelect
          :value="filters.mastery || null"
          :options="masteries.map((m) => ({ label: m, value: m }))"
          clearable
          placeholder="全部掌握程度"
          aria-label="筛选掌握程度"
          @update:show="selectorOpen = $event"
          @update:value="emit('filter', 'mastery', $event)"
      /></label>
      <label
        >整理状态<NSelect
          :value="filters.organized || null"
          clearable
          placeholder="全部整理状态"
          :options="[
            { label: '已整理', value: 'true' },
            { label: '待整理', value: 'false' },
          ]"
          aria-label="筛选整理状态"
          @update:show="selectorOpen = $event"
          @update:value="emit('filter', 'organized', $event)"
      /></label>
      <label
        >排序<NSelect
          :value="filters.sort"
          aria-label="排序"
          :options="[
            { label: '优先级排序', value: 'priority' },
            { label: '出现次数最多', value: 'count' },
            { label: '最近更新', value: 'updated' },
          ]"
          @update:show="selectorOpen = $event"
          @update:value="emit('filter', 'sort', $event)"
      /></label>
      <label
        >每批加载<NSelect
          :value="pageSize"
          aria-label="每批加载数量"
          :options="[10, 20, 50].map((value) => ({ label: value + ' 条', value }))"
          @update:show="selectorOpen = $event"
          @update:value="emit('filter', 'pageSize', $event)"
      /></label>
    </div>
    <footer>
      <span aria-live="polite">已加载 {{ loaded }}／{{ total }} 题</span>
      <NButton text type="primary" @click="emit('clear')">清除条件</NButton>
    </footer>
  </section>
</template>

<style scoped>
.reading-find-trigger {
  position: fixed;
  right: 20px;
  bottom: max(20px, env(safe-area-inset-bottom));
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--primary);
  color: var(--surface);
  box-shadow: 0 3px 14px rgb(32 33 36 / 9%);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.reading-find-trigger:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}
.reading-find-trigger:disabled {
  visibility: hidden;
}
.reading-find-trigger kbd {
  font: inherit;
  font-size: 12px;
  color: inherit;
}
.reading-filter-count {
  display: grid;
  place-items: center;
  min-width: 19px;
  height: 19px;
  border-radius: 6px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
}
.reading-search-panel {
  position: fixed;
  z-index: 100;
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
  box-sizing: border-box;
  width: min(480px, calc(100vw - 32px));
  max-height: calc(100dvh - 64px);
  overflow-y: auto;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 12px 48px rgb(32 33 36 / 15%);
  font-size: 14px;
}
.reading-search-panel header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
}
.reading-search-panel h2 {
  flex: 1;
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--heading);
}
.reading-panel-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
}
.reading-panel-icon:hover {
  background: var(--surface-2);
  color: var(--text);
}
.reading-panel-search {
  --n-height: 38px !important;
}
.reading-panel-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 14px 0 12px;
}
.reading-panel-categories button {
  min-height: 36px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--muted);
  background: var(--surface-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.reading-panel-categories button[aria-pressed='true'] {
  border-color: var(--primary-line);
  color: var(--primary);
  background: var(--primary-soft);
  font-weight: 600;
}
.reading-expand-filters {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 7px;
  padding: 8px 0;
  border: 0;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.reading-expand-filters span {
  flex: 1;
  text-align: left;
}
.rotated {
  transform: rotate(180deg);
}
.reading-extra-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  margin: 6px 0 16px;
}
.reading-extra-filters label {
  display: grid;
  gap: 5px;
  font-size: 12px;
  color: var(--muted);
}
.reading-search-panel footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
}
button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}
@media (max-width: 760px) {
  .reading-search-panel {
    top: 16px;
    padding: 16px;
  }
  .reading-find-trigger {
    right: 16px;
    bottom: max(16px, env(safe-area-inset-bottom));
  }
}
</style>
