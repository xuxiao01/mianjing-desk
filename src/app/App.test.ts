import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import App from './App.vue';
import { router as appRouter } from './router';

vi.mock('@/shared/composables/useDesk', () => ({
  useDesk: () => ({ data: ref(undefined) }),
  deskKey: ['desk', 'snapshot'],
}));

describe('沉浸页面外壳', () => {
  it('直接访问详情无侧栏，普通页面恢复原有导航', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: appRouter.options.routes.map((route) =>
        'redirect' in route && route.redirect
          ? route
          : { path: route.path, meta: route.meta, component: { template: '<div>页面内容</div>' } },
      ),
    });
    await router.push('/reading/q-1?category=八股&pageSize=50');
    const wrapper = mount(App, { global: { plugins: [router] } });
    expect(router.currentRoute.value.meta.immersive).toBe(true);
    expect(wrapper.find('.reading-shell').exists()).toBe(true);
    expect(wrapper.find('aside').exists()).toBe(false);
    expect(wrapper.find('.mobile-topbar').exists()).toBe(false);
    expect(wrapper.text()).toContain('页面内容');
    await router.push('/questions');
    await flushPromises();
    expect(wrapper.find('.reading-shell').exists()).toBe(false);
    expect(wrapper.findAll('nav a').map((item) => item.text())).toEqual(['我的题库', '数据管理']);
    await router.push('/settings');
    await flushPromises();
    expect(wrapper.find('aside').exists()).toBe(true);
    wrapper.unmount();
  });
});
