<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NModal, NButton, NForm, NFormItem, useMessage } from 'naive-ui';
import { X, Save } from 'lucide-vue-next';
import { recruitmentTypes, interviewRounds } from '@/shared/types/domain';
import type { Question, QuestionInput, CreateInput } from './types';
import type { RecruitmentType, InterviewRound } from '@/shared/types/domain';
import { cloud } from './api';
import { useRefresh } from './queries';
import { useUnsavedChanges } from '@/shared/composables/useUnsavedChanges';
import BubbleSelect from '@/shared/components/BubbleSelect.vue';
import CompanyPicker from '@/shared/components/CompanyPicker.vue';
import CompanyCatalogManager from './CompanyCatalogManager.vue';
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';
import { companyName } from '@/shared/utils/companyCatalog';
import { interviewSourceErrors } from '@/shared/api/validation';
import QuestionFields from './QuestionFields.vue';
import { questionPayload } from './questionForm';

const props = defineProps<{ show: boolean; question?: Question }>();
const emit = defineEmits<{ close: []; saved: [id: string] }>();
const input = reactive<QuestionInput>({
  title: '',
  category: '八股',
  tags: [],
  priority: '中',
  mastery: '模糊',
  organized: false,
});
const tags = ref('');
const baseline = ref('');
const source = reactive({
  company: '',
  recruitmentType: null as RecruitmentType | null,
  round: null as InterviewRound | null,
});
const sourceSubmitted = ref(false);
const companyChoice = ref<string | null>(null);
const catalog = useCompanyCatalog();
const managing = ref(false);
const sourceErrors = computed(() => interviewSourceErrors(source));
const hasSource = computed(() => !!(source.company || source.recruitmentType || source.round));
watch([companyChoice, catalog], () => {
  source.company = companyName(catalog.value, companyChoice.value || '');
});
const serialize = () =>
  JSON.stringify({
    ...input,
    tags: tags.value,
    source: props.question ? undefined : { ...source, company: companyChoice.value },
    companyChoice: props.question ? undefined : companyChoice.value,
  });
watch(
  () => props.show,
  (open) => {
    if (!open) return;
    const q = props.question;
    Object.assign(
      input,
      q
        ? {
            title: q.title,
            category: q.category,
            tags: [...q.tags],
            priority: q.priority,
            mastery: q.mastery,
            organized: q.organized,
          }
        : {
            title: '',
            category: '八股',
            tags: [],
            priority: '中',
            mastery: '模糊',
            organized: false,
          },
    );
    tags.value = q?.tags.join(', ') || '';
    Object.assign(source, { company: '', recruitmentType: null, round: null });
    companyChoice.value = null;
    sourceSubmitted.value = false;
    baseline.value = serialize();
  },
  { immediate: true },
);
const dirty = computed(() => props.show && serialize() !== baseline.value);
const pending = ref(false);
const refresh = useRefresh();
const { allowLeave } = useUnsavedChanges(() => dirty.value, {
  isPending: () => props.show && pending.value,
  onRouteLeave: () => {
    if (props.show) emit('close');
  },
});
const message = useMessage();
const options = <T extends string>(values: readonly T[]) =>
  values.map((x) => ({ label: x, value: x }));
async function close() {
  if (!pending.value && (await allowLeave())) emit('close');
}
async function save() {
  if (pending.value) return;
  sourceSubmitted.value = true;
  if (!props.question && Object.keys(sourceErrors.value).length) return;
  try {
    const payload = questionPayload(input, tags.value);
    pending.value = true;
    const createInput: CreateInput = {
      ...payload,
      ...(hasSource.value
        ? {
            source: {
              companyId: companyChoice.value!,
              recruitmentType: source.recruitmentType!,
              round: source.round!,
            },
          }
        : {}),
    };
    const q = props.question
      ? await cloud.edit(props.question.id, payload)
      : await cloud.create(createInput);
    await refresh();
    baseline.value = serialize();
    emit('saved', q.id);
    message.success('题目已保存');
  } catch (error) {
    message.error((error as Error).message);
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <NModal
    :show="show && !managing"
    :mask-closable="false"
    :close-on-esc="false"
    @update:show="close"
  >
    <div
      class="modal-surface question-editor"
      role="dialog"
      aria-modal="true"
      :aria-label="question ? '编辑题目' : '添加题目'"
    >
      <div class="modal-top">
        <div>
          <h2>{{ question ? '编辑题目' : '添加一道题' }}</h2>
        </div>
        <button class="icon-button" aria-label="关闭题目编辑" :disabled="pending" @click="close">
          <X :size="20" />
        </button>
      </div>
      <NForm :disabled="pending" @submit.prevent="save"
        ><QuestionFields
          :model-value="input"
          :tags="tags"
          :show-organized="!!question"
          @update:model-value="Object.assign(input, $event)"
          @update:tags="tags = $event"
        >
          <section v-if="!question" class="question-source" aria-label="面试来源">
            <h3>面试来源 <span>选填</span></h3>
            <NFormItem
              label="公司"
              :validation-status="sourceSubmitted && sourceErrors.company ? 'error' : undefined"
              :feedback="sourceSubmitted ? sourceErrors.company : undefined"
            >
              <div class="company-entry">
                <CompanyPicker
                  :catalog="catalog"
                  :model-value="companyChoice ? [companyChoice] : []"
                  :disabled="pending"
                  @update:model-value="companyChoice = $event[0] || null"
                  @manage="managing = true"
                />
              </div>
            </NFormItem>
            <div class="form-grid">
              <NFormItem
                label="招聘类型"
                :validation-status="
                  sourceSubmitted && sourceErrors.recruitmentType ? 'error' : undefined
                "
                :feedback="sourceSubmitted ? sourceErrors.recruitmentType : undefined"
              >
                <BubbleSelect
                  v-model="source.recruitmentType"
                  :options="options(recruitmentTypes)"
                  :company="source.company"
                  :catalog="catalog"
                  label="招聘类型"
                  :disabled="pending"
                />
              </NFormItem>
              <NFormItem
                label="面试轮次"
                :validation-status="sourceSubmitted && sourceErrors.round ? 'error' : undefined"
                :feedback="sourceSubmitted ? sourceErrors.round : undefined"
              >
                <BubbleSelect
                  v-model="source.round"
                  :options="options(interviewRounds)"
                  :company="source.company"
                  :catalog="catalog"
                  label="面试轮次"
                  :disabled="pending"
                />
              </NFormItem>
            </div>
          </section>
        </QuestionFields>
        <footer class="modal-footer">
          <span v-if="dirty">有未保存的修改</span
          ><NButton :disabled="pending" @click="close">取消</NButton
          ><NButton type="primary" attr-type="submit" :loading="pending"
            ><template #icon><Save :size="15" /></template
            >{{ question ? '保存题目' : '添加题目' }}</NButton
          >
        </footer></NForm
      >
    </div>
  </NModal>
  <CompanyCatalogManager v-if="managing" @close="managing = false" />
</template>
