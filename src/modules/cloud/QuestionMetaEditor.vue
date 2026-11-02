<script setup lang="ts">
import { computed, ref } from 'vue';
import { NButton, NForm, NFormItem, NInput, NModal } from 'naive-ui';
import { Settings2, X } from 'lucide-vue-next';
import type { Question, MetaPatch as QuestionMetaPatch } from './types';
import CompanyPicker from '@/shared/components/CompanyPicker.vue';
import CompanyCatalogManager from './CompanyCatalogManager.vue';
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';

import type { CompanyCatalog } from '@/shared/types/domain';
import { normalizeQuestionMetaPatch } from '@/shared/api/validation';
import { useUnsavedChanges } from '@/shared/composables/useUnsavedChanges';

const props = defineProps<{
  question: Question;
  mode: 'company' | 'count';
  tags: string[];
  catalog?: CompanyCatalog;
  recordCount: number;
  busy: boolean;
  save: (patch: QuestionMetaPatch) => Promise<boolean>;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();
const inherited = useCompanyCatalog();
const catalog = computed(() => props.catalog || inherited.value);
const managing = ref(false);
const tags = ref([...new Set(props.tags)]);
const baselineTags = new Set(tags.value);
const initialCount = String(props.question.totalCount);
const total = ref(initialCount);
const submitted = ref(false);
const dirty = computed(() => {
  if (props.mode === 'count') return total.value !== initialCount;
  const selected = new Set(tags.value);
  return selected.size !== baselineTags.size || [...selected].some((id) => !baselineTags.has(id));
});
const { allowLeave } = useUnsavedChanges(() => dirty.value, {
  isPending: () => props.busy,
  onRouteLeave: () => emit('close'),
});
const countError = computed(() => {
  if (!/^\d+$/.test(total.value.trim())) return '请输入非负整数';
  const value = Number(total.value);
  try {
    normalizeQuestionMetaPatch({ totalCount: value });
  } catch (error) {
    return (error as Error).message;
  }
  return value < props.recordCount
    ? `已有 ${props.recordCount} 条逐次记录，总次数不能低于 ${props.recordCount}`
    : '';
});
async function close() {
  if (!props.busy && (await allowLeave())) emit('close');
}
async function submit() {
  if (props.busy) return;
  submitted.value = true;
  if (props.mode === 'count' && countError.value) return;
  if (!dirty.value) {
    emit('close');
    return;
  }
  const patch =
    props.mode === 'company' ? { companyIds: tags.value } : { totalCount: Number(total.value) };
  if (await props.save(patch)) emit('saved');
}
</script>

<template>
  <NModal :show="!managing" :mask-closable="false" :close-on-esc="false" @update:show="close">
    <div
      class="modal-surface question-meta-editor"
      :class="{
        'question-count-editor': mode === 'count',
        'question-company-editor': mode === 'company',
      }"
      role="dialog"
      aria-modal="true"
      :aria-label="mode === 'company' ? '编辑公司标签' : '修改出现次数'"
    >
      <div class="modal-top">
        <h2>{{ mode === 'company' ? '编辑公司标签' : '修改出现次数' }}</h2>
        <div class="meta-header-actions">
          <button
            v-if="mode === 'company'"
            type="button"
            class="icon-button"
            aria-label="管理公司标签"
            title="管理公司标签"
            :disabled="busy"
            @click="managing = true"
          >
            <Settings2 :size="18" />
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label="关闭快捷编辑"
            :disabled="busy"
            @click="close"
          >
            <X :size="20" />
          </button>
        </div>
      </div>
      <p v-if="mode === 'count'" class="meta-question-title" :title="question.title">
        {{ question.title }}
      </p>
      <NForm :disabled="busy" @submit.prevent="submit">
        <template v-if="mode === 'company'">
          <CompanyPicker
            v-model="tags"
            multiple
            compact
            label="公司标签"
            :catalog="catalog"
            :disabled="busy"
          />
        </template>
        <template v-else>
          <NFormItem
            label="总次数"
            :validation-status="submitted && countError ? 'error' : undefined"
            :feedback="submitted ? countError || undefined : undefined"
            ><NInput
              v-model:value="total"
              :input-props="{ inputmode: 'numeric', 'aria-label': '总次数' }"
              placeholder="请输入总次数"
          /></NFormItem>
          <p class="meta-editor-help">
            已有 {{ recordCount }} 条逐次记录，当前手动补充
            {{ question.baseCount }} 次。总次数不能少于 {{ recordCount }}。
          </p>
        </template>
        <footer class="modal-footer">
          <span v-if="mode === 'count' && dirty">有未保存的修改</span
          ><NButton :disabled="busy" @click="close">取消</NButton
          ><NButton type="primary" attr-type="submit" :loading="busy">保存</NButton>
        </footer>
      </NForm>
    </div>
  </NModal>
  <CompanyCatalogManager v-if="managing" @close="managing = false" />
</template>
