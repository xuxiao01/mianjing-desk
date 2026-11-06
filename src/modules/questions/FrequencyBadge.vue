<script setup lang="ts">
import { frequencyBand } from './frequency';
defineProps<{ count: number }>();
</script>
<template>
  <span class="frequency-badge" :class="frequencyBand(count)" :aria-label="`出现 ${count} 次`">{{
    count
  }}</span>
</template>
<style scoped>
.frequency-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 18px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 24px;
  white-space: nowrap;
}
.none {
  background: #efeff1;
  color: #52525b;
}
.low {
  background: #e0f2fe;
  color: #075985;
}
.medium {
  background: #fef3c7;
  color: #92400e;
}
.high {
  background: #c2410c;
  color: #ffffff;
}
</style>
