<script setup lang="ts">
import { ref } from 'vue';
import { NFormItem, NInput } from 'naive-ui';
import type { CompanyCatalog } from '@/shared/types/domain';
import CompanyPicker from '@/shared/components/CompanyPicker.vue';
const props = defineProps<{
  content: string;
  companyId?: string | null;
  catalog?: CompanyCatalog;
  showCompany?: boolean;
  disabled?: boolean;
  companyError?: string;
  contentError?: string;
}>();
const emit = defineEmits<{
  'update:content': [value: string];
  'update:companyId': [value: string | null];
  manage: [];
}>();
const root = ref<HTMLDivElement>();
const contentInput = ref<InstanceType<typeof NInput>>();
function focus() {
  if (props.showCompany)
    root.value
      ?.querySelector<HTMLElement>('.company-picker input, .company-picker-options button')
      ?.focus();
  else contentInput.value?.focus();
}
defineExpose({
  focus,
  focusManage: () => root.value?.querySelector<HTMLElement>('.company-picker-top button')?.focus(),
});
</script>
<template>
  <div ref="root" class="occurrence-fields">
    <NFormItem
      v-if="showCompany && catalog"
      label="公司"
      required
      :validation-status="companyError ? 'error' : undefined"
      :feedback="companyError"
    >
      <CompanyPicker
        :catalog="catalog"
        :model-value="companyId ? [companyId] : []"
        :disabled="disabled"
        @update:model-value="emit('update:companyId', $event[0] || null)"
        @manage="emit('manage')"
      />
    </NFormItem>
    <NFormItem
      label="这次问的内容"
      :required="showCompany"
      :validation-status="contentError ? 'error' : undefined"
      :feedback="contentError"
    >
      <NInput
        ref="contentInput"
        :value="content"
        :disabled="disabled"
        type="textarea"
        :maxlength="200000"
        :autosize="{ minRows: showCompany ? 4 : 5, maxRows: showCompany ? 10 : 12 }"
        :placeholder="
          showCompany ? '记录这家公司实际问了什么，包括变形或追问' : '实际问法、变形或追问，可留空'
        "
        :input-props="{ 'aria-label': '这次问的内容' }"
        @update:value="emit('update:content', $event)"
      />
    </NFormItem>
  </div>
</template>
