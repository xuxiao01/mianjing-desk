<script setup lang="ts">
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NButton,
  NInput,
  NSelect,
  NDataTable,
  NPagination,
  NPopover,
  NEmpty,
  NConfigProvider,
  NDialogProvider,
  useMessage,
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { Plus, Search, SlidersHorizontal, Maximize2 } from 'lucide-vue-next';
import { useQuery } from '@tanstack/vue-query';
import { cloud } from './api';
import { useRefresh } from './queries';
import { canEdit } from '@/modules/auth/session';
import MasteryBadge from '@/shared/components/MasteryBadge.vue';
import { categories, masteries } from '@/shared/types/domain';
import type { Question, MetaPatch as QuestionMetaPatch } from './types';
import type { QuestionFilters } from '@/shared/types/domain';
import { emptyFilters } from '@/modules/questions/model';
import PageHeading from '@/shared/components/PageHeading.vue';
import SearchHighlight from '@/shared/components/SearchHighlight.vue';
import { highlightTerms } from '@/shared/utils/searchHighlight';
import DataState from '@/shared/components/DataState.vue';
import MasteryCell from '@/modules/questions/MasteryCell.vue';
import QuestionMetaEditor from './QuestionMetaEditor.vue';
import CompanyLabel from '@/shared/components/CompanyLabel.vue';
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';
import QuestionDetail from './QuestionDetail.vue';
import QuestionEditor from './QuestionEditor.vue';
import { compactTableTheme, questionTheme } from '@/modules/questions/theme';
import '@/modules/questions/questions.css';
import ReadingSearchPanel from './ReadingSearchPanel.vue';
import { useReadingQuestions } from './useReadingQuestions';
import {
  captureReadingAnchor,
  restoreReadingAnchor,
  nearReadingEnd,
  type ReadingAnchor,
} from './readingViewport';
const refresh = useRefresh();
const message = useMessage();
const busyIds = ref(new Set<string>());
const metaEditor = ref<{ id: string; mode: 'company' | 'count' } | null>(null);
const metaQuestion = computed(() => data.value?.items.find((q) => q.id === metaEditor.value?.id));
const catalog = useCompanyCatalog();
function editMeta(q: Question, mode: 'company' | 'count') {
  if (canEdit.value && !busyIds.value.has(q.id)) metaEditor.value = { id: q.id, mode };
}
async function saveMeta(id: string, input: QuestionMetaPatch): Promise<boolean> {
  if (!canEdit.value || busyIds.value.has(id)) return false;
  busyIds.value = new Set([...busyIds.value, id]);
  try {
    await cloud.meta(id, input);
    await refresh();
    message.success('题目信息已更新');
    return true;
  } catch (error) {
    message.error((error as Error).message);
    return false;
  } finally {
    const next = new Set(busyIds.value);
    next.delete(id);
    busyIds.value = next;
  }
}
const route = useRoute(),
  router = useRouter();
const immersive = computed(() => route.meta.immersive === true);
const basePath = computed(() => (immersive.value ? '/reading' : '/questions'));
const readingHref = computed(() => router.resolve({ path: '/reading', query: route.query }).href);
const selectedId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const filters = computed<QuestionFilters>(() => {
  const get = (key: string) =>
    typeof route.query[key] === 'string' ? (route.query[key] as string) : '';
  return {
    ...emptyFilters,
    search: get('search'),
    category: get('category'),
    company: get('company'),
    mastery: get('mastery'),
    organized: get('organized'),
    sort: ['priority', 'count', 'updated'].includes(get('sort')) ? get('sort') : 'priority',
    page: Math.max(1, Math.floor(Number(get('page')) || 1)),
  };
});
const searchTerms = computed(() => highlightTerms(filters.value.search));
const pageSize = computed(() =>
  ['10', '20', '50'].includes(String(route.query.pageSize)) &&
  typeof route.query.pageSize === 'string'
    ? Number(route.query.pageSize)
    : 20,
);
function updateFilter(key: keyof QuestionFilters | 'pageSize', value: string | number | null) {
  const next = {
    ...filters.value,
    pageSize: pageSize.value,
    [key]: value ?? '',
    ...(key !== 'page' ? { page: 1 } : {}),
  };
  const query = Object.fromEntries(
    Object.entries(next)
      .filter(
        ([k, v]) =>
          v !== '' &&
          !(k === 'page' && v === 1) &&
          !(k === 'pageSize' && v === 20) &&
          !(k === 'sort' && v === 'priority'),
      )
      .map(([k, v]) => [k, String(v)]),
  );
  void router.replace({ path: route.path, query });
}
function clearFilters() {
  void router.replace({
    path: basePath.value,
    query: pageSize.value === 20 ? {} : { pageSize: String(pageSize.value) },
  });
  closeMoreFilters();
}
const paged = useQuery({
  enabled: computed(() => !immersive.value),
  queryKey: computed(() => [
    'mianjing',
    'questions',
    { ...filters.value, pageSize: pageSize.value },
  ]),
  queryFn: ({ signal }) => cloud.list({ ...filters.value, pageSize: pageSize.value }, signal),
});
const reading = useReadingQuestions(immersive, filters, pageSize);
const data = computed(() => (immersive.value ? reading.result.value : paged.data.value));
const isPending = computed(() =>
  immersive.value ? reading.isPending.value : paged.isPending.value,
);
const error = computed(() =>
  immersive.value ? (data.value ? null : reading.error.value) : paged.error.value,
);
function refetch() {
  if (immersive.value) reading.retry();
  else void paged.refetch();
}
const results = computed(
  () =>
    data.value || { items: [], total: 0, page: 1, pageSize: pageSize.value, usedCompanyIds: [] },
);
const allCompanies = computed(() =>
  catalog.value.items
    .filter((c) => data.value?.usedCompanyIds.includes(c.id))
    .map((c) => ({ label: c.name, value: c.id })),
);
const search = ref<InstanceType<typeof NInput>>();
const table = ref<InstanceType<typeof NDataTable>>();
const desktop = ref(false);
let desktopQuery: MediaQueryList | undefined;
const fullscreen = ref(false);
const supportsFullscreen = ref(false);
function syncFullscreen() {
  fullscreen.value = !!document.fullscreenElement;
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    message.info('暂时无法切换全屏，可继续在沉浸页面阅读。');
  }
}
function syncDesktop() {
  desktop.value = desktopQuery?.matches ?? false;
}
const moreOpen = ref(false);
const moreTrigger = ref<HTMLButtonElement>();
const morePanel = ref<HTMLDivElement>();
watch(moreOpen, async (open) => {
  if (open) {
    await nextTick();
    morePanel.value?.focus();
  }
});
function closeMoreFilters() {
  moreOpen.value = false;
  moreTrigger.value?.focus();
}
const conditionKey = computed(() =>
  JSON.stringify(
    immersive.value ? reading.conditions.value : { ...filters.value, pageSize: pageSize.value },
  ),
);
watch(
  conditionKey,
  () => {
    readingAnchor = undefined;
    void nextTick(() => table.value?.scrollTo({ top: 0, left: 0 }));
  },
  { flush: 'sync' },
);
watch(
  [immersive, () => route.query.page],
  () => {
    if (immersive.value && route.query.page !== undefined) {
      const query = { ...route.query };
      delete query.page;
      void router.replace({ path: route.path, query });
    }
  },
  { immediate: true },
);
let readingAnchor: ReadingAnchor | undefined;
let anchorKey = '';
let observedBody: HTMLElement | null = null;
let bodyObserver: ResizeObserver | undefined;
let checkFrame = 0;
function readingBody(): HTMLElement | null {
  return (
    table.value?.$el?.querySelector('.n-data-table-base-table-body .n-scrollbar-container') || null
  );
}
function checkReadingEnd() {
  if (!immersive.value || selectedId.value || editorOpen.value || metaEditor.value) return;
  const body = readingBody();
  if (body && nearReadingEnd(body)) reading.loadMore();
}
function scheduleReadingCheck() {
  if (!immersive.value) return;
  void nextTick(() => {
    const body = readingBody();
    if (body !== observedBody) {
      bodyObserver?.disconnect();
      observedBody = body;
      if (body && typeof ResizeObserver !== 'undefined') {
        bodyObserver = new ResizeObserver(checkReadingEnd);
        bodyObserver.observe(body);
      }
    }
    cancelAnimationFrame(checkFrame);
    checkFrame = requestAnimationFrame(checkReadingEnd);
  });
}
function readingScroll(event: Event) {
  if (immersive.value && event.target instanceof HTMLElement && nearReadingEnd(event.target))
    checkReadingEnd();
}
watch([() => reading.result.value, table, selectedId], scheduleReadingCheck, { flush: 'post' });
watch(
  () => reading.isFetching.value,
  (fetching, wasFetching) => {
    if (!immersive.value) return;
    const body = readingBody();
    if (fetching && !reading.isFetchingNextPage.value && body && data.value?.items.length) {
      readingAnchor = captureReadingAnchor(body);
      anchorKey = conditionKey.value;
    }
    if (!fetching && wasFetching) {
      void nextTick(() => {
        const current = readingBody();
        if (readingAnchor && anchorKey === conditionKey.value && current)
          restoreReadingAnchor(current, readingAnchor);
        readingAnchor = undefined;
        scheduleReadingCheck();
      });
    }
  },
  { flush: 'sync' },
);
const readingSummary = computed(() =>
  immersive.value && results.value.items.length
    ? () => ({
        title: {
          colSpan: 5,
          value: h('div', { class: 'reading-load-state', role: 'status' }, [
            reading.isFetching.value
              ? '正在加载…'
              : reading.isError.value
                ? h(
                    NButton,
                    { size: 'small', onClick: reading.retry },
                    { default: () => '加载失败，重试' },
                  )
                : reading.hasNextPage.value
                  ? h(
                      NButton,
                      { text: true, onClick: reading.loadMore },
                      { default: () => '继续加载' },
                    )
                  : '已全部加载',
          ]),
        },
      })
    : undefined,
);
function shortcut(event: KeyboardEvent) {
  if (immersive.value) return;
  const target = event.target as HTMLElement;
  if (
    event.key === '/' &&
    !editorOpen.value &&
    !metaEditor.value &&
    !selectedId.value &&
    !moreOpen.value &&
    !target.isContentEditable &&
    !target.closest('[role="menu"]') &&
    !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  ) {
    event.preventDefault();
    search.value?.focus();
  }
}
onMounted(() => {
  window.addEventListener('keydown', shortcut);
  supportsFullscreen.value =
    !!document.fullscreenEnabled &&
    typeof document.documentElement.requestFullscreen === 'function';
  syncFullscreen();
  document.addEventListener('fullscreenchange', syncFullscreen);
  if (typeof window.matchMedia === 'function') {
    desktopQuery = window.matchMedia('(min-width: 761px)');
    syncDesktop();
    desktopQuery.addEventListener('change', syncDesktop);
  }
});
onUnmounted(() => {
  window.removeEventListener('keydown', shortcut);
  document.removeEventListener('fullscreenchange', syncFullscreen);
  desktopQuery?.removeEventListener('change', syncDesktop);
  bodyObserver?.disconnect();
  cancelAnimationFrame(checkFrame);
});
const editorOpen = ref(false),
  editing = ref<Question>();
watch(canEdit, (editable) => {
  if (!editable) {
    editorOpen.value = false;
    metaEditor.value = null;
    editing.value = undefined;
  }
});
const settledTick = ref(0);
watch(
  [
    () => results.value.page,
    () => filters.value.page,
    () => !!data.value,
    () => busyIds.value.size,
    () => editorOpen.value,
    () => !!metaEditor.value,
    settledTick,
  ],
  ([effective, requested, loaded, busy, editing, meta]) => {
    if (!immersive.value && loaded && !busy && !editing && !meta && effective !== requested)
      updateFilter('page', effective as number);
  },
  { flush: 'post' },
);
function addQuestion() {
  editing.value = undefined;
  editorOpen.value = true;
}
function editQuestion(q: Question) {
  editing.value = q;
  editorOpen.value = true;
}
function openQuestion(id: string) {
  void router.push({ path: basePath.value + '/' + encodeURIComponent(id), query: route.query });
}
function closeDetail() {
  void router.push({ path: basePath.value, query: route.query });
}
function companyOverflow(q: Question, names: string[]) {
  if (canEdit.value)
    return h(
      'button',
      {
        type: 'button',
        class: 'company-overflow',
        disabled: busyIds.value.has(q.id),
        'aria-label': '编辑' + q.title + '的全部公司标签',
        onClick: () => editMeta(q, 'company'),
      },
      '+' + (names.length - 2),
    );
  return h(
    NPopover,
    { trigger: 'click', placement: 'bottom-start' },
    {
      trigger: () =>
        h(
          'button',
          {
            type: 'button',
            class: 'company-overflow',
            'aria-label': '查看' + q.title + '的全部公司标签',
          },
          '+' + (names.length - 2),
        ),
      default: () =>
        h(
          'div',
          { class: 'company-chips', style: { maxWidth: '300px' } },
          names.map((name) =>
            h(
              'span',
              {
                class: 'company-edit-chip readonly-chip',
              },
              h(CompanyLabel, { name }),
            ),
          ),
        ),
    },
  );
}
const columns = computed<DataTableColumns<Question>>(() => [
  {
    title: '题目 / 知识点',
    key: 'title',
    width: '39%',
    minWidth: 360,
    render(q) {
      return h('div', { class: 'question-cell' }, [
        h(
          'button',
          {
            class: 'question-link',
            'aria-label': q.title,
            title: q.title,
            onClick: () => openQuestion(q.id),
          },
          [
            h('i', {
              class: [
                'priority-dot',
                q.priority === '高' ? 'high' : q.priority === '低' ? 'low' : '',
              ],
              title: q.priority + '优先级',
            }),
            h('span', { class: 'question-title' }, [
              h(SearchHighlight, { text: q.title, query: searchTerms.value }),
            ]),
          ],
        ),
        h('div', { class: 'question-subline', title: [q.category, ...q.tags].join(' · ') }, [
          q.category,
          ...q.tags.flatMap((tag) => [
            ' · ',
            h(SearchHighlight, { text: tag, query: searchTerms.value }),
          ]),
        ]),
      ]);
    },
  },
  {
    title: '公司标签',
    key: 'company',
    width: '23%',
    minWidth: 220,
    render(q) {
      const names = q.companies.map((c) => c.name);
      return h(
        'div',
        { class: 'company-chips', title: names.join('、') },
        names.length
          ? [
              ...names.slice(0, 2).map((name) =>
                h(
                  canEdit.value ? 'button' : 'span',
                  {
                    ...(canEdit.value ? { type: 'button' } : {}),
                    class: canEdit.value ? 'company-edit-chip' : 'company-edit-chip readonly-chip',
                    title: name,
                    disabled: busyIds.value.has(q.id),
                    'aria-label':
                      (canEdit.value ? '编辑' : '查看') + q.title + '的公司标签：' + name,
                    onClick: canEdit.value ? () => editMeta(q, 'company') : undefined,
                  },
                  h(CompanyLabel, { name }),
                ),
              ),
              ...(names.length > 2 ? [companyOverflow(q, names)] : []),
            ]
          : !canEdit.value
            ? '—'
            : h(
                'button',
                {
                  type: 'button',
                  class: 'cell-edit empty-company-edit',
                  disabled: busyIds.value.has(q.id),
                  'aria-label': '添加' + q.title + '的公司标签',
                  onClick: canEdit.value ? () => editMeta(q, 'company') : undefined,
                },
                '+ 添加公司',
              ),
      );
    },
  },
  {
    title: '掌握程度',
    key: 'mastery',
    width: '13%',
    minWidth: 125,
    render: (q) =>
      canEdit.value
        ? h(MasteryCell, {
            question: q,
            busy: busyIds.value.has(q.id),
            save: (input: QuestionMetaPatch) => saveMeta(q.id, input),
          })
        : h(MasteryBadge, { mastery: q.mastery }),
  },
  {
    title: '出现次数',
    key: 'count',
    width: '13%',
    minWidth: 130,
    render(q) {
      return h(
        canEdit.value ? 'button' : 'span',
        {
          ...(canEdit.value ? { type: 'button' } : {}),
          class: canEdit.value ? 'cell-edit count-cell' : 'count-cell readonly-chip',
          disabled: busyIds.value.has(q.id),
          'aria-label': (canEdit.value ? '编辑' : '查看') + q.title + '的出现次数',
          onClick: canEdit.value ? () => editMeta(q, 'count') : undefined,
        },
        h('strong', q.totalCount),
      );
    },
  },
  {
    title: '整理状态',
    key: 'organized',
    width: '12%',
    minWidth: 115,
    render: (q) =>
      h(
        canEdit.value ? 'button' : 'span',
        {
          ...(canEdit.value ? { type: 'button' } : {}),
          class: [
            canEdit.value ? 'cell-edit' : 'readonly-chip',
            'organized-label',
            q.organized ? 'done' : '',
          ],
          disabled: busyIds.value.has(q.id),
          'aria-label': canEdit.value ? '切换' + q.title + '的整理状态' : undefined,
          'aria-pressed': canEdit.value ? q.organized : undefined,
          onClick: canEdit.value ? () => saveMeta(q.id, { organized: !q.organized }) : undefined,
        },
        q.organized ? '✓ 已整理' : '◌ 待整理',
      ),
  },
]);
</script>

<template>
  <NConfigProvider :theme-overrides="questionTheme">
    <NDialogProvider>
      <div class="questions-page" :class="{ 'reading-page': immersive }">
        <PageHeading v-if="!immersive" title="我的题库">
          <a
            :href="readingHref"
            target="_blank"
            rel="noopener noreferrer"
            class="reading-link"
            aria-label="在新标签页打开沉浸阅读"
          >
            <Maximize2 :size="16" aria-hidden="true" />沉浸阅读
          </a>
          <NButton v-if="canEdit" type="primary" size="large" :disabled="!data" @click="addQuestion"
            ><template #icon><Plus :size="17" /></template>添加题目</NButton
          >
        </PageHeading>
        <DataState :loading="isPending" :error="error" @retry="refetch()">
          <template v-if="data">
            <section class="content-panel">
              <div v-if="!immersive" class="question-toolbar">
                <div class="category-tabs">
                  <button
                    :aria-pressed="!filters.category"
                    :class="{ active: !filters.category }"
                    @click="updateFilter('category', '')"
                  >
                    全部题目</button
                  ><button
                    v-for="c in categories"
                    :key="c"
                    :class="{ active: filters.category === c }"
                    :aria-pressed="filters.category === c"
                    @click="updateFilter('category', c)"
                  >
                    {{
                      c === '八股'
                        ? '八股基础'
                        : c === '手撕'
                          ? '手撕代码'
                          : c === '算法'
                            ? '算法练习'
                            : '场景应用'
                    }}
                  </button>
                </div>
              </div>
              <div v-if="!immersive" class="filter-toolbar">
                <NInput
                  ref="search"
                  class="search-input"
                  :value="filters.search"
                  clearable
                  placeholder="搜索题目、问法、知识点…"
                  aria-label="搜索题目"
                  @update:value="updateFilter('search', $event)"
                  ><template #prefix><Search :size="15" /></template
                  ><template #suffix><kbd>/</kbd></template></NInput
                >
                <NSelect
                  :value="filters.company || null"
                  clearable
                  placeholder="全部公司"
                  :options="allCompanies"
                  class="company-filter"
                  aria-label="筛选公司"
                  @update:value="updateFilter('company', $event)"
                /><NSelect
                  :value="filters.mastery || null"
                  clearable
                  placeholder="全部掌握程度"
                  :options="masteries.map((m) => ({ label: m, value: m }))"
                  class="mastery-filter"
                  aria-label="筛选掌握程度"
                  @update:value="updateFilter('mastery', $event)"
                />
                <NPopover
                  :show="moreOpen"
                  trigger="click"
                  placement="bottom-start"
                  @update:show="moreOpen = $event"
                >
                  <template #trigger>
                    <button
                      ref="moreTrigger"
                      type="button"
                      class="more-filters"
                      :class="{ active: !!filters.organized }"
                      :aria-expanded="moreOpen"
                      aria-haspopup="dialog"
                      @keydown.down.prevent="moreOpen = true"
                      @keydown.esc.stop.prevent="closeMoreFilters"
                    >
                      <SlidersHorizontal :size="14" aria-hidden="true" />
                      更多筛选{{ filters.organized ? ' · 1' : '' }}
                    </button>
                  </template>
                  <div
                    ref="morePanel"
                    class="question-more-filters"
                    role="dialog"
                    aria-label="更多筛选"
                    tabindex="-1"
                    @keydown.esc.stop.prevent="closeMoreFilters"
                  >
                    <span>整理状态</span>
                    <NSelect
                      :value="filters.organized || null"
                      clearable
                      placeholder="全部整理状态"
                      :options="[
                        { label: '已整理', value: 'true' },
                        { label: '待整理', value: 'false' },
                      ]"
                      aria-label="筛选整理状态"
                      @update:value="updateFilter('organized', $event)"
                    />
                    <NButton text class="reset-filter" @click="clearFilters">重置筛选</NButton>
                  </div>
                </NPopover>
                <NSelect
                  :value="filters.sort"
                  :options="[
                    { label: '优先级排序', value: 'priority' },
                    { label: '出现次数最多', value: 'count' },
                    { label: '最近更新', value: 'updated' },
                  ]"
                  class="sort-filter"
                  aria-label="排序"
                  @update:value="updateFilter('sort', $event)"
                />
              </div>
              <NDataTable
                ref="table"
                class="questions-table"
                :theme-overrides="compactTableTheme"
                :flex-height="immersive || desktop"
                :columns="columns"
                :data="results.items"
                :row-key="(q: Question) => q.id"
                :bordered="false"
                :scroll-x="1100"
                :summary="readingSummary"
                :row-props="
                  immersive
                    ? (q: Question) => ({ class: 'reading-row', 'data-question-id': q.id })
                    : undefined
                "
                @scroll="readingScroll"
                ><template #empty
                  ><NEmpty description="没有找到匹配的题目"
                    ><template #extra
                      ><NButton size="small" @click="clearFilters">清除筛选</NButton></template
                    ></NEmpty
                  ></template
                ></NDataTable
              >
              <div v-if="!immersive" class="pagination-footer">
                <span
                  >显示 {{ results.total ? (results.page - 1) * results.pageSize + 1 : 0 }}–{{
                    Math.min(results.page * results.pageSize, results.total)
                  }}
                  条，共 {{ results.total }} 条</span
                >
                <div class="pagination-controls">
                  <NSelect
                    class="page-size-select"
                    :value="pageSize"
                    :options="[10, 20, 50].map((value) => ({ label: value + ' 条/页', value }))"
                    aria-label="每页题目数量"
                    @update:value="updateFilter('pageSize', $event)"
                  />
                  <NPagination
                    :page="results.page"
                    :page-size="results.pageSize"
                    :item-count="results.total"
                    :page-slot="5"
                    @update:page="updateFilter('page', $event)"
                  />
                </div>
              </div>
            </section>
            <QuestionDetail
              v-if="selectedId"
              :id="selectedId"
              @close="closeDetail"
              @edit="editQuestion"
              @settled="settledTick++"
            />
          </template>
        </DataState>
        <ReadingSearchPanel
          v-if="immersive"
          :filters="filters"
          :page-size="pageSize"
          :loaded="results.items.length"
          :total="results.total"
          :companies="allCompanies"
          :blocked="!!selectedId || editorOpen || !!metaEditor"
          :fullscreen="fullscreen"
          :supports-fullscreen="supportsFullscreen"
          @filter="updateFilter"
          @clear="clearFilters"
          @add="addQuestion"
          @fullscreen="toggleFullscreen"
        />
        <QuestionEditor
          :show="editorOpen"
          :question="editing"
          @close="editorOpen = false"
          @saved="
            (id) => {
              editorOpen = false;
              openQuestion(id);
            }
          "
        />
        <QuestionMetaEditor
          v-if="metaEditor && metaQuestion && data"
          :key="metaEditor.id + metaEditor.mode"
          :question="metaQuestion"
          :mode="metaEditor.mode"
          :tags="metaQuestion.companyIds"
          :catalog="catalog"
          :record-count="metaQuestion.recordCount"
          :busy="busyIds.has(metaQuestion.id)"
          :save="(input) => saveMeta(metaQuestion!.id, input)"
          @close="metaEditor = null"
          @saved="metaEditor = null"
        />
      </div>
    </NDialogProvider>
  </NConfigProvider>
</template>

<style scoped>
.questions-page.reading-page {
  height: 100dvh;
  min-height: 0;
}
.reading-page .content-panel {
  border: 0;
  border-radius: 0;
  overflow: hidden;
}
.questions-page.reading-page .questions-table {
  flex: 1;
  min-height: 0;
}
.reading-page :deep(.reading-load-state) {
  box-sizing: border-box;
  min-height: 84px;
  display: flex;
  align-items: flex-start;
  padding: 12px 0 44px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
}
.readonly-chip {
  cursor: default;
  border-color: transparent;
  outline: none;
  pointer-events: none;
}
.readonly-chip.company-edit-chip {
  border-color: transparent;
}
</style>
