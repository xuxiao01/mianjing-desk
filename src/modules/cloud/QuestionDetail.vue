<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { NDrawer, NDrawerContent, NButton, useDialog, useMessage } from 'naive-ui';
import { Pencil, Plus, Trash2 } from 'lucide-vue-next';
import { cloud } from './api';
import { useRefresh } from './queries';
import { canEdit } from '@/modules/auth/session';
import type { Question, Occurrence } from './types';
import MasteryBadge from '@/shared/components/MasteryBadge.vue';
import SourceBadges from '@/shared/components/SourceBadges.vue';
import DataState from '@/shared/components/DataState.vue';
import OccurrenceCreate from './OccurrenceCreate.vue';
import OccurrenceEditor from './OccurrenceEditor.vue';
const props = defineProps<{ id: string }>();
const emit = defineEmits<{ close: []; edit: [q: Question]; settled: [] }>();
const { data, isPending, error, refetch } = useQuery({
  queryKey: computed(() => ['mianjing', 'detail', props.id]),
  queryFn: ({ signal }) => cloud.detail(props.id, signal),
});
const q = computed(() => data.value?.question),
  editing = ref<Occurrence>(),
  recording = ref(false),
  deleting = ref(false);
const dialog = useDialog(),
  message = useMessage(),
  refresh = useRefresh();
function remove(record?: Occurrence) {
  if (!canEdit.value || deleting.value) return;
  dialog.warning({
    title: record ? '删除这条出现记录？' : '删除这道题目？',
    content: record ? '删除后次数减少，无法恢复。' : '题目和全部出现记录将直接删除，无法恢复。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deleting.value = true;
      try {
        if (record) await cloud.deleteOccurrence(record.id);
        else await cloud.deleteQuestion(props.id);
        if (!record) emit('close');
        await refresh();
        message.success('已删除');
      } catch (e) {
        message.error((e as Error).message);
        return false;
      } finally {
        deleting.value = false;
      }
    },
  });
}
</script>
<template>
  <NDrawer
    :show="true"
    width="min(720px, 100vw)"
    placement="right"
    :mask-closable="!deleting"
    @update:show="(show) => !show && emit('close')"
    ><NDrawerContent title="题目详情" closable :native-scrollbar="false">
      <DataState :loading="isPending" :error="error" @retry="refetch()"
        ><div v-if="q" class="question-detail">
          <section class="standard-question">
            <div class="detail-section-top">
              <h3>标准题目</h3>
              <div v-if="canEdit" class="detail-actions">
                <NButton size="small" :disabled="deleting" @click="emit('edit', q)"
                  ><template #icon><Pencil :size="14" /></template>编辑题目</NButton
                ><NButton
                  size="small"
                  text
                  type="error"
                  :disabled="deleting"
                  aria-label="删除题目"
                  @click="remove()"
                  ><Trash2 :size="15"
                /></NButton>
              </div>
            </div>
            <div class="detail-chips">
              <span class="category-chip">{{ q.category }}</span
              ><MasteryBadge :mastery="q.mastery" /><span class="muted"
                >{{ q.priority }}优先级</span
              >
            </div>
            <h2>{{ q.title }}</h2>
            <div class="tag-row">
              <span v-for="tag in q.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </section>
          <section class="detail-section">
            <h3>
              出现记录 <span class="section-count">{{ q.totalCount }} 次</span>
            </h3>
            <p v-if="q.baseCount" class="muted">手动补充 {{ q.baseCount }} 次</p>
            <article v-for="o in data?.occurrences" :key="o.id" class="occurrence-card">
              <div class="occurrence-card-top">
                <SourceBadges
                  :company="o.company.name"
                  :recruitment-type="o.recruitmentType || undefined"
                  :round="o.round || undefined"
                />
                <div v-if="canEdit" class="detail-actions">
                  <NButton
                    size="small"
                    text
                    type="primary"
                    :disabled="deleting"
                    @click="editing = o"
                    >编辑问法</NButton
                  ><NButton
                    size="small"
                    text
                    type="error"
                    :disabled="deleting"
                    :aria-label="'删除' + o.company.name + '的出现记录'"
                    @click="remove(o)"
                    ><Trash2 :size="14"
                  /></NButton>
                </div>
              </div>
              <small class="muted">{{ new Date(o.createdAt).toLocaleString('zh-CN') }}</small>
              <div class="occurrence-wording">
                <p :class="{ muted: !o.content }">{{ o.content || '未记录实际内容' }}</p>
              </div>
            </article>
            <p v-if="!data?.occurrences.length" class="muted occurrence-empty">暂无出现记录</p>
            <NButton
              v-if="canEdit"
              class="full-width"
              dashed
              :disabled="deleting"
              @click="recording = true"
              ><template #icon><Plus :size="15" /></template>记录一次出现</NButton
            >
          </section>
        </div></DataState
      ></NDrawerContent
    ></NDrawer
  >
  <OccurrenceEditor
    v-if="editing"
    :key="editing.id"
    :occurrence="editing"
    @close="
      editing = undefined;
      emit('settled');
    "
    @saved="
      editing = undefined;
      emit('settled');
    "
  />
  <OccurrenceCreate
    v-if="recording"
    :question-id="id"
    @close="
      recording = false;
      emit('settled');
    "
    @saved="
      recording = false;
      emit('settled');
    "
  />
</template>
<style scoped>
.detail-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
