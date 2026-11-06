<script setup lang="ts">
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NButton,
  NDataTable,
  NPopover,
  NEmpty,
  NConfigProvider,
  NDialogProvider,
  useMessage,
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { Plus, Maximize2 } from 'lucide-vue-next';
import { cloud } from './api';
import { useRefresh } from './queries';
import { canEdit } from '@/modules/auth/session';
import MasteryBadge from '@/shared/components/MasteryBadge.vue';
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
import FrequencyBadge from '@/modules/questions/FrequencyBadge.vue';
import OrganizedBadge from '@/modules/questions/OrganizedBadge.vue';
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';
import QuestionDetail from './QuestionDetail.vue';
import QuestionEditor from './QuestionEditor.vue';
import { compactTableTheme, questionTheme } from '@/modules/questions/theme';
import '@/modules/questions/questions.css';
import ReadingSearchPanel from './ReadingSearchPanel.vue';
import QuestionFilterControls from './QuestionFilterControls.vue';
import { clearedFilters, filterCount, questionFilterQuery, type FilterPatch } from './filterModel';
import { useReadingQuestions } from './useReadingQuestions';
import { useFilterPreferences } from './useFilterPreferences';
import {
  captureReadingAnchor,
  restoreReadingAnchor,
  nearReadingEnd,
  type ReadingAnchor,
} from './readingViewport';
const refresh = useRefresh();
const message = useMessage();
const busyIds = ref(new Set<string>());
const editorOpen = ref(false);
const metaEditor = ref<{ id: string; mode: 'company' | 'count' } | null>(null);
const metaQuestion = computed(() => data.value?.items.find((q) => q.id === metaEditor.value?.id));
const catalog = useCompanyCatalog();
function editMeta(q: Question, mode: 'company' | 'count') {
  if (canEdit.value && !rowBusy(q.id)) metaEditor.value = { id: q.id, mode };
}
async function saveMeta(id: string, input: QuestionMetaPatch): Promise<boolean> {
  if (!canEdit.value || rowBusy(id)) return false;
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
const preferences = useFilterPreferences();
const immersive = computed(() => route.meta.immersive === true);
const basePath = computed(() => (immersive.value ? '/reading' : '/questions'));
const readingHref = computed(
  () => router.resolve({ path: '/reading', query: preferences.query.value }).href,
);
const selectedId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const filters = computed<QuestionFilters>(() => {
  const get = (key: string) =>
    typeof preferences.query.value[key] === 'string'
      ? (preferences.query.value[key] as string)
      : '';
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
const hasFilterConditions = computed(
  () => !!filters.value.search.trim() || filterCount(filters.value) > 0,
);
const searchTerms = computed(() => highlightTerms(filters.value.search));
const pageSize = computed(() =>
  ['10', '20', '50'].includes(String(preferences.query.value.pageSize)) &&
  typeof preferences.query.value.pageSize === 'string'
    ? Number(preferences.query.value.pageSize)
    : 20,
);
function updateFilters(patch: FilterPatch) {
  void router.replace({
    path: route.path,
    query: questionFilterQuery(filters.value, pageSize.value, patch),
  });
}
function updateFilter(key: keyof QuestionFilters | 'pageSize', value: string | number | null) {
  updateFilters({ [key]: value });
}
function clearFilters() {
  updateFilters(clearedFilters);
}
const reading = useReadingQuestions(
  preferences.ready,
  filters,
  pageSize,
  computed(() => (immersive.value ? 'reading' : 'questions')),
);
const data = reading.result;
const isPending = reading.isPending;
const error = computed(() =>
  data.value && !reading.isPlaceholderData.value ? null : reading.error.value,
);
const listTransition = computed(() => reading.isPlaceholderData.value && reading.isFetching.value);
const transitionLoading = ref(false);
let transitionTimer: ReturnType<typeof setTimeout> | undefined;
watch(listTransition, (pending) => {
  clearTimeout(transitionTimer);
  transitionLoading.value = false;
  if (pending) transitionTimer = setTimeout(() => (transitionLoading.value = true), 180);
});
function rowBusy(id: string) {
  return listTransition.value || busyIds.value.has(id);
}
function refetch() {
  reading.retry();
}
const results = computed(
  () =>
    data.value || { items: [], total: 0, page: 1, pageSize: pageSize.value, usedCompanyIds: [] },
);
const usedCompanyIds = ref<string[]>([]);
watch(
  () => data.value?.usedCompanyIds,
  (ids) => {
    if (ids) usedCompanyIds.value = ids;
  },
  { immediate: true },
);
const allCompanies = computed(() =>
  catalog.value.items
    .filter((c) => usedCompanyIds.value.includes(c.id))
    .map((c) => ({ label: c.name, value: c.id })),
);
const filterControls = ref<InstanceType<typeof QuestionFilterControls>>();
const filterOverlay = ref(false);
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
const conditionKey = computed(() => JSON.stringify(reading.conditions.value));
const windowScrolling = computed(() => !immersive.value && !desktop.value);
function windowViewport(): HTMLElement {
  return (document.scrollingElement || document.documentElement) as HTMLElement;
}
function readingBody(): HTMLElement | null {
  return (
    table.value?.$el?.querySelector('.n-data-table-base-table-body .n-scrollbar-container') ||
    table.value?.$el?.querySelector('.n-scrollbar-container') ||
    null
  );
}
interface ListPosition {
  anchor: ReadingAnchor;
  windowMode: boolean;
  horizontal: number;
  conditions: string;
}
function capturePosition(): ListPosition | undefined {
  const viewport = windowScrolling.value ? windowViewport() : readingBody();
  if (!viewport) return;
  return {
    anchor: captureReadingAnchor(viewport, windowScrolling.value),
    windowMode: windowScrolling.value,
    horizontal: readingBody()?.scrollLeft || 0,
    conditions: conditionKey.value,
  };
}
function restorePosition(position: ListPosition | undefined) {
  if (
    disposed ||
    !position ||
    position.conditions !== conditionKey.value ||
    position.windowMode !== windowScrolling.value
  )
    return;
  const viewport = windowScrolling.value ? windowViewport() : readingBody();
  if (!viewport) return;
  restoreReadingAnchor(viewport, position.anchor, position.windowMode);
  if (position.windowMode && readingBody()) readingBody()!.scrollLeft = position.horizontal;
}
let readingAnchor: ListPosition | undefined;
let detailPosition: ListPosition | undefined;
let observedBody: HTMLElement | null = null;
let bodyObserver: ResizeObserver | undefined;
let checkFrame = 0;
let detailRestoreFrame = 0;
let disposed = false;
function checkReadingEnd() {
  if (disposed || selectedId.value || editorOpen.value || metaEditor.value) return;
  const viewport = windowScrolling.value ? windowViewport() : readingBody();
  if (viewport && nearReadingEnd(viewport, windowScrolling.value)) reading.loadMore();
}
function scheduleReadingCheck() {
  if (disposed) return;
  void nextTick(() => {
    if (disposed) return;
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
function readingScroll() {
  if (!windowScrolling.value) checkReadingEnd();
}
function windowScroll() {
  if (windowScrolling.value) scheduleReadingCheck();
}
watch(
  conditionKey,
  () => {
    readingAnchor = undefined;
    detailPosition = undefined;
    void nextTick(() => {
      if (disposed) return;
      table.value?.scrollTo({ top: 0, left: 0 });
      if (windowScrolling.value) window.scrollTo({ top: 0, behavior: 'instant' });
    });
  },
  { flush: 'sync' },
);
watch(
  [() => route.query.page, preferences.ready],
  ([page, ready]) => {
    if (ready && page !== undefined) {
      const query = { ...route.query };
      delete query.page;
      void router.replace({ path: route.path, query });
    }
  },
  { immediate: true },
);
watch(
  selectedId,
  (id, previous) => {
    if (id && !previous) detailPosition = capturePosition();
    if (!id && previous)
      void nextTick(() => {
        if (disposed) return;
        cancelAnimationFrame(detailRestoreFrame);
        detailRestoreFrame = requestAnimationFrame(() => {
          restorePosition(detailPosition);
          detailPosition = undefined;
          scheduleReadingCheck();
        });
      });
  },
  { flush: 'sync' },
);
watch(
  [data, table, selectedId, desktop, () => !!metaEditor.value, () => editorOpen.value],
  scheduleReadingCheck,
  { flush: 'post' },
);
watch(
  () => reading.isFetching.value,
  (fetching, wasFetching) => {
    if (
      fetching &&
      !reading.isFetchingNextPage.value &&
      !reading.isPlaceholderData.value &&
      data.value?.items.length
    )
      readingAnchor = capturePosition();
    if (!fetching && wasFetching)
      void nextTick(() => {
        restorePosition(readingAnchor);
        readingAnchor = undefined;
        scheduleReadingCheck();
      });
  },
  { flush: 'post' },
);
const readingSummary = computed(() =>
  results.value.items.length
    ? () => ({
        title: {
          colSpan: 5,
          value: h('div', { class: 'reading-load-state', role: 'status' }, [
            h(
              'span',
              { class: 'reading-loaded-count' },
              `已加载 ${results.value.items.length}／${results.value.total} 题`,
            ),
            reading.isFetching.value
              ? h('span', '正在加载…')
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
                  : h('span', '已全部加载'),
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
    !filterOverlay.value &&
    !target.isContentEditable &&
    !target.closest('[role="menu"]') &&
    !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  ) {
    event.preventDefault();
    filterControls.value?.focusSearch();
  }
}
onMounted(() => {
  window.addEventListener('keydown', shortcut);
  window.addEventListener('scroll', windowScroll, { passive: true });
  window.addEventListener('resize', scheduleReadingCheck);
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
  disposed = true;
  clearTimeout(transitionTimer);
  window.removeEventListener('keydown', shortcut);
  window.removeEventListener('scroll', windowScroll);
  window.removeEventListener('resize', scheduleReadingCheck);
  document.removeEventListener('fullscreenchange', syncFullscreen);
  desktopQuery?.removeEventListener('change', syncDesktop);
  bodyObserver?.disconnect();
  cancelAnimationFrame(checkFrame);
  cancelAnimationFrame(detailRestoreFrame);
});
watch(canEdit, (editable) => {
  if (!editable) {
    editorOpen.value = false;
    metaEditor.value = null;
  }
});
function addQuestion() {
  editorOpen.value = true;
}
function openQuestion(id: string) {
  if (listTransition.value) return;
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
        disabled: rowBusy(q.id),
        'aria-label': '编辑' + q.title + '的全部公司标签',
        onClick: () => editMeta(q, 'company'),
      },
      h('span', { class: 'company-overflow-badge' }, '+' + (names.length - 2)),
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
          h('span', { class: 'company-overflow-badge' }, '+' + (names.length - 2)),
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
            disabled: listTransition.value,
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
                    disabled: rowBusy(q.id),
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
                  disabled: rowBusy(q.id),
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
            busy: rowBusy(q.id),
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
          disabled: rowBusy(q.id),
          'aria-label': (canEdit.value ? '编辑' : '查看') + q.title + '的出现次数',
          onClick: canEdit.value ? () => editMeta(q, 'count') : undefined,
        },
        h(FrequencyBadge, { count: q.totalCount }),
      );
    },
  },
  {
    title: '是否整理',
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
          disabled: rowBusy(q.id),
          'aria-label': canEdit.value ? '切换' + q.title + '的整理状态' : undefined,
          'aria-pressed': canEdit.value ? q.organized : undefined,
          'aria-description': q.organized ? '已整理' : '待整理',
          onClick: canEdit.value ? () => saveMeta(q.id, { organized: !q.organized }) : undefined,
        },
        h(OrganizedBadge, { organized: q.organized }),
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
        <section class="content-panel">
          <QuestionFilterControls
            v-if="!immersive"
            ref="filterControls"
            :filters="filters"
            :companies="allCompanies"
            @filter="updateFilter"
            @clear="clearFilters"
            @overlay="filterOverlay = $event"
          />
          <DataState :loading="isPending" :error="error" @retry="refetch()">
            <template v-if="data">
              <NDataTable
                ref="table"
                class="questions-table"
                :aria-busy="listTransition"
                :loading="transitionLoading"
                :theme-overrides="compactTableTheme"
                :flex-height="immersive || desktop"
                :columns="columns"
                :data="results.items"
                :row-key="(q: Question) => q.id"
                :bordered="false"
                :scroll-x="1100"
                :summary="readingSummary"
                :row-props="(q: Question) => ({ class: 'reading-row', 'data-question-id': q.id })"
                @scroll="readingScroll"
                ><template #empty
                  ><NEmpty description="没有找到匹配的题目"
                    ><template v-if="immersive || !hasFilterConditions" #extra>
                      <NButton
                        size="small"
                        @click="hasFilterConditions ? clearFilters() : updateFilter('category', '')"
                        >{{ hasFilterConditions ? '清除筛选' : '查看全部题目' }}</NButton
                      >
                    </template></NEmpty
                  ></template
                ></NDataTable
              >
            </template>
          </DataState>
        </section>
        <QuestionDetail
          v-if="selectedId"
          :id="selectedId"
          @close="closeDetail"
          @settled="scheduleReadingCheck"
        />
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
.questions-page :deep(.reading-load-state) {
  box-sizing: border-box;
  min-height: 56px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
}
.reading-page :deep(.reading-load-state) {
  min-height: 84px;
  padding-bottom: 44px;
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
