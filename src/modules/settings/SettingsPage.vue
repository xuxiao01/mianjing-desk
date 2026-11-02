<script setup lang="ts">
import { computed, ref } from 'vue';
import { NAlert, NButton, useDialog, useMessage } from 'naive-ui';
import { Download, Upload, RotateCcw } from 'lucide-vue-next';
import { useQueryClient } from '@tanstack/vue-query';
import { dataSource, repository } from '@/shared/api/repository';
import { parseSnapshot } from '@/shared/api/validation';
import { useDesk, deskKey } from '@/shared/composables/useDesk';
import { downloadText } from '@/shared/utils/download';
import { localDay } from '@/shared/utils/dates';
import CompanyCatalogManager from '@/shared/components/CompanyCatalogManager.vue';
import PageHeading from '@/shared/components/PageHeading.vue';
const { data, error } = useDesk();
const managing = ref(false);
const client = useQueryClient(),
  dialog = useDialog(),
  message = useMessage();
const fileInput = ref<HTMLInputElement>(),
  busy = ref(false);
const counts = computed(() =>
  data.value
    ? [
        { title: '题目', n: data.value.questions.length },
        { title: '来源记录', n: data.value.experiences.length },
        { title: '出现明细', n: data.value.occurrences.length },
      ]
    : [],
);
async function exportBackup() {
  if (busy.value) return;
  busy.value = true;
  try {
    downloadText(await repository.exportRaw(), 'mianjing-desk-' + localDay() + '.json');
    message.success('备份已导出');
  } catch (error) {
    message.error((error as Error).message);
  } finally {
    busy.value = false;
  }
}
function confirmAction(title: string, content: string, action: () => Promise<void>) {
  dialog.warning({
    title,
    content,
    positiveText: '确认替换',
    negativeText: '取消',
    maskClosable: false,
    async onPositiveClick() {
      busy.value = true;
      try {
        await action();
        await client.invalidateQueries({ queryKey: deskKey });
        message.success('演示数据已更新');
      } catch (error) {
        message.error((error as Error).message);
        return false;
      } finally {
        busy.value = false;
      }
    },
  });
}
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file || busy.value) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('备份文件不能超过 10MB');
    const backup = parseSnapshot(JSON.parse(await file.text()));
    confirmAction(
      '用备份替换当前演示数据？',
      '已校验：' +
        backup.questions.length +
        ' 道题、' +
        backup.occurrences.length +
        ' 条出现明细，包含历史兼容数据。当前内容将被替换，建议先导出备份。',
      () => repository.restore(backup),
    );
  } catch (error) {
    message.error('无法导入：' + (error as Error).message);
  } finally {
    input.value = '';
  }
}
function reset() {
  confirmAction(
    '恢复初始演示数据？',
    '这会替换当前浏览器中的全部题目、来源明细、公司配置及历史数据。请先导出需要保留的内容。',
    () => repository.reset(),
  );
}
</script>
<template>
  <PageHeading title="数据管理" />
  <NAlert v-if="error" class="settings-alert" title="原始数据仍然保留" type="error"
    >{{ error.message }} 你可以先导出原始数据，再选择恢复或重置。</NAlert
  >
  <NAlert v-if="dataSource === 'api'" class="settings-alert" title="当前是 API 模式" type="info"
    >题库通过真实接口加载。备份替换和重置只适用于演示模式；后端接口尚未实现时会明确报错。</NAlert
  >
  <section class="settings-card">
    <h2>数据概况</h2>
    <p class="settings-source">
      数据来源：{{ dataSource === 'mock' ? '当前浏览器' : 'xuxiao-api' }}
    </p>
    <div v-if="counts.length" class="data-counts">
      <div v-for="item in counts" :key="item.title">
        <strong>{{ item.n }}</strong
        ><span>{{ item.title }}</span>
      </div>
    </div>
    <p v-if="dataSource === 'mock'" class="settings-note">
      数据仅保存在当前浏览器，不会同步到服务器；清除浏览器数据前请导出备份。
    </p>
  </section>
  <section class="settings-card">
    <h2>公司标签</h2>
    <div class="setting-action">
      <div>
        <strong>全站公司标签库</strong>
        <p>统一配置公司名称、颜色、顺序和启用状态。</p>
      </div>
      <NButton :disabled="!data || busy" @click="managing = true">管理公司标签</NButton>
    </div>
  </section>
  <section class="settings-card">
    <h2>备份与恢复</h2>
    <div class="setting-action">
      <div>
        <strong>导出完整 JSON 备份</strong>
        <p>包含题库、来源明细、公司标签配置及历史兼容数据。</p>
      </div>
      <NButton :loading="busy" @click="exportBackup"
        ><template #icon><Download :size="16" /></template>导出备份</NButton
      >
    </div>
    <div class="setting-action">
      <div>
        <strong>从备份恢复</strong>
        <p>校验备份后替换当前数据，建议先导出备份。</p>
      </div>
      <NButton :disabled="busy || dataSource !== 'mock'" @click="fileInput?.click()"
        ><template #icon><Upload :size="16" /></template>导入备份</NButton
      ><input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        hidden
        @change="importFile"
      />
    </div>
    <div class="setting-action">
      <div>
        <strong>重置演示数据</strong>
        <p>将替换当前浏览器的数据，请先导出备份。</p>
      </div>
      <NButton :disabled="busy || dataSource !== 'mock'" @click="reset"
        ><template #icon><RotateCcw :size="15" /></template>重置演示</NButton
      >
    </div>
  </section>
  <CompanyCatalogManager v-if="managing" @close="managing = false" />
</template>
