<script setup lang="ts">
import { computed } from 'vue';
import { splitHighlightText } from '@/shared/utils/searchHighlight';

const props = defineProps<{ text: string; query: string | readonly string[] }>();
const parts = computed(() => splitHighlightText(props.text, props.query));
</script>

<template>
  <span class="search-highlight"
    ><template v-for="(part, index) in parts" :key="index"
      ><mark v-if="part.highlighted">{{ part.text }}</mark
      ><template v-else>{{ part.text }}</template></template
    ></span
  >
</template>

<style scoped>
.search-highlight mark {
  background: #fff2b3;
  color: inherit;
  font: inherit;
  line-height: inherit;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 2px;
}
</style>
