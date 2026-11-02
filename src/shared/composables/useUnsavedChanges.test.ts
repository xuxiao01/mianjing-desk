import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import type { App } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import type { Router } from 'vue-router';
import { useUnsavedChanges } from './useUnsavedChanges';

const warning =
  vi.fn<(options: { onPositiveClick: () => void; onNegativeClick: () => void }) => void>();
vi.mock('naive-ui', () => ({ useDialog: () => ({ warning }) }));
const dirty = ref(false),
  pending = ref(false),
  onRouteLeave = vi.fn();
let app: App, router: Router, host: HTMLDivElement;
beforeEach(async () => {
  dirty.value = false;
  pending.value = false;
  warning.mockClear();
  onRouteLeave.mockClear();
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/questions/:id?',
        component: {
          setup() {
            useUnsavedChanges(() => dirty.value, { isPending: () => pending.value, onRouteLeave });
            return () => h('div', '详情');
          },
        },
      },
      { path: '/other', component: { render: () => h('div', '其他页面') } },
    ],
  });
  await router.push('/questions/q-1');
  host = document.createElement('div');
  document.body.append(host);
  app = createApp({ render: () => h(RouterView) });
  app.use(router);
  app.mount(host);
  await router.isReady();
  await nextTick();
});
afterEach(() => {
  app.unmount();
  host.remove();
});
describe('编辑未保存保护', () => {
  it('同一路由切换题目时也确认，取消保留当前位置，放弃后关闭编辑状态', async () => {
    dirty.value = true;
    const canceled = router.push('/questions/q-2');
    await vi.waitFor(() => expect(warning).toHaveBeenCalledOnce());
    warning.mock.calls[0]![0].onNegativeClick();
    await canceled;
    expect(router.currentRoute.value.params.id).toBe('q-1');
    expect(onRouteLeave).not.toHaveBeenCalled();
    const accepted = router.push('/questions/q-2');
    await vi.waitFor(() => expect(warning).toHaveBeenCalledTimes(2));
    warning.mock.calls[1]![0].onPositiveClick();
    await accepted;
    expect(router.currentRoute.value.params.id).toBe('q-2');
    expect(onRouteLeave).toHaveBeenCalledOnce();
  });
  it('提交中阻止路由切换，未修改时直接离开', async () => {
    pending.value = true;
    await router.push('/other');
    expect(router.currentRoute.value.path).toBe('/questions/q-1');
    expect(warning).not.toHaveBeenCalled();
    pending.value = false;
    await router.push('/other');
    expect(router.currentRoute.value.path).toBe('/other');
    expect(onRouteLeave).toHaveBeenCalledOnce();
  });
  it('离开页面和刷新分别提供修改确认', async () => {
    dirty.value = true;
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const navigation = router.push('/other');
    await vi.waitFor(() => expect(warning).toHaveBeenCalledOnce());
    warning.mock.calls[0]![0].onPositiveClick();
    await navigation;
    expect(router.currentRoute.value.path).toBe('/other');
    expect(onRouteLeave).toHaveBeenCalledOnce();
  });
});
