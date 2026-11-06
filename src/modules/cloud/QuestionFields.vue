<script setup lang="ts">
import { ref } from 'vue';
import { NCheckbox, NFormItem, NInput, NSelect } from 'naive-ui';
import { categories, masteries, priorities } from '@/shared/types/domain';
import type { QuestionInput } from './types';
const props = defineProps<{ modelValue: QuestionInput; tags: string; showOrganized?: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [value: QuestionInput];
  'update:tags': [value: string];
  overlay: [open: boolean];
}>();
const titleInput = ref<InstanceType<typeof NInput>>();
function update<K extends keyof QuestionInput>(key: K, value: QuestionInput[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}
const options = <T extends string>(items: readonly T[]) =>
  items.map((value) => ({ label: value, value }));
defineExpose({ focus: () => titleInput.value?.focus() });
</script>
<template>
  <div class="question-fields">
    <NFormItem label="题目 / 标准问法" required>
      <NInput
        ref="titleInput"
        :value="modelValue.title"
        type="textarea"
        :maxlength="10000"
        :autosize="{ minRows: 2, maxRows: 5 }"
        placeholder="例如：Promise.all 中的一个任务失败会怎样？"
        :input-props="{ 'aria-label': '题目 / 标准问法' }"
        @update:value="update('title', $event)"
      />
    </NFormItem>
    <slot />
    <div class="form-grid">
      <NFormItem label="题型"
        ><NSelect
          :value="modelValue.category"
          :options="options(categories)"
          aria-label="题型"
          @update:value="update('category', $event)"
          @update:show="emit('overlay', $event)"
      /></NFormItem>
      <NFormItem label="优先级"
        ><NSelect
          :value="modelValue.priority"
          :options="options(priorities)"
          aria-label="优先级"
          @update:value="update('priority', $event)"
          @update:show="emit('overlay', $event)"
      /></NFormItem>
      <NFormItem label="掌握程度"
        ><NSelect
          :value="modelValue.mastery"
          :options="options(masteries)"
          aria-label="掌握程度"
          @update:value="update('mastery', $event)"
          @update:show="emit('overlay', $event)"
      /></NFormItem>
      <NFormItem label="知识点"
        ><NInput
          :value="tags"
          placeholder="JavaScript, Promise"
          :input-props="{ 'aria-label': '知识点' }"
          @update:value="emit('update:tags', $event)"
      /></NFormItem>
    </div>
    <NCheckbox
      v-if="showOrganized"
      :checked="modelValue.organized"
      @update:checked="update('organized', $event)"
      >已整理</NCheckbox
    >
  </div>
</template>
