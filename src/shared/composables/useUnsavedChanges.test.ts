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
  routeDirty = ref<boolean | undefined>(undefined),
  onRouteLeave = vi.fn();
let app: App, router: Router, host: HTMLDivElement;
let allowLeave: () => Promise<boolean>;
beforeEach(async () => {
  dirty.value = false;
  routeDirty.value = undefined;
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
            ({ allowLeave } = useUnsavedChanges(() => dirty.value, {
              isPending: () => pending.value,
              onRouteLeave,
              routeDirty: () => routeDirty.value ?? dirty.value,
            }));
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
  it('嵌套管理的关闭只检查自身，路由和刷新保护包含外部草稿', async () => {
    routeDirty.value = true;
    expect(await allowLeave()).toBe(true);
    expect(warning).not.toHaveBeenCalled();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    const navigation = router.push('/other');
    await vi.waitFor(() => expect(warning).toHaveBeenCalledOnce());
    warning.mock.calls[0]![0].onNegativeClick();
    await navigation;
    expect(router.currentRoute.value.params.id).toBe('q-1');
  });
  it('快速重复关闭共用同一份确认，不叠加提示', async () => {
    dirty.value = true;
    const first = allowLeave(),
      second = allowLeave();
    expect(first).toBe(second);
    expect(warning).toHaveBeenCalledOnce();
    warning.mock.calls[0]![0].onNegativeClick();
    expect(await first).toBe(false);
    expect(await second).toBe(false);
  });

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
