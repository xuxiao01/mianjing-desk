<script setup lang="ts">
import { computed, ref } from 'vue';
import { NModal, NButton, NForm, NFormItem, NInput, useMessage } from 'naive-ui';
import { X } from 'lucide-vue-next';
import type { Occurrence } from './types';
import SourceBadges from '@/shared/components/SourceBadges.vue';
import { useUnsavedChanges } from '@/shared/composables/useUnsavedChanges';
import { cloud } from './api';
import { useRefresh } from './queries';
const props = defineProps<{ occurrence: Occurrence }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const content = ref(props.occurrence.content),
  baseline = ref(content.value),
  pending = ref(false);
const refresh = useRefresh(),
  message = useMessage();
const dirty = computed(() => content.value !== baseline.value);
const { allowLeave } = useUnsavedChanges(() => dirty.value, {
  isPending: () => pending.value,
  onRouteLeave: () => emit('close'),
});
async function close() {
  if (!pending.value && (await allowLeave())) emit('close');
}
async function save() {
  if (pending.value) return;
  pending.value = true;
  try {
    await cloud.wording(props.occurrence.id, content.value);
    await refresh();
    baseline.value = content.value;
    emit('saved');
    message.success('问法已保存');
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <NModal :show="true" :mask-closable="false" :close-on-esc="false" @update:show="close"
    ><div
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
        :company="occurrence.company.name"
        :recruitment-type="occurrence.recruitmentType || undefined"
        :round="occurrence.round || undefined"
      />
      <p class="muted">记录于 {{ new Date(occurrence.createdAt).toLocaleString('zh-CN') }}</p>
      <NForm :disabled="pending" @submit.prevent="save"
        ><NFormItem label="这次问的内容"
          ><NInput
            v-model:value="content"
            type="textarea"
            :maxlength="200000"
            :autosize="{ minRows: 5, maxRows: 12 }"
            placeholder="实际问法、变形或追问，可留空"
            :input-props="{ 'aria-label': '这次问的内容' }"
        /></NFormItem>
        <footer class="modal-footer">
          <NButton :disabled="pending" @click="close">取消</NButton
          ><NButton type="primary" attr-type="submit" :loading="pending">保存问法</NButton>
        </footer></NForm
      >
    </div></NModal
  >
</template>
