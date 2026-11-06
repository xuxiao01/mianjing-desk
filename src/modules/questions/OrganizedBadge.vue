<script setup lang="ts">
defineProps<{ organized: boolean }>();
</script>
<template>
  <span
    class="organized-badge"
    :class="{ done: organized }"
    :aria-label="organized ? '已整理' : '待整理'"
    >{{ organized ? '是' : '否' }}</span
  >
</template>
<style scoped>
.organized-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  min-width: 32px;
  padding: 3px 10px;
  border-radius: 999px;
  background: #dc2626;
  color: #ffffff;
  font-size: 16px;
  line-height: 22px;
  white-space: nowrap;
}
.organized-badge.done {
  background: #15803d;
}
</style>
