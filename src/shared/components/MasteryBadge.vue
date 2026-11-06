<script setup lang="ts">
import type { Mastery } from '@/shared/types/domain';
defineProps<{ mastery: Mastery }>();
const styles = { 不会: 'weak', 模糊: 'uncertain', 基本掌握: 'known', 熟练: 'fluent' };
</script>
<template>
  <span class="mastery-badge" :class="styles[mastery]">{{ mastery }}</span>
</template>
<style scoped>
.mastery-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
}
.weak {
  background: #fee2e2;
  color: #b91c1c;
}
.uncertain {
  background: #ffedd5;
  color: #9a3412;
}
.known {
  background: #dcfce7;
  color: #166534;
}
.fluent {
  background: #15803d;
  color: #ffffff;
}
</style>
