<script setup lang="ts">
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';
import { canonicalCompany } from '@/shared/utils/companyCatalog';
import { companyColorStyle } from '@/shared/utils/companyColors';

const catalog = useCompanyCatalog();
defineProps<{ company: string; recruitmentType?: string; round?: string }>();
</script>

<template>
  <div class="source-badges" :style="companyColorStyle(company, catalog)">
    <span class="source-badge">{{ canonicalCompany(catalog, company) }}</span>
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
.source-badge {
  display: inline-block;
  max-width: 100%;
  padding: 2px 9px;
  border: 1px solid var(--company-border);
  border-radius: 999px;
  background: var(--company-background);
  color: var(--company-color);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  overflow-wrap: anywhere;
}
</style>
