<script setup lang="ts">
defineProps<{ title: string }>();
</script>
<template>
  <section class="page-heading">
    <h1>{{ title }}</h1>
    <div v-if="$slots.default" class="heading-actions"><slot /></div>
  </section>
</template>
