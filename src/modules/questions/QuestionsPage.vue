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
import { Plus, Search, SlidersHorizontal, Maximize2, Minimize2, ArrowLeft } from 'lucide-vue-next';
import { useDesk, useDeskActions } from '@/shared/composables/useDesk';
import { categories, masteries } from '@/shared/types/domain';
import type { Question, QuestionFilters, QuestionMetaPatch } from '@/shared/types/domain';
import {
  companyNames,
  emptyFilters,
  occurrenceCount,
  questionOccurrences,
  selectQuestions,
} from './model';
import PageHeading from '@/shared/components/PageHeading.vue';
import SearchHighlight from '@/shared/components/SearchHighlight.vue';
import { highlightTerms } from '@/shared/utils/searchHighlight';
import DataState from '@/shared/components/DataState.vue';
import MasteryCell from './MasteryCell.vue';
import QuestionMetaEditor from './QuestionMetaEditor.vue';
import { companyColorStyle } from '@/shared/utils/companyColors';
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';
import QuestionDetail from './QuestionDetail.vue';
import QuestionEditor from './QuestionEditor.vue';
import { compactTableTheme, questionTheme } from './theme';
import './questions.css';
const { data, isPending, error, refetch } = useDesk();
const { questionMeta } = useDeskActions();
const message = useMessage();
const busyIds = ref(new Set<string>());
const metaEditor = ref<{ id: string; mode: 'company' | 'count' } | null>(null);
const metaQuestion = computed(() =>
  data.value?.questions.find((q) => q.id === metaEditor.value?.id),
);
const catalog = useCompanyCatalog(data);
function editMeta(q: Question, mode: 'company' | 'count') {
  if (!busyIds.value.has(q.id)) metaEditor.value = { id: q.id, mode };
}
async function saveMeta(id: string, input: QuestionMetaPatch): Promise<boolean> {
  if (busyIds.value.has(id)) return false;
  busyIds.value = new Set([...busyIds.value, id]);
  try {
    await questionMeta.mutateAsync({ id, input });
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
const normalHref = computed(() => router.resolve({ path: '/questions', query: route.query }).href);
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
const results = computed(() =>
  data.value
    ? selectQuestions(data.value, filters.value, pageSize.value)
    : { items: [], total: 0, page: 1, pageSize: pageSize.value },
);
watch(
  [() => results.value.page, () => filters.value.page, () => !!data.value],
  ([effective, requested, loaded]) => {
    if (loaded && effective !== requested) updateFilter('page', effective);
  },
  { flush: 'post' },
);
const allCompanies = computed(() =>
  [...new Set(data.value?.questions.flatMap((q) => companyNames(data.value!, q)) || [])]
    .sort((a, b) => a.localeCompare(b, 'zh'))
    .map((x) => ({ label: x, value: x })),
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
watch([filters, pageSize], () => table.value?.scrollTo({ top: 0, left: 0 }));
function shortcut(event: KeyboardEvent) {
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
});
const editorOpen = ref(false),
  editing = ref<Question>();
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
const columns = computed<DataTableColumns<Question>>(() => [
  {
    title: '题目 / 知识点',
    key: 'title',
    width: '39%',
    minWidth: 360,
    render(q) {
      return h('div', { class: 'question-cell' }, [
        h('button', { class: 'question-link', title: q.title, onClick: () => openQuestion(q.id) }, [
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
        ]),
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
      const names = companyNames(data.value!, q);
      return h(
        'div',
        { class: 'company-chips', title: names.join('、') },
        names.length
          ? [
              ...names.slice(0, 2).map((name) =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'company-edit-chip',
                    style: companyColorStyle(name, catalog.value),
                    title: name,
                    disabled: busyIds.value.has(q.id),
                    'aria-label': '编辑' + q.title + '的公司标签：' + name,
                    onClick: () => editMeta(q, 'company'),
                  },
                  name,
                ),
              ),
              ...(names.length > 2
                ? [
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'company-overflow',
                        disabled: busyIds.value.has(q.id),
                        'aria-label': '编辑' + q.title + '的全部公司标签',
                        onClick: () => editMeta(q, 'company'),
                      },
                      '+' + (names.length - 2),
                    ),
                  ]
                : []),
            ]
          : h(
              'button',
              {
                type: 'button',
                class: 'cell-edit empty-company-edit',
                disabled: busyIds.value.has(q.id),
                'aria-label': '添加' + q.title + '的公司标签',
                onClick: () => editMeta(q, 'company'),
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
      h(MasteryCell, {
        question: q,
        busy: busyIds.value.has(q.id),
        save: (input) => saveMeta(q.id, input),
      }),
  },
  {
    title: '出现次数',
    key: 'count',
    width: '13%',
    minWidth: 130,
    render(q) {
      return h(
        'button',
        {
          type: 'button',
          class: 'cell-edit count-cell',
          disabled: busyIds.value.has(q.id),
          'aria-label': '编辑' + q.title + '的出现次数',
          onClick: () => editMeta(q, 'count'),
        },
        h('strong', occurrenceCount(data.value!, q)),
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
        'button',
        {
          type: 'button',
          class: ['cell-edit', 'organized-label', q.organized ? 'done' : ''],
          disabled: busyIds.value.has(q.id),
          'aria-label': '切换' + q.title + '的整理状态',
          'aria-pressed': q.organized,
          onClick: () => saveMeta(q.id, { organized: !q.organized }),
        },
        q.organized ? '✓ 已整理' : '◌ 待整理',
      ),
  },
]);
</script>

<template>
  <NConfigProvider :theme-overrides="questionTheme">
    <NDialogProvider>
      <div class="questions-page">
        <PageHeading :title="immersive ? '沉浸题库' : '我的题库'">
          <RouterLink v-if="immersive" :to="normalHref" class="reading-link">
            <ArrowLeft :size="16" aria-hidden="true" />返回题库
          </RouterLink>
          <a
            v-else
            :href="readingHref"
            target="_blank"
            rel="noopener noreferrer"
            class="reading-link"
            aria-label="在新标签页打开沉浸阅读"
          >
            <Maximize2 :size="16" aria-hidden="true" />沉浸阅读
          </a>
          <NButton v-if="immersive && supportsFullscreen" @click="toggleFullscreen">
            <template #icon>
              <Minimize2 v-if="fullscreen" :size="16" /><Maximize2 v-else :size="16" />
            </template>
            {{ fullscreen ? '退出全屏' : '进入全屏' }}
          </NButton>
          <NButton type="primary" size="large" :disabled="!data" @click="addQuestion"
            ><template #icon><Plus :size="17" /></template>添加题目</NButton
          >
        </PageHeading>
        <DataState :loading="isPending" :error="error" @retry="refetch()">
          <template v-if="data">
            <section class="content-panel">
              <div class="question-toolbar">
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
              <div class="filter-toolbar">
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
                :flex-height="desktop"
                :columns="columns"
                :data="results.items"
                :row-key="(q: Question) => q.id"
                :bordered="false"
                :scroll-x="1100"
                ><template #empty
                  ><NEmpty description="没有找到匹配的题目"
                    ><template #extra
                      ><NButton size="small" @click="clearFilters">清除筛选</NButton></template
                    ></NEmpty
                  ></template
                ></NDataTable
              >
              <div class="pagination-footer">
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
              :data="data"
              @close="closeDetail"
              @edit="editQuestion"
            />
          </template>
        </DataState>
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
          :tags="companyNames(data, metaQuestion)"
          :catalog="catalog"
          :record-count="questionOccurrences(data, metaQuestion.id).length"
          :busy="busyIds.has(metaQuestion.id)"
          :save="(input) => saveMeta(metaQuestion!.id, input)"
          @close="metaEditor = null"
          @saved="metaEditor = null"
        />
      </div>
    </NDialogProvider>
  </NConfigProvider>
</template>
