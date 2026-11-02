import { computed, ref } from 'vue';
import { request, setAuthentication } from '@/shared/api/http';
import { queryClient } from '@/app/query-client';
import type { Identity } from '@/modules/cloud/types';
export const TOKEN_KEY = 'mianjing.auth.token';
const token = ref(localStorage.getItem(TOKEN_KEY) || '');
export const identity = ref<Identity | null>(null);
export const canEdit = computed(() => identity.value?.canEdit === true);
export const forcedExit = ref(false);
let checkedToken = '';
let validation: { token: string; promise: Promise<void> } | undefined;
let redirect: () => void = () => {};
export function onSessionLost(callback: () => void) {
  redirect = callback;
}
export function clearSession(forced = false) {
  forcedExit.value = forced;
  token.value = '';
  identity.value = null;
  checkedToken = '';
  localStorage.removeItem(TOKEN_KEY);
  queryClient.clear();
}
setAuthentication(
  () => token.value,
  (failedToken) => {
    if (failedToken && failedToken === token.value) {
      clearSession(true);
      redirect();
    }
  },
);
export async function checkSession() {
  if (!token.value || checkedToken === token.value) return;
  if (validation?.token === token.value) return validation.promise;
  const checking = token.value;
  const promise = (async () => {
    try {
      const result = await request<Identity>('/mianjing/me', {
        headers: { Authorization: 'Bearer ' + checking },
      });
      if (checking === token.value) {
        identity.value = result;
        checkedToken = checking;
        forcedExit.value = false;
      }
    } catch (error) {
      if (checking === token.value) clearSession(true);
      throw error;
    } finally {
      if (validation?.token === checking) validation = undefined;
    }
  })();
  validation = { token: checking, promise };
  return promise;
}
export async function login(email?: string, password?: string) {
  const result = await request<{ token: string }>(
    email === undefined ? '/mianjing/auth/guest' : '/auth/login',
    {
      method: 'POST',
      headers: { Authorization: '' },
      body: JSON.stringify(email === undefined ? {} : { email: email.trim(), password }),
    },
  );
  // Validate before persistence. Other product accounts never become Mianjing sessions.
  const me = await request<Identity>('/mianjing/me', {
    headers: { Authorization: 'Bearer ' + result.token },
  });
  queryClient.clear();
  token.value = result.token;
  identity.value = me;
  checkedToken = result.token;
  forcedExit.value = false;
  localStorage.setItem(TOKEN_KEY, result.token);
}
export function syncSession(event: StorageEvent) {
  if (event.key !== TOKEN_KEY && event.key !== null) return;
  const next = localStorage.getItem(TOKEN_KEY) || '';
  if (next === token.value) return;
  queryClient.clear();
  token.value = next;
  identity.value = null;
  checkedToken = '';
  forcedExit.value = true;
  if (!next) redirect();
  else
    void checkSession()
      .then(() => {
        forcedExit.value = true;
        redirect();
      })
      .catch(redirect);
}
export function safeReturn(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\/(?:(?:questions|reading)(?:\/[a-zA-Z0-9-]+)?|settings)(?:\?[^#\\]*)?(?:#.*)?$/.test(
      value,
    ) ||
    /[\r\n]/.test(value)
  )
    return '/questions';
  return value;
}
