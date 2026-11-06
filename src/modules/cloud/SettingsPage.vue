<script setup lang="ts">
import { ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { NButton } from 'naive-ui';
import { Settings2 } from 'lucide-vue-next';
import PageHeading from '@/shared/components/PageHeading.vue';
import DataState from '@/shared/components/DataState.vue';
import CompanyCatalogManager from './CompanyCatalogManager.vue';
import { cloud } from './api';
import { useCatalog } from './queries';
const managing = ref(false);
const { data, isPending, error, refetch } = useQuery({
  queryKey: ['mianjing', 'overview'],
  queryFn: ({ signal }) => cloud.list({ pageSize: 10 }, signal),
});
const catalog = useCatalog();
</script>
<template>
  <div>
    <PageHeading title="数据管理" /><DataState
      :loading="isPending || catalog.isPending.value"
      :error="error || catalog.error.value"
      @retry="
        refetch();
        catalog.refetch();
      "
      ><section class="cloud-overview">
        <h2>云端题库</h2>
        <dl>
          <div>
            <dt>题目</dt>
            <dd>{{ data?.total ?? 0 }}</dd>
          </div>
          <div>
            <dt>公司标签</dt>
            <dd>{{ catalog.data.value?.items.length ?? 0 }}</dd>
          </div>
        </dl>
        <p class="muted">数据保存在服务器，游客只能浏览，管理员可以维护。</p>
        <NButton :disabled="!catalog.data.value" @click="managing = true"
          ><template #icon><Settings2 :size="16" /></template>管理公司标签</NButton
        >
      </section></DataState
    ><CompanyCatalogManager v-if="managing" @close="managing = false" />
  </div>
</template>
<style scoped>
.cloud-overview {
  padding: 24px;
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: 8px;
}
.cloud-overview h2 {
  font-size: 18px;
  margin: 0 0 24px;
}
.cloud-overview dl {
  display: flex;
  gap: 64px;
  margin: 0 0 24px;
}
.cloud-overview dt {
  font-size: 14px;
  color: var(--muted);
}
.cloud-overview dd {
  font-size: 28px;
  font-weight: 600;
  margin: 8px 0;
}
.cloud-overview p {
  font-size: 14px;
  margin-bottom: 24px;
}
</style>
