<script setup lang="ts">
import { useRouter } from 'vue-router';
import { NButton } from 'naive-ui';
import { identity, clearSession } from './session';
const router = useRouter();
async function logout() {
  // Route guards ask about drafts before clearing the active session.
  const failure = await router.push('/login');
  if (!failure) clearSession();
}
</script>
<template>
  <div v-if="identity" class="session-actions">
    <span>{{ identity.role === 'admin' ? '管理员' : '游客 · 只读' }}</span
    ><NButton text size="small" @click="logout">退出</NButton>
  </div>
</template>
<style scoped>
.session-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}
</style>
