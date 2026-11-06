<script setup lang="ts">
import { computed } from 'vue';
import type { CompanyCatalog, CompanyPaletteKey } from '@/shared/types/domain';
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';
import { companyTone, toneStyle, paletteTone } from '@/shared/utils/companyColors';

const props = defineProps<{
  name: string;
  catalog?: CompanyCatalog;
  palette?: CompanyPaletteKey;
  bare?: boolean;
}>();
const inherited = useCompanyCatalog();
const style = computed(() =>
  props.palette
    ? toneStyle(paletteTone(props.palette))
    : toneStyle(companyTone(props.name, props.catalog || inherited.value)),
);
</script>

<template>
  <span class="company-label" :class="{ bare }" :style="style" :title="name">
    <span class="company-label-name">{{ name }}</span>
  </span>
</template>

<style scoped>
.company-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 9px;
  border: 1px solid var(--company-border);
  border-radius: 999px;
  background: var(--company-background);
  min-width: 0;
  max-width: 100%;
  color: var(--company-color);
  font-size: inherit;
  font-weight: 500;
  line-height: inherit;
  vertical-align: middle;
}
.company-label.bare {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
}
.company-label-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
