import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { mount, flushPromises } from '@vue/test-utils';
import { router as appRouter } from './router';
import DeskLayout from '@/layouts/DeskLayout.vue';

function makeRouter(base = '/') {
  return createRouter({
    history: createMemoryHistory(base),
    routes: appRouter.options.routes.map((record) =>
      'redirect' in record && record.redirect
        ? record
        : { path: record.path, meta: record.meta, component: { render: () => null } },
    ),
  });
}
describe('精简导航与旧链接兼容', () => {
  it('子路径导航和品牌图标不会跳出应用前缀', async () => {
    vi.stubEnv('BASE_URL', '/mianjing/');
    const router = makeRouter('/mianjing/');
    await router.push('/questions');
    const wrapper = mount(DeskLayout, {
      global: { plugins: [router], stubs: { RouterView: true } },
    });
    try {
      expect(wrapper.find('.brand img').attributes('src')).toBe('/mianjing/favicon.svg?v=teal');
      expect(wrapper.findAll('nav a').map((link) => link.attributes('href'))).toEqual([
        '/mianjing/questions',
        '/mianjing/settings',
      ]);
      await wrapper.find('nav a[href="/mianjing/settings"]').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.path).toBe('/settings');
    } finally {
      wrapper.unmount();
      vi.unstubAllEnvs();
    }
  });
  it.each(['/experiences?questionId=q-1', '/reviews#history'])(
    '旧地址 %s 返回干净题库地址',
    async (path) => {
      const router = makeRouter();
      await router.push(path);
      expect(router.currentRoute.value.fullPath).toBe('/questions');
      expect(router.currentRoute.value.matched.at(-1)?.meta.title).toBe('我的题库');
    },
  );
  it('导航只保留题库和数据管理，窄屏菜单仍可打开并在切换后关闭', async () => {
    const router = makeRouter();
    await router.push('/questions');
    const wrapper = mount(DeskLayout, {
      global: { plugins: [router], stubs: { RouterView: true } },
    });
    expect(wrapper.findAll('nav a').map((link) => link.text())).toEqual(['我的题库', '数据管理']);
    expect(wrapper.text()).not.toMatch(/面经记录|今日复习/);
    await wrapper.find('[aria-label="打开导航"]').trigger('click');
    expect(wrapper.find('aside').classes()).toContain('is-open');
    await wrapper.find('nav a[href="/settings"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/settings');
    expect(wrapper.find('aside').classes()).not.toContain('is-open');
    wrapper.unmount();
  });
});
