<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { NModal, NButton, NForm, NFormItem, NInput, useMessage } from 'naive-ui';
import { X, Save } from 'lucide-vue-next';
import type { Experience, QuestionOccurrence } from '@/shared/types/domain';
import SourceBadges from '@/shared/components/SourceBadges.vue';
import { useDeskActions } from '@/shared/composables/useDesk';
import { useUnsavedChanges } from '@/shared/composables/useUnsavedChanges';

const props = defineProps<{ occurrence: QuestionOccurrence; experience: Experience }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const input = reactive({
  wording: props.occurrence.wording,
  followups: props.occurrence.followups,
});
const serialize = () => JSON.stringify(input);
const baseline = ref(serialize());
const dirty = computed(() => serialize() !== baseline.value);
const { occurrence: mutation } = useDeskActions();
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
  try {
    await mutation.mutateAsync({ id: props.occurrence.id, input: { ...input } });
    baseline.value = serialize();
    emit('saved');
    message.success('这次问法已保存');
  } catch (error) {
    message.error((error as Error).message);
  }
}
</script>

<template>
  <NModal :show="true" :mask-closable="false" :close-on-esc="false" @update:show="close">
    <div
      class="modal-surface occurrence-edit-modal"
      role="dialog"
      aria-modal="true"
      aria-label="编辑问法"
    >
      <div class="modal-top">
        <h2>编辑问法</h2>
        <button class="icon-button" aria-label="关闭问法编辑" :disabled="pending" @click="close">
          <X :size="20" />
        </button>
      </div>
      <SourceBadges
        :company="experience.company"
        :recruitment-type="experience.recruitmentType"
        :round="experience.round"
      />
      <NForm :disabled="pending" @submit.prevent="save">
        <NFormItem label="这一次的实际问法 / 变形">
          <NInput
            v-model:value="input.wording"
            type="textarea"
            :maxlength="200000"
            :autosize="{ minRows: 3, maxRows: 8 }"
            placeholder="记录这家公司实际怎么问的，可留空"
            :input-props="{ 'aria-label': '这一次的实际问法 / 变形' }"
          />
        </NFormItem>
        <NFormItem label="追问">
          <NInput
            v-model:value="input.followups"
            type="textarea"
            :maxlength="200000"
            :autosize="{ minRows: 2, maxRows: 6 }"
            placeholder="记录追加的问题，可留空"
            :input-props="{ 'aria-label': '追问' }"
          />
        </NFormItem>
        <footer class="modal-footer">
          <span v-if="dirty">有未保存的修改</span>
          <NButton :disabled="pending" @click="close">取消</NButton>
          <NButton type="primary" attr-type="submit" :loading="pending"
            ><template #icon><Save :size="15" /></template>保存问法</NButton
          >
        </footer>
      </NForm>
    </div>
  </NModal>
</template>
