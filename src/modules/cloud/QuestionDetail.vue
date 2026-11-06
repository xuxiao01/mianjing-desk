<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { NModal, NButton, NForm, useDialog, useMessage } from 'naive-ui';
import { Plus, X } from 'lucide-vue-next';
import { cloud } from './api';
import { useRefresh } from './queries';
import { canEdit } from '@/modules/auth/session';
import type { Occurrence } from './types';
import MasteryBadge from '@/shared/components/MasteryBadge.vue';
import SourceBadges from '@/shared/components/SourceBadges.vue';
import DataState from '@/shared/components/DataState.vue';
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';
import { useUnsavedChanges } from '@/shared/composables/useUnsavedChanges';
import { companyName } from '@/shared/utils/companyCatalog';
import { quickOccurrenceErrors } from '@/modules/questions/quickOccurrence';
import OccurrenceFields from './OccurrenceFields.vue';
import DetailActionsMenu from './DetailActionsMenu.vue';
import CompanyCatalogManager from './CompanyCatalogManager.vue';

const props = defineProps<{ id: string }>();
const emit = defineEmits<{ close: []; settled: [] }>();
const route = useRoute();
const { data, isPending, error, refetch } = useQuery({
  queryKey: computed(() => ['mianjing', 'detail', props.id]),
  queryFn: ({ signal }) => cloud.detail(props.id, signal),
});
const q = computed(() => data.value?.question);
const catalog = useCompanyCatalog();
type EditTarget = { kind: 'question' } | { kind: 'record'; id: string } | { kind: 'create' };
const active = ref<EditTarget | null>(null);
const title = ref(''),
  content = ref(''),
  companyId = ref<string | null>(null);
const baseline = ref(''),
  submitted = ref(false),
  formError = ref('');
const pending = ref(false),
  deleting = ref(false),
  transitioning = ref(false),
  confirming = ref(false);
const busy = computed(() => pending.value || deleting.value || transitioning.value);
const managing = ref(false);
const menuOpen = ref(false);
const nestedEscapes = new WeakSet<KeyboardEvent>();
const surface = ref<HTMLDivElement>(),
  scroller = ref<HTMLDivElement>();
const titleInput = ref<HTMLTextAreaElement>();
const titleHeight = ref(36);
function resizeTitle() {
  const field = titleInput.value;
  if (!field) return;
  field.style.height = '0px';
  field.style.height = Math.max(titleHeight.value, field.scrollHeight) + 'px';
}
function editTitle(event: Event) {
  title.value = (event.target as HTMLTextAreaElement).value;
  resizeTitle();
}
const recordFields = ref<InstanceType<typeof OccurrenceFields>>();
function setRecordFields(instance: unknown) {
  recordFields.value = instance as InstanceType<typeof OccurrenceFields> | undefined;
}
const originalFocus = document.activeElement as HTMLElement | null;
let editTrigger: HTMLElement | null = null;
let managerScroll = 0;
const dialog = useDialog(),
  message = useMessage(),
  refresh = useRefresh();
function serialize() {
  if (active.value?.kind === 'question') return title.value;
  if (active.value?.kind === 'create')
    return JSON.stringify({ companyId: companyId.value, content: content.value });
  return content.value;
}
const dirty = computed(() => !!active.value && serialize() !== baseline.value);
const createErrors = computed(() =>
  quickOccurrenceErrors({
    company: companyName(catalog.value, companyId.value || ''),
    content: content.value,
  }),
);
// While the catalog is open it owns the combined route warning, but its Cancel only checks its own draft.
const { allowLeave } = useUnsavedChanges(() => !managing.value && dirty.value, {
  isPending: () => busy.value,
});
function resetEditor() {
  active.value = null;
  formError.value = '';
  submitted.value = false;
  emit('settled');
}
function restoreEditFocus() {
  void nextTick(() => {
    if (editTrigger?.isConnected) editTrigger.focus({ preventScroll: true });
    else if (
      active.value === null &&
      surface.value?.querySelector<HTMLElement>('.detail-title-trigger')
    )
      surface.value
        .querySelector<HTMLElement>('.detail-title-trigger')
        ?.focus({ preventScroll: true });
    else surface.value?.focus({ preventScroll: true });
  });
}
async function begin(target: EditTarget, event: MouseEvent) {
  if (!canEdit.value || busy.value) return;
  if (JSON.stringify(active.value) === JSON.stringify(target)) return;
  const trigger = event.currentTarget as HTMLElement;
  transitioning.value = true;
  try {
    if (!(await allowLeave())) return;
    if (target.kind === 'question') {
      if (!q.value) return;
      title.value = q.value.title;
      titleHeight.value =
        surface.value?.querySelector('.detail-question-title')?.getBoundingClientRect().height ||
        36;
    } else if (target.kind === 'record') {
      const record = data.value?.occurrences.find((item) => item.id === target.id);
      if (!record) return;
      content.value = record.content;
    } else {
      companyId.value = null;
      content.value = '';
    }
    active.value = target;
    baseline.value = serialize();
    submitted.value = false;
    formError.value = '';
    editTrigger = trigger;
  } finally {
    transitioning.value = false;
  }
  await nextTick();
  if (active.value?.kind === 'question') {
    resizeTitle();
    titleInput.value?.focus();
  } else recordFields.value?.focus();
}
async function cancelEdit() {
  if (busy.value) return;
  transitioning.value = true;
  try {
    if (!(await allowLeave())) return;
    resetEditor();
    restoreEditFocus();
  } finally {
    transitioning.value = false;
  }
}
async function close() {
  if (busy.value || managing.value) return;
  transitioning.value = true;
  try {
    if (!(await allowLeave())) return;
    resetEditor();
    emit('close');
  } finally {
    transitioning.value = false;
  }
}
function capturePosition() {
  const box = scroller.value;
  if (!box) return undefined;
  const top = box.getBoundingClientRect().top;
  const row = [...box.querySelectorAll<HTMLElement>('[data-detail-record]')].find(
    (el) => el.getBoundingClientRect().bottom > top,
  );
  return {
    id: row?.dataset.detailRecord,
    offset: row ? row.getBoundingClientRect().top - top : 0,
    top: box.scrollTop,
  };
}
async function restorePosition(anchor: ReturnType<typeof capturePosition>) {
  await nextTick();
  const box = scroller.value;
  if (!box || !anchor) return;
  const row = [...box.querySelectorAll<HTMLElement>('[data-detail-record]')].find(
    (el) => el.dataset.detailRecord === anchor.id,
  );
  const top = row
    ? box.scrollTop +
      row.getBoundingClientRect().top -
      box.getBoundingClientRect().top -
      anchor.offset
    : anchor.top;
  box.scrollTop = Math.max(0, Math.min(top, box.scrollHeight - box.clientHeight));
}
async function save() {
  if (!canEdit.value || busy.value || !active.value) return;
  submitted.value = true;
  formError.value = '';
  const target = active.value;
  if (target.kind === 'create' && Object.keys(createErrors.value).length) return;
  if (target.kind === 'question' && !title.value.trim()) {
    formError.value = '请填写题目';
    titleInput.value?.focus();
    return;
  }
  const anchor = capturePosition();
  pending.value = true;
  let saved = false;
  try {
    if (target.kind === 'question') await cloud.edit(props.id, { title: title.value });
    else if (target.kind === 'record') await cloud.wording(target.id, content.value);
    else
      await cloud.record(props.id, { companyId: companyId.value!, content: content.value.trim() });
    saved = true;
    resetEditor();
    await refresh();
    await restorePosition(anchor);
    restoreEditFocus();
    message.success(
      target.kind === 'question'
        ? '题目已保存'
        : target.kind === 'record'
          ? '问法已保存'
          : '已记录一次出现',
    );
  } catch (error) {
    if (saved) message.warning('已保存，刷新失败，请重试加载');
    else formError.value = (error as Error).message;
  } finally {
    pending.value = false;
    emit('settled');
  }
}
function remove(record?: Occurrence) {
  if (!canEdit.value || busy.value || active.value || confirming.value) return;
  confirming.value = true;
  const anchor = capturePosition();
  dialog.warning({
    title: record ? '删除这条出现记录？' : '删除这道题目？',
    content: record ? '删除后次数减少，无法恢复。' : '题目和全部出现记录将直接删除，无法恢复。',
    positiveText: '删除',
    negativeText: '取消',
    onClose: () => {
      confirming.value = false;
    },
    onNegativeClick: () => {
      confirming.value = false;
    },
    onEsc: () => {
      confirming.value = false;
    },
    onMaskClick: () => {
      confirming.value = false;
    },
    onPositiveClick: async () => {
      if (!canEdit.value || busy.value || active.value) return false;
      deleting.value = true;
      try {
        if (record) await cloud.deleteOccurrence(record.id);
        else await cloud.deleteQuestion(props.id);
        // Allow the route guard to close a successfully deleted question.
        if (!record) {
          deleting.value = false;
          emit('close');
        }
        await refresh();
        if (record) await restorePosition(anchor);
        message.success('已删除');
      } catch (error) {
        message.error((error as Error).message);
        return false;
      } finally {
        deleting.value = false;
        confirming.value = false;
        emit('settled');
      }
    },
  });
}
function manage() {
  if (busy.value || !canEdit.value) return;
  managerScroll = scroller.value?.scrollTop || 0;
  managing.value = true;
}
async function finishManaging() {
  managing.value = false;
  await nextTick();
  if (scroller.value) scroller.value.scrollTop = managerScroll;
  recordFields.value?.focusManage();
}
function entered() {
  if (active.value?.kind === 'create') {
    if (scroller.value) scroller.value.scrollTop = managerScroll;
    recordFields.value?.focusManage();
  } else surface.value?.focus({ preventScroll: true });
}
function captureKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && (menuOpen.value || confirming.value)) nestedEscapes.add(event);
}
function key(event: KeyboardEvent) {
  if (
    event.key !== 'Escape' ||
    event.isComposing ||
    event.defaultPrevented ||
    nestedEscapes.has(event) ||
    busy.value ||
    managing.value ||
    confirming.value
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  if (active.value) void cancelEdit();
  else void close();
}
watch(
  () => route.fullPath,
  () => {
    resetEditor();
    managing.value = false;
  },
);
watch(
  () => props.id,
  () => {
    if (scroller.value) scroller.value.scrollTop = 0;
  },
);
watch(canEdit, (editable) => {
  if (!editable) {
    resetEditor();
    managing.value = false;
  }
});
onMounted(() => window.addEventListener('resize', resizeTitle));
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeTitle);
  void nextTick(() => {
    if (!/\/(questions|reading)(\/|$)/.test(route.path) || route.params.id) return;
    const fallback =
      document.querySelector<HTMLElement>('.reading-find-trigger') ||
      document.querySelector<HTMLElement>('.question-link');
    (originalFocus?.isConnected && originalFocus !== document.body
      ? originalFocus
      : fallback
    )?.focus({ preventScroll: true });
  });
});
</script>

<template>
  <NModal
    :show="!managing"
    display-directive="show"
    :auto-focus="false"
    :close-on-esc="false"
    :mask-closable="!busy"
    @after-enter="entered"
    @update:show="
      (show) => {
        if (!show) void close();
      }
    "
  >
    <div
      ref="surface"
      class="detail-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="q?.title || '题目详情'"
      tabindex="-1"
      @keydown.capture="captureKey"
      @keydown="key"
    >
      <header class="detail-topbar">
        <template v-if="active?.kind === 'question'">
          <NButton size="small" :disabled="busy" @click="cancelEdit">取消</NButton>
          <NButton
            size="small"
            type="primary"
            attr-type="submit"
            form="detail-title-form"
            :loading="pending"
            :disabled="deleting || transitioning"
            >保存题目</NButton
          >
        </template>
        <DetailActionsMenu
          v-if="canEdit && q"
          label="题目更多操作"
          delete-label="删除题目"
          :disabled="busy || !!active"
          @delete="remove()"
          @overlay="menuOpen = $event"
        />
        <button
          type="button"
          class="detail-close icon-button"
          aria-label="关闭题目详情"
          :disabled="busy"
          @click="close"
        >
          <X :size="21" />
        </button>
      </header>
      <div ref="scroller" class="detail-scroll">
        <DataState :loading="isPending" :error="error" @retry="refetch()">
          <div v-if="q" class="detail-content">
            <section class="detail-question">
              <form
                v-if="active?.kind === 'question'"
                id="detail-title-form"
                class="inline-question-editor"
                aria-label="编辑题目标题"
                @submit.prevent="save"
              >
                <textarea
                  ref="titleInput"
                  :value="title"
                  class="detail-title-input"
                  aria-label="题目标题"
                  :disabled="busy"
                  maxlength="10000"
                  rows="1"
                  :style="{ height: titleHeight + 'px' }"
                  @input="editTitle"
                />
                <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
              </form>
              <h2 v-else class="detail-question-title" :aria-label="q.title">
                <button
                  v-if="canEdit"
                  type="button"
                  class="detail-title-trigger"
                  aria-label="编辑题目标题"
                  title="点击修改题目"
                  :disabled="busy"
                  @click="begin({ kind: 'question' }, $event)"
                >
                  {{ q.title }}
                </button>
                <template v-else>{{ q.title }}</template>
              </h2>
              <div class="detail-metadata">
                <span class="category-chip">{{ q.category }}</span>
                <MasteryBadge :mastery="q.mastery" />
                <span class="muted">{{ q.priority }}优先级</span>
                <span v-for="tag in q.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
            </section>
            <section class="detail-records" aria-label="出现记录">
              <div class="detail-records-heading">
                <h3>
                  出现记录 <span class="muted">{{ q.totalCount }} 次</span>
                </h3>
                <NButton
                  v-if="canEdit"
                  size="small"
                  :disabled="busy || active?.kind === 'create'"
                  @click="begin({ kind: 'create' }, $event)"
                  ><template #icon><Plus :size="15" /></template>记录一次出现</NButton
                >
              </div>
              <p v-if="q.baseCount" class="detail-base-count muted">
                其中手动补充 {{ q.baseCount }} 次，无逐次明细
              </p>
              <NForm
                v-if="active?.kind === 'create'"
                class="inline-record-create"
                :disabled="busy"
                aria-label="记录一次出现"
                @submit.prevent="save"
              >
                <OccurrenceFields
                  :ref="setRecordFields"
                  v-model:content="content"
                  v-model:company-id="companyId"
                  show-company
                  :catalog="catalog"
                  :disabled="busy"
                  :company-error="submitted ? createErrors.company : undefined"
                  :content-error="submitted ? createErrors.content : undefined"
                  @manage="manage"
                />
                <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
                <footer class="inline-actions">
                  <NButton :disabled="busy" @click="cancelEdit">取消</NButton
                  ><NButton
                    type="primary"
                    attr-type="submit"
                    :loading="pending"
                    :disabled="deleting || transitioning"
                    >保存记录</NButton
                  >
                </footer>
              </NForm>
              <article
                v-for="record in data?.occurrences"
                :key="record.id"
                class="detail-record"
                :data-detail-record="record.id"
              >
                <div class="detail-record-top">
                  <SourceBadges
                    :company="record.company.name"
                    :recruitment-type="record.recruitmentType || undefined"
                    :round="record.round || undefined"
                  />
                  <div v-if="canEdit" class="record-actions">
                    <NButton
                      size="small"
                      text
                      :disabled="busy || (active?.kind === 'record' && active.id === record.id)"
                      @click="begin({ kind: 'record', id: record.id }, $event)"
                      >编辑问法</NButton
                    ><DetailActionsMenu
                      :label="record.company.name + '的记录更多操作'"
                      :delete-label="'删除' + record.company.name + '的出现记录'"
                      :disabled="busy || !!active"
                      @delete="remove(record)"
                      @overlay="menuOpen = $event"
                    />
                  </div>
                </div>
                <p class="record-time muted">
                  {{ new Date(record.createdAt).toLocaleString('zh-CN') }}
                </p>
                <NForm
                  v-if="active?.kind === 'record' && active.id === record.id"
                  class="inline-occurrence-editor"
                  :disabled="busy"
                  aria-label="编辑问法"
                  @submit.prevent="save"
                >
                  <OccurrenceFields
                    :ref="setRecordFields"
                    v-model:content="content"
                    :disabled="busy"
                  />
                  <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
                  <footer class="inline-actions">
                    <NButton :disabled="busy" @click="cancelEdit">取消</NButton
                    ><NButton
                      type="primary"
                      attr-type="submit"
                      :loading="pending"
                      :disabled="deleting || transitioning"
                      >保存问法</NButton
                    >
                  </footer>
                </NForm>
                <p v-else class="record-content" :class="{ muted: !record.content }">
                  {{ record.content || '未记录实际内容' }}
                </p>
              </article>
              <p
                v-if="!data?.occurrences.length && active?.kind !== 'create'"
                class="detail-empty muted"
              >
                暂无出现记录
              </p>
            </section>
          </div>
        </DataState>
      </div>
    </div>
  </NModal>
  <CompanyCatalogManager v-if="managing" :context-dirty="dirty" @close="finishManaging" />
</template>

<style scoped>
.detail-modal {
  width: min(1120px, calc(100vw - 64px));
  min-height: min(640px, calc(100dvh - 64px));
  max-height: calc(100dvh - 64px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: var(--shadow-modal);
  font-size: 14px;
  margin: auto;
}
.detail-modal:focus {
  outline: none;
}
.detail-topbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
}
.detail-close {
  width: 36px;
  height: 36px;
  padding: 0;
}
.detail-scroll {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
  padding: 12px 48px 48px;
}
.detail-content {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
}
.detail-question {
  padding: 0 0 28px;
}
.detail-question-title,
.inline-question-editor {
  margin: 0 0 20px;
}
.detail-question-title,
.detail-title-input {
  font-size: 24px;
  line-height: 36px;
  font-weight: 500;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.detail-title-trigger,
.detail-title-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  text-align: left;
}
.detail-title-trigger {
  font: inherit;
  white-space: inherit;
  overflow-wrap: inherit;
}
.detail-title-trigger:hover {
  background: var(--surface-2);
}
.detail-title-input {
  font-family: inherit;
  resize: none;
  overflow: hidden;
  background: var(--surface-2);
}
.detail-title-input:focus-visible {
  outline: 2px solid var(--text);
  outline-offset: 5px;
}
.detail-metadata {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 14px;
  line-height: 24px;
}
.detail-metadata :is(.category-chip, .tag),
.detail-metadata :deep(.mastery-badge) {
  padding: 2px 9px;
  font-size: 14px;
  line-height: 24px;
}
.detail-records {
  border-top: 1px solid var(--line);
  padding-top: 28px;
}
.detail-records-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}
.detail-records-heading h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}
.detail-records-heading h3 span {
  font-size: 14px;
  font-weight: 400;
  margin-left: 6px;
}
.detail-base-count {
  font-size: 13px;
  margin: 0 0 16px;
}
.detail-record {
  padding: 24px;
  margin-bottom: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
}
.detail-record-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.detail-record-top .source-badges {
  flex: 1;
  min-width: 100px;
}
.detail-record-top :deep(.source-company),
.detail-record-top :deep(.source-badge) {
  font-size: 14px;
  line-height: 24px;
}
.detail-modal :deep(.n-button--small-type) {
  --n-height: 36px !important;
  --n-font-size: 14px !important;
}
.record-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.record-time {
  margin: 10px 0 16px;
  font-size: 13px;
  line-height: 20px;
}
.record-content {
  margin: 0;
  font-size: 18px;
  line-height: 32px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.inline-record-create {
  margin-bottom: 20px;
  padding: 24px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
}
.inline-heading {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 500;
}
.inline-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
.inline-error {
  color: var(--danger);
  font-size: 14px;
  line-height: 22px;
}
.detail-empty {
  font-size: 14px;
  margin: 16px 0;
}
@media (max-width: 760px) {
  .detail-modal {
    width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    min-height: 100dvh;
    border: 0;
    border-radius: 0;
  }
  .detail-topbar {
    padding: 12px 16px;
  }
  .detail-scroll {
    padding: 8px 16px 32px;
  }
  .detail-question-title,
  .detail-title-input {
    font-size: 22px;
    line-height: 34px;
  }
  .record-content {
    font-size: 17px;
    line-height: 30px;
  }
  .detail-record {
    padding: 16px;
  }
  .inline-record-create {
    padding: 16px;
  }
}
</style>
