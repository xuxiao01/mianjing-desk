<script setup lang="ts">
import type { Mastery } from '@/shared/types/domain';
defineProps<{ mastery: Mastery }>();
const styles = { 不会: 'weak', 模糊: 'uncertain', 基本掌握: 'known', 熟练: 'fluent' };
</script>
<template>
  <span class="mastery-badge" :class="styles[mastery]"
    ><i aria-hidden="true"></i>{{ mastery }}</span
  >
</template>
