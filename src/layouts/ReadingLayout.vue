<template>
  <main class="reading-shell"><RouterView /></main>
</template>

<style scoped>
.reading-shell {
  min-height: 100vh;
  padding: 24px 28px;
}
@media (max-width: 760px) {
  .reading-shell {
    padding: 20px 16px;
  }
}
</style>
