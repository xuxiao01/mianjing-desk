<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NInput, NButton, NForm, NFormItem } from 'naive-ui';
import { login, safeReturn } from './session';
const route = useRoute(),
  router = useRouter();
const email = ref(''),
  password = ref(''),
  pending = ref(false),
  error = ref('');
async function enter(guest = false) {
  if (pending.value) return;
  error.value = '';
  if (!guest && (!email.value.trim() || !password.value)) {
    error.value = '请填写邮箱和密码';
    return;
  }
  pending.value = true;
  try {
    await login(guest ? undefined : email.value, guest ? undefined : password.value);
    password.value = '';
    await router.replace(safeReturn(route.query.returnTo));
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <main class="login-page">
    <section class="login-card">
      <img
        :src="`${$router.options.history.base.replace(/\/$/, '')}/favicon.svg`"
        width="40"
        height="40"
        alt=""
      />
      <h1>面经台</h1>
      <p class="muted">登录管理题库，或以游客身份浏览</p>
      <NForm :disabled="pending" @submit.prevent="enter()">
        <NFormItem label="邮箱"
          ><NInput
            v-model:value="email"
            placeholder="请输入邮箱"
            :input-props="{ type: 'email', autocomplete: 'username', 'aria-label': '邮箱' }"
        /></NFormItem>
        <NFormItem label="密码"
          ><NInput
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="请输入密码"
            :input-props="{ autocomplete: 'current-password', 'aria-label': '密码' }"
        /></NFormItem>
        <p v-if="error" class="login-error" role="alert">{{ error }}</p>
        <NButton block type="primary" attr-type="submit" size="large" :loading="pending"
          >登录</NButton
        >
        <NButton block size="large" :disabled="pending" class="guest-entry" @click="enter(true)"
          >游客进入</NButton
        >
      </NForm>
    </section>
  </main>
</template>
<style scoped>
.login-page {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  box-sizing: border-box;
}
.login-card {
  width: 100%;
  max-width: 420px;
  box-sizing: border-box;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 32px;
}
.login-card h1 {
  font-size: 26px;
  margin: 16px 0 8px;
}
.login-card p {
  font-size: 14px;
  line-height: 22px;
  margin-bottom: 24px;
}
.guest-entry {
  margin-top: 12px;
}
.login-card .login-error {
  color: var(--danger);
  margin: 0 0 16px;
}
</style>
