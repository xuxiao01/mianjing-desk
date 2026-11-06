<script setup lang="ts">
import { computed } from 'vue';
import type { CompanyCatalog, CompanyPaletteKey } from '@/shared/types/domain';
import { useCompanyCatalog } from '@/shared/composables/useCompanyCatalog';
import { companyDotStyle, dotStyle, paletteTone } from '@/shared/utils/companyColors';

const props = defineProps<{
  name: string;
  catalog?: CompanyCatalog;
  palette?: CompanyPaletteKey;
}>();
const inherited = useCompanyCatalog();
const style = computed(() =>
  props.palette
    ? dotStyle(paletteTone(props.palette))
    : companyDotStyle(props.name, props.catalog || inherited.value),
);
</script>

<template>
  <span class="company-label" :style="style" :title="name">
    <i class="company-color-dot" aria-hidden="true"></i
    ><span class="company-label-name">{{ name }}</span>
  </span>
</template>

<style scoped>
.company-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  max-width: 100%;
  color: var(--text);
  font-size: inherit;
  font-weight: 400;
  line-height: inherit;
  vertical-align: middle;
}
.company-color-dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid var(--company-dot-border);
  background: var(--company-dot);
}
.company-label-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
