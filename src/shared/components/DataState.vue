<script setup lang="ts">
import { NAlert, NButton, NSkeleton } from 'naive-ui';
defineProps<{ loading: boolean; error: Error | null }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div v-if="loading" class="loading-block" aria-label="正在加载">
    <NSkeleton text :repeat="4" /><NSkeleton height="160px" />
  </div>
  <NAlert v-else-if="error" title="暂时无法加载数据" type="error"
    ><p>{{ error.message }}</p>
    <NButton size="small" @click="$emit('retry')">重试</NButton></NAlert
  >
  <slot v-else />
</template>
