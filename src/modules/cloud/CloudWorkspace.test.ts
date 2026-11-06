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

async function reading(path = '/reading') {
  await router.push(path);
  await settle();
}
async function key(key: string, options: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  await settle();
  return event;
}
function mockReadingRows(count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({
    ...q,
    id: 'row-' + i,
    title: '并发题目 ' + i,
  }));
  vi.mocked(cloud.list).mockImplementation(async (query) => {
    const page = Number(query.page) || 1;
    const size = Number(query.pageSize) || 20;
    return {
      items: rows.slice((page - 1) * size, page * size),
      total: count,
      page,
      pageSize: size,
      usedCompanyIds: [company.id],
    };
  });
  return rows;
}
describe('沉浸列表和悬浮查询', () => {
  it('只保留全屏表格与查找入口；去掉旧page并保留其他查询', async () => {
    await reading('/reading?page=4&search=并发&pageSize=50&category=手撕');
    expect(router.currentRoute.value.query).toEqual({
      search: '并发',
      pageSize: '50',
      category: '手撕',
    });
    expect(wrapper.find('.reading-page').exists()).toBe(true);
    expect(wrapper.find('.page-heading').exists()).toBe(false);
    expect(wrapper.find('.filter-toolbar').exists()).toBe(false);
    expect(wrapper.find('.category-tabs').exists()).toBe(false);
    expect(wrapper.find('.pagination-footer').exists()).toBe(false);
    expect(wrapper.find('#reading-search-panel').exists()).toBe(false);
    expect(button('查找和筛选题目')).toBeTruthy();
    expect(cloud.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 50 }),
      expect.anything(),
    );
  });
  it('Ctrl+F、⌘F和/打开；搜索高亮即时更新，Enter收起保留条件和焦点', async () => {
    await reading();
    expect((await key('f', { ctrlKey: true })).defaultPrevented).toBe(true);
    const inputElement = document.querySelector<HTMLInputElement>('.reading-panel-search input')!;
    expect(document.activeElement).toBe(inputElement);
    await input(inputElement, '并发');
    expect(router.currentRoute.value.query.search).toBe('并发');
    expect(wrapper.find('mark').text()).toBe('并发');
    expect((await key('f', { metaKey: true }, inputElement)).defaultPrevented).toBe(true);
    expect(inputElement.selectionStart).toBe(0);
    expect(inputElement.selectionEnd).toBe(2);
    await key('Enter', {}, inputElement);
    expect(wrapper.find('#reading-search-panel').exists()).toBe(false);
    expect(router.currentRoute.value.query.search).toBe('并发');
    expect(document.activeElement).toBe(button('查找和筛选题目'));
    expect((await key('/')).defaultPrevented).toBe(true);
    await key('Escape', {}, document.activeElement!);
    expect(wrapper.find('#reading-search-panel').exists()).toBe(false);
  });
  it('普通题库、输入区、输入法、详情和编辑弹窗不接管查找', async () => {
    expect((await key('f', { ctrlKey: true })).defaultPrevented).toBe(false);
    await reading();
    const external = document.createElement('textarea');
    document.body.append(external);
    expect((await key('f', { ctrlKey: true }, external)).defaultPrevented).toBe(false);
    external.remove();
    expect((await key('f', { ctrlKey: true, isComposing: true })).defaultPrevented).toBe(false);
    await click(q.title);
    expect((await key('f', { ctrlKey: true })).defaultPrevented).toBe(false);
    await click('编辑题目');
    expect((await key('/')).defaultPrevented).toBe(false);
    expect(wrapper.find('#reading-search-panel').exists()).toBe(false);
  });
  it('分类、清除、点击外部、历史查询变化即时生效', async () => {
    await reading('/reading?search=并发&pageSize=50');
    await click('查找和筛选题目');
    await click('八股基础');
    expect(router.currentRoute.value.query.category).toBe('八股');
    await click('清除条件');
    expect(router.currentRoute.value.query).toEqual({ pageSize: '50' });
    expect(wrapper.find('#reading-search-panel').exists()).toBe(true);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await settle();
    expect(wrapper.find('#reading-search-panel').exists()).toBe(false);
    await router.replace('/reading?search=Promise&mastery=不会');
    await settle();
    await click('查找和筛选题目');
    expect(document.querySelector<HTMLInputElement>('.reading-panel-search input')!.value).toBe(
      'Promise',
    );
    expect(document.querySelector('.reading-filter-count')?.textContent).toBe('2');
  });
  it('按批串行追加，直至加载结束，详情往返不重新取首批', async () => {
    const rows = mockReadingRows(42);
    await reading();
    expect(wrapper.findAll('.question-link')).toHaveLength(20);
    await click('继续加载');
    expect(wrapper.findAll('.question-link')).toHaveLength(40);
    await click('继续加载');
    expect(wrapper.findAll('.question-link')).toHaveLength(42);
    expect(wrapper.text()).toContain('已全部加载');
    const calls = vi.mocked(cloud.list).mock.calls.length;
    vi.mocked(cloud.detail).mockResolvedValue({ question: rows[30]!, occurrences: [] });
    await click(rows[30]!.title);
    await router.push('/reading');
    await settle();
    expect(wrapper.findAll('.question-link')).toHaveLength(42);
    expect(cloud.list).toHaveBeenCalledTimes(calls);
  });
  it('后续请求失败保留题目并可重试，不同时重复加载', async () => {
    const rows = mockReadingRows(40);
    await reading();
    vi.mocked(cloud.list).mockRejectedValueOnce(new Error('网络失败'));
    await click('继续加载');
    expect(wrapper.findAll('.question-link')).toHaveLength(20);
    expect(wrapper.text()).not.toContain('暂时无法加载数据');
    await click('加载失败，重试');
    expect(wrapper.findAll('.question-link')).toHaveLength(rows.length);
  });
  it('真实表格滚动节点到达240px阈值时只发起一次下一批请求', async () => {
    const rows = mockReadingRows(40);
    await reading();
    const body = document.querySelector<HTMLElement>(
      '.n-data-table-base-table-body .n-scrollbar-container',
    )!;
    expect(body).toBeTruthy();
    Object.defineProperties(body, { clientHeight: { value: 500 }, scrollHeight: { value: 2000 } });
    body.scrollTop = 1260;
    let resolveNext!: (result: Awaited<ReturnType<typeof cloud.list>>) => void;
    vi.mocked(cloud.list).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveNext = resolve;
        }),
    );
    body.dispatchEvent(new Event('scroll'));
    body.dispatchEvent(new Event('scroll'));
    await settle();
    expect(vi.mocked(cloud.list).mock.calls.filter(([query]) => query.page === 2)).toHaveLength(1);
    resolveNext({ items: rows.slice(20), total: 40, page: 2, pageSize: 20, usedCompanyIds: [] });
    await settle();
    expect(wrapper.findAll('.question-link')).toHaveLength(40);
  });
  it('切换搜索取消旧请求，旧响应不混入新条件', async () => {
    let resolveOld!: (value: Awaited<ReturnType<typeof cloud.list>>) => void;
    let oldSignal: AbortSignal | undefined;
    vi.mocked(cloud.list).mockImplementationOnce((_query, signal) => {
      oldSignal = signal;
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    });
    await reading('/reading?search=old');
    await click('查找和筛选题目');
    await input(document.querySelector<HTMLInputElement>('.reading-panel-search input')!, 'new');
    expect(oldSignal?.aborted).toBe(true);
    resolveOld({
      items: [{ ...q, id: 'old', title: '过期结果' }],
      total: 1,
      page: 1,
      pageSize: 20,
      usedCompanyIds: [],
    });
    await settle();
    expect(wrapper.text()).not.toContain('过期结果');
    expect(cloud.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'new', page: 1 }),
      expect.anything(),
    );
  });
  it('刷新已加载批次顺序重取，返回页码回退时重置首批', async () => {
    const rows = mockReadingRows(40);
    await reading();
    await click('继续加载');
    const before = vi.mocked(cloud.list).mock.calls.length;
    await client.invalidateQueries({ queryKey: ['mianjing'] });
    await settle();
    expect(
      vi
        .mocked(cloud.list)
        .mock.calls.slice(before)
        .map(([query]) => query.page),
    ).toEqual([1, 2]);
    vi.mocked(cloud.list).mockImplementation(async () => ({
      items: rows.slice(0, 1),
      total: 1,
      page: 1,
      pageSize: 20,
      usedCompanyIds: [],
    }));
    await client.invalidateQueries({ queryKey: ['mianjing'] });
    await settle();
    expect(wrapper.findAll('.question-link')).toHaveLength(1);
    expect(wrapper.text()).toContain('已全部加载');
  });
  it('游客菜单无新增入口，仍能返回普通题库', async () => {
    identity.value = { role: 'guest', user: null, isAdmin: false, canEdit: false };
    await reading('/reading?search=并发');
    await click('查找和筛选题目');
    await click('阅读更多操作');
    expect(document.body.textContent).not.toContain('添加题目');
    const back = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
      item.textContent?.includes('返回普通题库'),
    )!;
    expect(back).toBeTruthy();
    back.querySelector<HTMLElement>('.n-dropdown-option-body')!.click();
    await settle();
    expect(router.currentRoute.value.path).toBe('/questions');
    expect(router.currentRoute.value.query.search).toBe('并发');
    expect(wrapper.find('.pagination-footer').exists()).toBe(true);
  });
});
