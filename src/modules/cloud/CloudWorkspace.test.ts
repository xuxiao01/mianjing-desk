import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { computed, h, nextTick } from 'vue';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createRouter, createMemoryHistory, RouterView, type Router } from 'vue-router';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { NDialogProvider, NMessageProvider } from 'naive-ui';
import QuestionsPage from './QuestionsPage.vue';
import { cloud } from './api';
import { identity } from '@/modules/auth/session';
import { companyCatalogKey } from '@/shared/composables/useCompanyCatalog';
import type { Question, Occurrence } from './types';
vi.mock('./api', () => ({
  cloud: {
    list: vi.fn(),
    detail: vi.fn(),
    meta: vi.fn(),
    record: vi.fn(),
    wording: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
    deleteQuestion: vi.fn(),
    deleteOccurrence: vi.fn(),
  },
}));
const company = {
  id: '00000000-0000-4000-8000-000000000001',
  name: '腾讯',
  palette: 'blue' as const,
  enabled: true,
  sortOrder: 0,
};
let q: Question, o: Occurrence, router: Router, wrapper: VueWrapper, client: QueryClient;
const settle = async () => {
  await flushPromises();
  await nextTick();
};
const button = (name: string) =>
  [
    ...[...document.querySelectorAll('[role="dialog"]')]
      .reverse()
      .flatMap((d) => [...d.querySelectorAll<HTMLButtonElement>('button')]),
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find((b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name)!;
async function click(name: string) {
  expect(button(name), 'button ' + name).toBeTruthy();
  button(name).click();
  await settle();
}
async function input(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
  q = {
    id: '00000000-0000-4000-8000-000000000002',
    title: '实现并发调度器',
    category: '手撕',
    tags: ['Promise', '并发控制'],
    companyIds: [company.id],
    companies: [company],
    priority: '高',
    mastery: '不会',
    organized: false,
    baseCount: 2,
    recordCount: 1,
    totalCount: 3,
    createdAt: '2026-11-02T00:00:00Z',
    updatedAt: '2026-11-02T00:00:00Z',
  };
  o = {
    id: '00000000-0000-4000-8000-000000000003',
    questionId: q.id,
    companyId: company.id,
    company,
    content: '原始问法\n追问',
    createdAt: q.createdAt,
    recruitmentType: null,
    round: null,
  };
  vi.mocked(cloud.list).mockImplementation(async () => ({
    items: [q],
    total: 1,
    page: 1,
    pageSize: 20,
    usedCompanyIds: [company.id],
  }));
  vi.mocked(cloud.detail).mockImplementation(async () => ({ question: q, occurrences: [o] }));
  vi.mocked(cloud.meta).mockImplementation(async (_id, patch) => {
    Object.assign(q, patch);
    return q;
  });
  identity.value = {
    role: 'admin',
    user: { id: 2, email: 'admin@example.test', username: '管理员' },
    isAdmin: true,
    canEdit: true,
  };
  router = createRouter({
    history: createMemoryHistory('/mianjing/'),
    routes: [
      { path: '/questions/:id?', component: QuestionsPage },
      { path: '/reading/:id?', component: QuestionsPage, meta: { immersive: true } },
      { path: '/login', component: { render: () => null } },
    ],
  });
  await router.push('/questions?search=并发&pageSize=20');
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  wrapper = mount(NDialogProvider, {
    attachTo: document.body,
    slots: { default: () => h(NMessageProvider, null, { default: () => h(RouterView) }) },
    global: {
      plugins: [router, [VueQueryPlugin, { queryClient: client }]],
      provide: {
        [companyCatalogKey as symbol]: computed(() => ({
          revision: 0,
          items: [{ ...company, aliases: [] }],
        })),
      },
    },
  });
  await settle();
});
afterEach(() => {
  wrapper.unmount();
  client.clear();
  identity.value = null;
  vi.unstubAllGlobals();
});
describe('云端题库界面', () => {
  it('服务端查询、标题高亮、详情返回与站内查询保持', async () => {
    expect(cloud.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: '并发', pageSize: 20 }),
      expect.anything(),
    );
    expect(wrapper.find('mark').text()).toBe('并发');
    expect(wrapper.find('.question-link').attributes('aria-label')).toBe(q.title);
    expect(wrapper.find('.reading-link').attributes('href')).toContain('/mianjing/reading?search=');
    await click(q.title);
    expect(router.currentRoute.value.params.id).toBe(q.id);
    expect(cloud.detail).toHaveBeenCalledWith(q.id, expect.anything());
    expect(document.body.textContent).toContain(o.content);
    expect(document.querySelector('textarea')).toBeNull();
    await router.push({ path: '/questions', query: router.currentRoute.value.query });
    await settle();
    expect(router.currentRoute.value.query.search).toBe('并发');
  });
  it('游客没有写操作和可编辑单元格；详情仅浏览', async () => {
    identity.value = { role: 'guest', user: null, isAdmin: false, canEdit: false };
    await settle();
    expect(button('添加题目')).toBeUndefined();
    expect(wrapper.find('.cell-edit').exists()).toBe(false);
    expect(wrapper.find('.company-chips button').exists()).toBe(false);
    await click(q.title);
    expect(button('编辑题目')).toBeUndefined();
    expect(button('记录一次出现')).toBeUndefined();
    expect(button('删除题目')).toBeUndefined();
    expect(document.body.textContent).toContain(o.content);
    expect(cloud.meta).not.toHaveBeenCalled();
  });
  it('公司按 ID 提交；保存失败保留选择以便重试', async () => {
    await click('编辑' + q.title + '的公司标签：腾讯');
    await click('腾讯');
    vi.mocked(cloud.meta).mockRejectedValueOnce(new Error('保存失败'));
    await click('保存');
    expect(cloud.meta).toHaveBeenCalledWith(q.id, { companyIds: [] });
    expect(document.querySelector('.question-company-editor')).not.toBeNull();
    expect(document.querySelector('.bubble-choice')?.getAttribute('aria-pressed')).toBe('false');
    await click('保存');
    expect(cloud.meta).toHaveBeenCalledTimes(2);
  });
  it('问法编辑只提交内容，不提交来源或记录时间', async () => {
    await click(q.title);
    await click('编辑问法');
    expect(document.querySelectorAll('textarea')).toHaveLength(1);
    await input(document.querySelector('textarea')!, '修改后的内容');
    vi.mocked(cloud.wording).mockResolvedValue({ ...o, content: '修改后的内容' });
    await click('保存问法');
    expect(cloud.wording).toHaveBeenCalledWith(o.id, '修改后的内容');
    expect(cloud.record).not.toHaveBeenCalled();
    expect(cloud.create).not.toHaveBeenCalled();
  });
  it('快速记录默认未选公司，两项必填，仅发送公司 ID 和内容', async () => {
    await click(q.title);
    await click('记录一次出现');
    await click('保存记录');
    expect(cloud.record).not.toHaveBeenCalled();
    await click('腾讯');
    await input(document.querySelector('textarea')!, '  问法\n追问  ');
    vi.mocked(cloud.record).mockResolvedValue(o);
    await click('保存记录');
    expect(cloud.record).toHaveBeenCalledWith(q.id, {
      companyId: company.id,
      content: '问法\n追问',
    });
  });
  it('新增题目来源完整性及 companyId 契约，不发送旧笔记字段', async () => {
    await click('添加题目');
    await input(document.querySelector('textarea')!, '新标准题目');
    await click('腾讯');
    await click('添加题目');
    expect(cloud.create).not.toHaveBeenCalled();
    await click('暑期');
    await click('一面');
    vi.mocked(cloud.create).mockResolvedValue(q);
    await click('添加题目');
    expect(cloud.create).toHaveBeenCalledWith({
      title: '新标准题目',
      category: '八股',
      tags: [],
      priority: '中',
      mastery: '模糊',
      organized: false,
      source: { companyId: company.id, recruitmentType: '暑期', round: '一面' },
    });
    expect(router.currentRoute.value.params.id).toBe(q.id);
  });
  it('保存导致当前页缩小时，在弹窗关闭后校正 URL，不出现二次未保存确认', async () => {
    vi.mocked(cloud.list).mockImplementation(async () => ({
      items: [q],
      total: q.organized ? 1 : 21,
      page: q.organized ? 1 : 2,
      pageSize: 20,
      usedCompanyIds: [company.id],
    }));
    await router.replace('/questions?page=2&organized=false');
    await settle();
    expect(router.currentRoute.value.query.page).toBe('2');
    await click('切换' + q.title + '的整理状态');
    await settle();
    expect(router.currentRoute.value.query.page).toBeUndefined();
    expect(document.body.textContent).not.toContain('还有未保存的内容');
  });
  it('直接删除先确认；取消不请求删除', async () => {
    await click(q.title);
    await click('删除题目');
    expect(document.body.textContent).toContain('题目和全部出现记录将直接删除');
    expect(cloud.deleteQuestion).not.toHaveBeenCalled();
    await click('取消');
    expect(cloud.deleteQuestion).not.toHaveBeenCalled();
  });
});
