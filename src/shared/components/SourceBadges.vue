<script setup lang="ts">
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';
import { canonicalCompany } from '@/shared/utils/companyCatalog';
import CompanyLabel from './CompanyLabel.vue';

const catalog = useCompanyCatalog();
defineProps<{ company: string; recruitmentType?: string; round?: string }>();
</script>

<template>
  <div class="source-badges">
    <CompanyLabel class="source-company" :name="canonicalCompany(catalog, company)" />
    <span v-if="recruitmentType" class="source-badge">{{ recruitmentType }}</span>
    <span v-if="round" class="source-badge">{{ round }}</span>
  </div>
</template>

<style scoped>
.source-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.source-company {
  font-size: 12px;
  line-height: 20px;
  margin-right: 2px;
}
.source-badge {
  display: inline-block;
  max-width: 100%;
  padding: 2px 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  overflow-wrap: anywhere;
}
</style>
