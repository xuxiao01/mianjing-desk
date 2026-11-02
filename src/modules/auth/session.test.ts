import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import {
  login,
  identity,
  canEdit,
  clearSession,
  TOKEN_KEY,
  checkSession,
  syncSession,
  safeReturn,
  onSessionLost,
  forcedExit,
} from './session';
import { installAuthGuards } from './guards';
import { request } from '@/shared/api/http';
import { queryClient } from '@/app/query-client';
const guest = { role: 'guest', user: null, isAdmin: false, canEdit: false };
const admin = {
  role: 'admin',
  user: { id: 2, email: 'admin@example.test', username: '管理员' },
  isAdmin: true,
  canEdit: true,
};
const reply = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(status === 200 ? { success: true, data } : { success: false, message: data }),
    { status },
  );
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  clearSession();
  localStorage.setItem('mianjing-desk.snapshot', 'original');
  fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  clearSession();
  onSessionLost(() => {});
  vi.unstubAllGlobals();
});
describe('面经会话与权限', () => {
  it('游客与管理员均经 me 验证后保存独立 Token，不存密码', async () => {
    fetcher
      .mockResolvedValueOnce(reply({ token: 'guest-token' }))
      .mockResolvedValueOnce(reply(guest));
    await login();
    expect(canEdit.value).toBe(false);
    expect(identity.value?.user).toBeNull();
    expect(fetcher.mock.calls[0]![0]).toBe('/api/mianjing/auth/guest');
    fetcher
      .mockResolvedValueOnce(reply({ token: 'admin-token' }))
      .mockResolvedValueOnce(reply(admin));
    await login(' admin@example.test ', 'test-only');
    expect(canEdit.value).toBe(true);
    expect(identity.value?.user?.id).toBe(2);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('admin-token');
    expect(JSON.stringify(localStorage)).not.toContain('test-only');
    expect(localStorage.getItem('mianjing-desk.snapshot')).toBe('original');
  });
  it('错误密码或其他产品账号不保存 Token、不提供演示回退', async () => {
    fetcher.mockResolvedValueOnce(reply('邮箱或密码错误', 401));
    await expect(login('other@example.test', 'wrong')).rejects.toThrow('邮箱或密码错误');
    fetcher
      .mockResolvedValueOnce(reply({ token: 'other-token' }))
      .mockResolvedValueOnce(reply('未开放权限', 403));
    await expect(login('other@example.test', 'test-only')).rejects.toThrow('未开放权限');
    expect(identity.value).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
  it('401 清理会话和请求缓存；旧请求的 401 不退出新会话', async () => {
    fetcher
      .mockResolvedValueOnce(reply({ token: 'old-token' }))
      .mockResolvedValueOnce(reply(guest));
    await login();
    fetcher
      .mockResolvedValueOnce(reply({ token: 'new-token' }))
      .mockResolvedValueOnce(reply(admin));
    await login('admin@example.test', 'test-only');
    queryClient.setQueryData(['mianjing', 'test'], { secret: true });
    const lost = vi.fn();
    onSessionLost(lost);
    fetcher.mockResolvedValueOnce(reply('过期', 401));
    await expect(
      request('/mianjing/questions', { headers: { Authorization: 'Bearer old-token' } }),
    ).rejects.toThrow();
    expect(canEdit.value).toBe(true);
    fetcher.mockResolvedValueOnce(reply('过期', 401));
    await expect(request('/mianjing/questions')).rejects.toThrow();
    expect(identity.value).toBeNull();
    expect(queryClient.getQueryData(['mianjing', 'test'])).toBeUndefined();
    expect(lost).toHaveBeenCalledOnce();
    expect(forcedExit.value).toBe(true);
  });
  it('新标签页 Token 重新校验；退出跨标签页同步，保留旧本地业务数据', async () => {
    localStorage.setItem(TOKEN_KEY, 'shared-token');
    fetcher.mockResolvedValueOnce(reply(guest));
    syncSession(new StorageEvent('storage', { key: TOKEN_KEY }));
    await checkSession();
    expect(identity.value?.role).toBe('guest');
    localStorage.removeItem(TOKEN_KEY);
    syncSession(new StorageEvent('storage', { key: TOKEN_KEY }));
    expect(identity.value).toBeNull();
    expect(localStorage.getItem('mianjing-desk.snapshot')).toBe('original');
  });
  it('未登录直达保留查询条件，游客禁止数据管理，刷新校验失败返回登录', async () => {
    const view = { render: () => null };
    const router = createRouter({
      history: createMemoryHistory('/mianjing/'),
      routes: [
        { path: '/login', component: view, meta: { public: true } },
        { path: '/reading/:id?', component: view },
        { path: '/questions', component: view },
        { path: '/settings', component: view, meta: { admin: true } },
      ],
    });
    installAuthGuards(router);
    await router.push('/reading/q-1?search=并发&pageSize=50');
    expect(router.currentRoute.value.path).toBe('/login');
    expect(router.currentRoute.value.query.returnTo).toBe('/reading/q-1?search=并发&pageSize=50');
    fetcher
      .mockResolvedValueOnce(reply({ token: 'guest-token' }))
      .mockResolvedValueOnce(reply(guest));
    await login();
    await router.push('/settings');
    expect(router.currentRoute.value.path).toBe('/questions');
  });
  it.each([
    'https://example.com',
    '//example.com',
    '/login',
    '/questions\\evil',
    '/settings/../../login',
    '/other',
  ])('返回地址拒绝越界：%s', (value) => {
    expect(safeReturn(value)).toBe('/questions');
  });
  it('返回地址保留题目路径和查询参数', () => {
    expect(safeReturn('/reading/q-1?search=%E5%B9%B6%E5%8F%91&pageSize=50')).toBe(
      '/reading/q-1?search=%E5%B9%B6%E5%8F%91&pageSize=50',
    );
  });
});
