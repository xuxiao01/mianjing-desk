<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NButton, NForm, NFormItem, NInput, NModal, useMessage } from 'naive-ui';
import { X } from 'lucide-vue-next';
import CompanyPicker from '@/shared/components/CompanyPicker.vue';
import CompanyCatalogManager from '@/shared/components/CompanyCatalogManager.vue';
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';
import { companyName } from '@/shared/utils/companyCatalog';
import { useDesk, useDeskActions } from '@/shared/composables/useDesk';
import { useUnsavedChanges } from '@/shared/composables/useUnsavedChanges';
import { quickOccurrenceErrors, quickOccurrenceInput } from './quickOccurrence';

const props = defineProps<{ questionId: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const input = reactive({ company: '', content: '' });
const companyChoice = ref<string | null>(null);
const submitted = ref(false);
const errors = computed(() => quickOccurrenceErrors(input));
const serialize = () => JSON.stringify({ ...input, company: companyChoice.value });
const baseline = ref(serialize());
const dirty = computed(() => serialize() !== baseline.value);
const { data } = useDesk();
const catalog = useCompanyCatalog(data);
const managing = ref(false);
watch([companyChoice, catalog], () => {
  input.company = companyName(catalog.value, companyChoice.value || '');
});
const { experience: mutation } = useDeskActions();
const pending = mutation.isPending;
const { allowLeave } = useUnsavedChanges(() => dirty.value, {
  isPending: () => pending.value,
  onRouteLeave: () => emit('close'),
});
const message = useMessage();
async function close() {
  if (!pending.value && (await allowLeave())) emit('close');
}
async function save() {
  if (pending.value) return;
  submitted.value = true;
  if (Object.keys(errors.value).length) return;
  try {
    await mutation.mutateAsync(quickOccurrenceInput(props.questionId, input));
    baseline.value = serialize();
    emit('saved');
    message.success('已记录一次出现');
  } catch (error) {
    message.error((error as Error).message);
  }
}
</script>

<template>
  <NModal :show="!managing" :mask-closable="false" :close-on-esc="false" @update:show="close">
    <div
      class="modal-surface occurrence-create-modal"
      role="dialog"
      aria-modal="true"
      aria-label="记录一次出现"
    >
      <div class="modal-top">
        <h2>记录一次出现</h2>
        <button class="icon-button" aria-label="关闭出现记录" :disabled="pending" @click="close">
          <X :size="20" />
        </button>
      </div>
      <NForm :disabled="pending" @submit.prevent="save">
        <NFormItem
          label="公司"
          required
          :validation-status="submitted && errors.company ? 'error' : undefined"
          :feedback="submitted ? errors.company : undefined"
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
        <NFormItem
          label="这次问的内容"
          required
          :validation-status="submitted && errors.content ? 'error' : undefined"
          :feedback="submitted ? errors.content : undefined"
        >
          <NInput
            v-model:value="input.content"
            type="textarea"
            :maxlength="200000"
            :autosize="{ minRows: 4, maxRows: 10 }"
            placeholder="记录这家公司实际问了什么，包括变形或追问"
            :input-props="{ 'aria-label': '这次问的内容' }"
          />
        </NFormItem>
        <footer class="modal-footer">
          <NButton :disabled="pending" @click="close">取消</NButton>
          <NButton type="primary" attr-type="submit" :loading="pending">保存记录</NButton>
        </footer>
      </NForm>
    </div>
  </NModal>
  <CompanyCatalogManager v-if="managing" @close="managing = false" />
</template>
