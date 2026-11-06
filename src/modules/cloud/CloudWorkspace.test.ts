import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { computed, h, nextTick, ref } from 'vue';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createRouter, createMemoryHistory, RouterView, type Router } from 'vue-router';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { NDialogProvider, NMessageProvider } from 'naive-ui';
import QuestionsPage from './QuestionsPage.vue';
import { cloud } from './api';
import { identity } from '@/modules/auth/session';
import { companyCatalogKey } from '@/shared/composables/useCompanyCatalog';
import type { Question, Occurrence, ListResult } from './types';
import type { CompanyCatalog } from '@/shared/types/domain';
import {
  FILTER_PREFERENCES_KEY,
  readFilterPreferences,
  writeFilterPreferences,
} from './filterPreferences';
vi.mock('./api', () => ({
  cloud: {
    catalog: vi.fn(),
    saveCatalog: vi.fn(),
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
const catalogState = ref<CompanyCatalog>({ revision: 0, items: [] });
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
  localStorage.removeItem(FILTER_PREFERENCES_KEY);
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(min-width: 761px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );

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
  catalogState.value = { revision: 0, items: [{ ...company, aliases: [] }] };
  vi.mocked(cloud.catalog).mockImplementation(async () => ({ items: [{ ...company }] }));
  vi.mocked(cloud.edit).mockImplementation(async (_id, input) => {
    Object.assign(q, input);
    return q;
  });
  vi.mocked(cloud.wording).mockImplementation(async (_id, content) => {
    o.content = content;
    return o;
  });
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
        [companyCatalogKey as symbol]: computed(() => catalogState.value),
      },
    },
  });
  await settle();
});
afterEach(() => {
  wrapper.unmount();
  localStorage.removeItem(FILTER_PREFERENCES_KEY);
  client.clear();
  identity.value = null;
  vi.unstubAllGlobals();
});
describe('筛选本地记忆', () => {
  const saved = () => ({
    search: '并发',
    category: '手撕',
    company: company.id,
    mastery: '不会',
    organized: 'false',
    sort: 'count',
    pageSize: 50,
  });
  async function leaveAndSave() {
    await router.push('/login');
    await settle();
    writeFilterPreferences(saved());
    vi.mocked(cloud.list).mockClear();
  }
  it.each(['/questions', '/reading'])(
    '裸入口%s恢复同一份条件，首次请求直接使用恢复值',
    async (path) => {
      await leaveAndSave();
      await router.push(path);
      await settle();
      expect(router.currentRoute.value.query).toEqual({
        search: '并发',
        category: '手撕',
        company: company.id,
        mastery: '不会',
        organized: 'false',
        sort: 'count',
        pageSize: '50',
      });
      expect(cloud.list).toHaveBeenCalledTimes(1);
      expect(cloud.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: '并发',
          category: '手撕',
          company: company.id,
          mastery: '不会',
          organized: 'false',
          sort: 'count',
          page: 1,
          pageSize: 50,
        }),
        expect.anything(),
      );
      if (path === '/reading') await click('查找和筛选题目');
      expect(button('手撕代码').getAttribute('aria-pressed')).toBe('true');
      expect(button('排序').textContent).toContain('出现次数');
      expect(document.querySelector('.filter-condition-row')?.textContent).toContain('腾讯');
      expect(document.querySelector('mark')?.textContent).toBe('并发');
      expect(readFilterPreferences()).toEqual(saved());
    },
  );
  it('带条件的链接整体优先，不补入本地的其他字段，前进后退同步保存', async () => {
    await leaveAndSave();
    await router.push('/questions?category=算法');
    await settle();
    expect(router.currentRoute.value.query).toEqual({ category: '算法' });
    expect(readFilterPreferences()).toEqual({
      search: '',
      category: '算法',
      company: '',
      mastery: '',
      organized: '',
      sort: 'priority',
      pageSize: 20,
    });
    await router.push('/questions?search=Promise&sort=updated');
    await settle();
    router.back();
    await settle();
    expect(readFilterPreferences()?.category).toBe('算法');
    expect(readFilterPreferences()?.search).toBe('');
    router.forward();
    await settle();
    expect(readFilterPreferences()?.search).toBe('Promise');
    expect(readFilterPreferences()?.sort).toBe('updated');
  });
  it('清除后不恢复旧条件；分类、排序和批量数量仍被记住', async () => {
    await leaveAndSave();
    await router.push('/questions');
    await settle();
    await click('清除筛选');
    expect(readFilterPreferences()).toEqual({
      search: '',
      category: '手撕',
      company: '',
      mastery: '',
      organized: '',
      sort: 'count',
      pageSize: 50,
    });
    await router.push('/login');
    await settle();
    await router.push('/reading');
    await settle();
    expect(router.currentRoute.value.query).toEqual({
      category: '手撕',
      sort: 'count',
      pageSize: '50',
    });
    await router.replace('/reading?search=并发');
    await settle();
    await click('查找和筛选题目');
    await click('清除筛选');
    expect(router.currentRoute.value.query).toEqual({});
    expect(readFilterPreferences()?.search).toBe('');
    await router.push('/login');
    await settle();
    await router.push('/questions');
    await settle();
    expect(router.currentRoute.value.query).toEqual({});
    expect(document.querySelector('.filter-condition-row')).toBeNull();
  });
  it('直接打开详情只恢复筛选，保留题目ID与hash，不把详情或记录写入存储', async () => {
    await leaveAndSave();
    await router.push('/questions/' + q.id + '#records');
    await settle();
    expect(router.currentRoute.value.params.id).toBe(q.id);
    expect(router.currentRoute.value.hash).toBe('#records');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(q.title);
    expect(localStorage.getItem(FILTER_PREFERENCES_KEY)).not.toContain(q.id);
    expect(readFilterPreferences()).toEqual(saved());
  });
  it('存储读写失败时仍能打开页面并正常切换URL条件', async () => {
    await router.push('/login');
    await settle();
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Error('quota');
    });
    try {
      await router.push('/questions');
      await settle();
      await click('八股基础');
      expect(router.currentRoute.value.query.category).toBe('八股');
      expect(button(q.title)).toBeTruthy();
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});
describe('云端题库界面', () => {
  it('分类请求期间工具栏和表格原位保留，快速切换取消旧请求，只显示最终分类', async () => {
    const tabs = document.querySelector('.filter-category-tabs');
    const filters = document.querySelector('.filter-tools-row');
    const table = document.querySelector('.questions-table');
    const pending = new Map<
      string,
      { resolve: (value: ListResult) => void; signal?: AbortSignal }
    >();
    vi.mocked(cloud.list).mockImplementation(
      (query, signal) =>
        new Promise((resolve) => {
          pending.set(String(query.category), { resolve, signal });
        }),
    );
    await click('算法练习');
    expect(document.querySelector('.filter-category-tabs')).toBe(tabs);
    expect(document.querySelector('.filter-tools-row')).toBe(filters);
    expect(document.querySelector('.questions-table')).toBe(table);
    expect(document.querySelector('.loading-block')).toBeNull();
    expect(document.querySelector('.questions-table')?.getAttribute('aria-busy')).toBe('true');
    expect(button(q.title).disabled).toBe(true);
    expect(button('算法练习').getAttribute('aria-pressed')).toBe('true');
    await click('场景应用');
    expect(pending.get('算法')?.signal?.aborted).toBe(true);
    pending.get('算法')!.resolve({
      items: [{ ...q, id: 'old', title: '过期算法题' }],
      total: 1,
      page: 1,
      pageSize: 20,
      usedCompanyIds: [],
    });
    await settle();
    expect(wrapper.text()).not.toContain('过期算法题');
    pending.get('场景题')!.resolve({
      items: [{ ...q, id: 'new', title: '当前场景题' }],
      total: 1,
      page: 1,
      pageSize: 20,
      usedCompanyIds: [],
    });
    await settle();
    expect(document.querySelector('.questions-table')).toBe(table);
    expect(wrapper.text()).toContain('当前场景题');
    expect(button('当前场景题').disabled).toBe(false);
    expect(document.querySelector('.questions-table')?.getAttribute('aria-busy')).toBe('false');
  });
  it('旧分页链接移除page，保留筛选及批量数量，只从首批开始', async () => {
    let resolve!: (value: ListResult) => void;
    vi.mocked(cloud.list).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await router.replace('/questions?search=并发&page=2&pageSize=50');
    await settle();
    expect(router.currentRoute.value.query).toEqual({ search: '并发', pageSize: '50' });
    expect(document.querySelector('.filter-category-tabs')).not.toBeNull();
    expect(wrapper.text()).toContain(q.title);
    resolve({
      items: [{ ...q, id: 'batch-one', title: '新批次题目' }],
      total: 21,
      page: 1,
      pageSize: 50,
      usedCompanyIds: [],
    });
    await settle();
    expect(router.currentRoute.value.query.page).toBeUndefined();
    expect(wrapper.text()).toContain('新批次题目');
    expect(cloud.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 50 }),
      expect.anything(),
    );
    expect(wrapper.find('.pagination-footer').exists()).toBe(false);
  });
  it('分类加载失败仍保留筛选入口，重试成功后恢复表格', async () => {
    const tabs = document.querySelector('.filter-category-tabs');
    vi.mocked(cloud.list).mockRejectedValueOnce(new Error('分类请求失败'));
    await click('八股基础');
    expect(document.querySelector('.filter-category-tabs')).toBe(tabs);
    expect(document.querySelector('.filter-tools-row')).not.toBeNull();
    expect(wrapper.text()).toContain('分类请求失败');
    await click('重试');
    expect(document.querySelector('.filter-category-tabs')).toBe(tabs);
    expect(wrapper.text()).toContain(q.title);
    expect(wrapper.text()).not.toContain('分类请求失败');
  });
  it('公司筛选和条件标签均按ID工作，停用公司仍可筛选', async () => {
    catalogState.value = { revision: 0, items: [{ ...company, enabled: false, aliases: [] }] };
    await click('筛选公司');
    expect(document.querySelector<HTMLInputElement>('[aria-label="搜索筛选公司"]')).toBe(
      document.activeElement,
    );
    await click('腾讯');
    expect(router.currentRoute.value.query.company).toBe(company.id);
    expect(document.querySelector('.filter-condition-row')?.textContent).toContain('腾讯');
    expect(button('筛选公司').getAttribute('aria-expanded')).toBe('false');
    await click('编辑公司筛选：腾讯');
    expect(button('筛选公司').getAttribute('aria-expanded')).toBe('true');
    await click('全部公司');
    expect(router.currentRoute.value.query.company).toBeUndefined();
    expect(router.currentRoute.value.query.search).toBe('并发');
  });
  it('公司名称和别名搜索仅查找候选，不发起题库请求；未使用公司不展示', async () => {
    catalogState.value = {
      revision: 0,
      items: [
        { ...company, aliases: ['Tencent'], enabled: false },
        { ...company, id: 'unused', name: '未被使用公司', aliases: [] },
      ],
    };
    await click('筛选公司');
    const calls = vi.mocked(cloud.list).mock.calls.length;
    const field = document.querySelector<HTMLInputElement>('[aria-label="搜索筛选公司"]')!;
    await input(field, 'tEnCeNt');
    expect(button('腾讯')).toBeTruthy();
    expect(button('未被使用公司')).toBeUndefined();
    await input(field, '无匹配');
    expect(document.querySelector('.filter-option-empty')?.textContent).toBe('没有匹配的公司');
    expect(button('全部公司')).toBeTruthy();
    expect(cloud.list).toHaveBeenCalledTimes(calls);
    await key('Escape', {}, field);
    expect(button('筛选公司').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button('筛选公司'));
  });
  it('关键词标签聚焦并全选搜索，删除条件与URL历史变化同步', async () => {
    await click('编辑关键词筛选：并发');
    const search = document.querySelector<HTMLInputElement>('.filter-search-input input')!;
    expect(document.activeElement).toBe(search);
    expect(search.selectionStart).toBe(0);
    expect(search.selectionEnd).toBe(2);
    await click('移除关键词筛选');
    expect(router.currentRoute.value.query.search).toBeUndefined();
    expect(document.querySelector('.filter-condition-row')).toBeNull();
    await router.replace('/questions?mastery=熟练&organized=true&category=算法&sort=updated');
    await settle();
    expect(document.querySelector('.filter-condition-row')?.textContent).toContain('熟练');
    expect(document.querySelector('.filter-condition-row')?.textContent).toContain('已整理');
    expect(button('算法练习').getAttribute('aria-pressed')).toBe('true');
    expect(button('排序').textContent).toContain('最近更新');
  });
  it('清除筛选只更新一次URL，保留分类、排序和每页数量，重置分页', async () => {
    await router.replace(
      '/questions?search=并发&category=手撕&company=' +
        company.id +
        '&mastery=不会&organized=false&sort=count&pageSize=50',
    );
    await settle();
    const before = vi.mocked(cloud.list).mock.calls.length;
    await click('清除筛选');
    expect(router.currentRoute.value.query).toEqual({
      category: '手撕',
      sort: 'count',
      pageSize: '50',
    });
    expect(vi.mocked(cloud.list).mock.calls.length - before).toBe(1);
    expect(document.querySelector('.filter-condition-row')).toBeNull();
  });
  it('各筛选立即生效，单项移除不影响其他条件，菜单同时只打开一个', async () => {
    await click('筛选掌握程度');
    await click('不会');
    await click('筛选整理状态');
    await click('待整理');
    expect(document.querySelector('.filter-count')?.textContent).toBe('2');
    await click('排序');
    await click('出现次数');
    expect(router.currentRoute.value.query).toEqual({
      search: '并发',
      mastery: '不会',
      organized: 'false',
      sort: 'count',
    });
    await click('移除掌握程度筛选');
    expect(router.currentRoute.value.query.mastery).toBeUndefined();
    expect(router.currentRoute.value.query.organized).toBe('false');
    await click('筛选公司');
    await click('排序');
    expect(button('筛选公司').getAttribute('aria-expanded')).toBe('false');
    expect(button('排序').getAttribute('aria-expanded')).toBe('true');
  });
  it('公司、次数和整理胶囊保留原编辑入口，游客状态有明确名称', async () => {
    expect(wrapper.findAll('th').map((header) => header.text())).toContain('是否整理');
    expect(wrapper.find('.company-label-name').text()).toBe('腾讯');
    expect(wrapper.find('.company-color-dot').exists()).toBe(false);
    expect(wrapper.find('.frequency-badge').text()).toBe('3');
    expect(wrapper.find('.frequency-badge').classes()).toContain('medium');
    expect(wrapper.find('.organized-badge').text()).toBe('否');
    await click('切换' + q.title + '的整理状态');
    expect(cloud.meta).toHaveBeenCalledWith(q.id, { organized: true });
    expect(wrapper.find('.organized-badge').text()).toBe('是');
    identity.value = { role: 'guest', user: null, isAdmin: false, canEdit: false };
    await settle();
    expect(wrapper.find('.organized-badge').attributes('aria-label')).toBe('已整理');
    expect(wrapper.find('.cell-edit').exists()).toBe(false);
  });

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
    expect(button('编辑题目标题')).toBeUndefined();
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
  it('保存后筛选结果变空仍保留条件，不出现分页或二次未保存确认', async () => {
    vi.mocked(cloud.list).mockImplementation(async () => ({
      items: q.organized ? [] : [q],
      total: q.organized ? 0 : 21,
      page: 1,
      pageSize: 20,
      usedCompanyIds: [company.id],
    }));
    await router.replace('/questions?page=2&organized=false');
    await settle();
    expect(router.currentRoute.value.query.page).toBeUndefined();
    await click('切换' + q.title + '的整理状态');
    await settle();
    expect(router.currentRoute.value.query.organized).toBe('false');
    expect(wrapper.findAll('.question-link')).toHaveLength(0);
    expect(document.body.textContent).not.toContain('还有未保存的内容');
    expect(wrapper.find('.pagination-footer').exists()).toBe(false);
  });
  it('直接删除先确认；取消不请求删除', async () => {
    await click(q.title);
    await click('题目更多操作');
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
    expect(wrapper.find('.filter-tools-row').exists()).toBe(false);
    expect(wrapper.find('.filter-category-tabs').exists()).toBe(false);
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
    await click('编辑题目标题');
    expect((await key('/')).defaultPrevented).toBe(false);
    expect(wrapper.find('#reading-search-panel').exists()).toBe(false);
  });
  it('分类、清除、点击外部、历史查询变化即时生效', async () => {
    await reading('/reading?search=并发&pageSize=50');
    await click('查找和筛选题目');
    await click('八股基础');
    expect(router.currentRoute.value.query.category).toBe('八股');
    await click('清除筛选');
    expect(router.currentRoute.value.query).toEqual({ category: '八股', pageSize: '50' });
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
  it('沉浸面板默认显示完整筛选；内部Esc先关闭弹层，外部Esc再关闭面板', async () => {
    await reading();
    await click('查找和筛选题目');
    expect(button('更多筛选')).toBeUndefined();
    for (const name of ['筛选公司', '筛选掌握程度', '筛选整理状态', '排序'])
      expect(button(name)).toBeTruthy();
    expect(document.querySelector('[aria-label="每批加载数量"]')).not.toBeNull();
    await click('筛选公司');
    const field = document.querySelector<HTMLInputElement>('[aria-label="搜索筛选公司"]')!;
    field.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await settle();
    expect(wrapper.find('#reading-search-panel').exists()).toBe(true);
    await key('Escape', {}, field);
    expect(button('筛选公司').getAttribute('aria-expanded')).toBe('false');
    expect(wrapper.find('#reading-search-panel').exists()).toBe(true);
    await key('Escape', {}, button('筛选公司'));
    expect(wrapper.find('#reading-search-panel').exists()).toBe(false);
  });
  it('沉浸清除保留分类排序和批次，筛选公司候选在请求期间不丢失', async () => {
    await reading('/reading?category=八股&sort=updated&pageSize=50&mastery=不会');
    await click('查找和筛选题目');
    let resolve!: (value: ListResult) => void;
    vi.mocked(cloud.list).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await click('清除筛选');
    expect(router.currentRoute.value.query).toEqual({
      category: '八股',
      sort: 'updated',
      pageSize: '50',
    });
    await click('筛选公司');
    expect(button('腾讯')).toBeTruthy();
    resolve({ items: [q], total: 1, page: 1, pageSize: 50, usedCompanyIds: [company.id] });
    await settle();
    expect(wrapper.find('#reading-search-panel').exists()).toBe(true);
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
    expect(wrapper.find('.pagination-footer').exists()).toBe(false);
    expect(wrapper.text()).toContain('已加载');
  });
});

describe('居中详情和原位草稿', () => {
  it('详情加载失败可重试，空记录仅显示真实手动累计', async () => {
    vi.mocked(cloud.detail).mockRejectedValueOnce(new Error('详情暂时不可用'));
    await click(q.title);
    expect(document.querySelector('.detail-modal')?.textContent).toContain('详情暂时不可用');
    vi.mocked(cloud.detail).mockResolvedValue({
      question: { ...q, baseCount: 3, recordCount: 0 },
      occurrences: [],
    });
    await click('重试');
    expect(document.querySelector('.detail-base-count')?.textContent).toContain('手动补充 3 次');
    expect(document.querySelector('.detail-empty')?.textContent?.trim()).toBe('暂无出现记录');
    expect(document.querySelectorAll('.detail-record')).toHaveLength(0);
  });
  it('遮罩关闭有草稿时确认，取消保留输入，放弃后返回原查询', async () => {
    await click(q.title);
    await click('编辑问法');
    await input(document.querySelector('textarea')!, '未保存草稿');
    for (const type of ['mousedown', 'mouseup'])
      document
        .querySelector<HTMLElement>('.n-modal-mask')!
        .dispatchEvent(new MouseEvent(type, { bubbles: true }));
    await settle();
    await click('继续编辑');
    expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('未保存草稿');
    for (const type of ['mousedown', 'mouseup'])
      document
        .querySelector<HTMLElement>('.n-modal-mask')!
        .dispatchEvent(new MouseEvent(type, { bubbles: true }));
    await settle();
    await click('放弃修改');
    expect(router.currentRoute.value.path).toBe('/questions');
    expect(router.currentRoute.value.query.search).toBe('并发');
    expect(cloud.wording).not.toHaveBeenCalled();
  });
  it('路由切换题目需确认，拒绝不清空草稿，接受才读取新题目', async () => {
    await click(q.title);
    await click('编辑题目标题');
    await input(document.querySelector('textarea')!, '上一题草稿');
    const rejected = router.push('/questions/other?search=并发');
    await settle();
    await click('继续编辑');
    await rejected;
    expect(router.currentRoute.value.params.id).toBe(q.id);
    expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('上一题草稿');
    vi.mocked(cloud.detail).mockResolvedValue({
      question: { ...q, id: 'other', title: '另一道题' },
      occurrences: [],
    });
    const accepted = router.push('/questions/other?search=并发');
    await settle();
    await click('放弃修改');
    await accepted;
    await settle();
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.querySelector('.detail-question-title')?.textContent).toBe('另一道题');
  });

  it('单个居中对话框直接呈现原文，不重复标题，HTML按字面展示', async () => {
    o.content = '<img src=x onerror=alert(1)>\n追问与代码';
    await click(q.title);
    expect(document.querySelectorAll('.detail-modal')).toHaveLength(1);
    expect(document.querySelector('.n-drawer')).toBeNull();
    expect(document.querySelector('.detail-question-title')?.textContent).toBe(q.title);
    expect(document.querySelector('.detail-content')?.textContent).not.toContain('标准题目');
    expect(document.querySelector('.detail-topbar')?.textContent).not.toContain('题目详情');
    expect(document.querySelector('.record-content')?.textContent).toBe(o.content);
    expect(document.querySelector('.record-content img')).toBeNull();
    expect(document.querySelector('.detail-records-heading')?.textContent).toContain(
      '记录一次出现',
    );
  });
  it('题目原位校验及保存保留来源、次数，保存失败保留输入', async () => {
    await click(q.title);
    await click('编辑题目标题');
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    const title = document.querySelector<HTMLTextAreaElement>('.inline-question-editor textarea')!;
    await input(title, '  ');
    await click('保存题目');
    expect(cloud.edit).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('请填写题目');
    await input(title, '新题目\n原始换行');
    expect(document.querySelector('.detail-modal [aria-label="知识点"]')).toBeNull();
    expect(document.querySelector('.detail-modal [aria-label="题型"]')).toBeNull();
    expect(document.querySelector('.detail-metadata')?.textContent).toContain('Promise');
    vi.mocked(cloud.edit).mockRejectedValueOnce(new Error('保存失败，请重试'));
    await click('保存题目');
    expect(title.value).toBe('新题目\n原始换行');
    expect(document.querySelector('.inline-error')?.textContent).toContain('保存失败');
    await click('保存题目');
    expect(cloud.edit).toHaveBeenLastCalledWith(q.id, {
      title: '新题目\n原始换行',
    });
    expect(document.querySelector('.detail-question-title')?.textContent).toBe(q.title);
    expect(q.totalCount).toBe(3);
    expect(q.tags).toEqual(['Promise', '并发控制']);
    expect(q.category).toBe('手撕');
    expect(q.priority).toBe('高');
    expect(q.mastery).toBe('不会');
    expect(q.organized).toBe(false);
    expect(q.companyIds).toEqual([company.id]);
    expect(cloud.record).not.toHaveBeenCalled();
    expect(document.querySelector('.inline-question-editor')).toBeNull();
  });
  it('不同公司问法独立编辑，来源和时间不变，允许清空且不增加记录', async () => {
    const second = {
      ...o,
      id: 'second',
      company: { ...company, name: '智谱' },
      content: '另一家公司问法',
    };
    vi.mocked(cloud.detail).mockImplementation(async () => ({
      question: q,
      occurrences: [o, second],
    }));
    await click(q.title);
    const source = JSON.parse(JSON.stringify(o));
    await click('编辑问法');
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelectorAll('textarea')).toHaveLength(1);
    await input(document.querySelector('textarea')!, '');
    await click('保存问法');
    expect(cloud.wording).toHaveBeenCalledWith(o.id, '');
    expect(o).toEqual({ ...source, content: '' });
    expect(second.content).toBe('另一家公司问法');
    expect(document.querySelector('.record-content')?.textContent).toBe('未记录实际内容');
    expect(q.totalCount).toBe(3);
    expect(cloud.record).not.toHaveBeenCalled();
  });
  it('切换编辑区域只确认一次，继续编辑保留草稿，放弃才切换', async () => {
    await click(q.title);
    await click('编辑题目标题');
    await input(document.querySelector('textarea')!, '尚未保存');
    await click('编辑问法');
    expect(document.querySelectorAll('.n-dialog')).toHaveLength(1);
    await click('继续编辑');
    expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('尚未保存');
    expect(document.querySelector('.inline-occurrence-editor')).toBeNull();
    await click('编辑问法');
    await click('放弃修改');
    expect(document.querySelector('.inline-question-editor')).toBeNull();
    expect(document.querySelector('.inline-occurrence-editor')).not.toBeNull();
    expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(o.content);
    expect(cloud.edit).not.toHaveBeenCalled();
  });
  it('Esc取消编辑后仍停留在详情，再次Esc关闭并保留查询', async () => {
    await click(q.title);
    await click('编辑问法');
    const textarea = document.querySelector('textarea')!;
    await input(textarea, '草稿');
    await key('Escape', {}, textarea);
    await click('放弃修改');
    expect(router.currentRoute.value.params.id).toBe(q.id);
    expect(document.querySelector('textarea')).toBeNull();
    await key('Escape', {}, document.querySelector('.detail-modal')!);
    expect(router.currentRoute.value.path).toBe('/questions');
    expect(router.currentRoute.value.query.search).toBe('并发');
  });
  it('标题点击编辑，仅有一个输入；输入法Esc不取消，取消后焦点返回标题', async () => {
    await click(q.title);
    await click('编辑题目标题');
    expect(document.querySelectorAll('.detail-modal textarea')).toHaveLength(1);
    expect(document.querySelector('.detail-modal .n-select')).toBeNull();
    await key('Escape', { isComposing: true }, document.querySelector('textarea')!);
    expect(document.querySelector('.inline-question-editor')).not.toBeNull();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    await click('取消');
    expect(document.querySelector('.inline-question-editor')).toBeNull();
    // jsdom has no layout, so Naive UI's focus trap may redirect to its sentinel.
    // Check the intended focus target here; the browser check covers actual focus.
    expect(focus.mock.instances).toContain(button('编辑题目标题'));
    focus.mockRestore();
    expect(cloud.edit).not.toHaveBeenCalled();
    expect(document.querySelector('.detail-metadata')?.textContent).toContain('Promise');
  });
  it('更多菜单的Esc只关闭菜单，不关闭阅读详情', async () => {
    await click(q.title);
    await click('题目更多操作');
    await key('Escape', {}, document.querySelector('[role="menu"]')!);
    expect(router.currentRoute.value.params.id).toBe(q.id);
    expect(button('题目更多操作').getAttribute('aria-expanded')).toBe('false');
  });
  it('提交期间禁止重复保存、关闭和路由切换', async () => {
    await click(q.title);
    await click('编辑问法');
    await input(document.querySelector('textarea')!, '新问法');
    let finish!: (value: Occurrence) => void;
    vi.mocked(cloud.wording).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await click('保存问法');
    document
      .querySelector('form.inline-occurrence-editor')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(cloud.wording).toHaveBeenCalledOnce();
    expect(button('关闭题目详情').disabled).toBe(true);
    await router.push('/questions');
    expect(router.currentRoute.value.params.id).toBe(q.id);
    finish({ ...o, content: '新问法' });
    await settle();
    expect(document.querySelector('.inline-occurrence-editor')).toBeNull();
  });
  it('查询刷新不覆盖草稿；列表加载错误也不卸载详情', async () => {
    await click(q.title);
    await click('编辑题目标题');
    await input(document.querySelector('textarea')!, '本地草稿');
    vi.mocked(cloud.detail).mockResolvedValue({
      question: { ...q, title: '服务端更新' },
      occurrences: [o],
    });
    await client.invalidateQueries({ queryKey: ['mianjing', 'detail'] });
    await settle();
    expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('本地草稿');
    vi.mocked(cloud.list).mockRejectedValue(new Error('列表网络错误'));
    await client.invalidateQueries({ queryKey: ['mianjing', 'questions'] });
    await settle();
    expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('本地草稿');
  });
  it('进入公司管理只显示一层业务弹窗，返回保留公司与内容', async () => {
    await click(q.title);
    await click('记录一次出现');
    await click('腾讯');
    await input(document.querySelector('textarea')!, '新增草稿');
    await click('管理公司标签');
    expect(document.querySelector('.company-catalog-manager')).not.toBeNull();
    expect(wrapper.findComponent(QuestionsPage).exists()).toBe(true);
    const navigation = router.push('/questions');
    await settle();
    expect(document.querySelectorAll('.n-dialog')).toHaveLength(1);
    await click('继续编辑');
    await navigation;
    await click('关闭公司标签管理');
    expect(
      [...document.querySelectorAll<HTMLElement>('.n-dialog')].filter(
        (el) => getComputedStyle(el).display !== 'none',
      ),
    ).toHaveLength(0);
    expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('新增草稿');
    expect(document.querySelector('.bubble-choice[aria-pressed="true"]')?.textContent).toContain(
      '腾讯',
    );
    expect(cloud.record).not.toHaveBeenCalled();
  });
  it('新增记录失败可重试，成功只计一次；游客没有表单与更多菜单', async () => {
    await click(q.title);
    await click('记录一次出现');
    await click('腾讯');
    await input(document.querySelector('textarea')!, '  新增内容\n追问  ');
    vi.mocked(cloud.record).mockRejectedValueOnce(new Error('暂时无法保存'));
    await click('保存记录');
    expect(document.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      '  新增内容\n追问  ',
    );
    vi.mocked(cloud.record).mockImplementationOnce(async () => {
      q.recordCount++;
      q.totalCount++;
      return { ...o, id: 'new', content: '新增内容\n追问' };
    });
    await click('保存记录');
    expect(q.totalCount).toBe(4);
    expect(cloud.record).toHaveBeenLastCalledWith(q.id, {
      companyId: company.id,
      content: '新增内容\n追问',
    });
    expect(document.querySelector('.inline-record-create')).toBeNull();
    identity.value = { role: 'guest', user: null, isAdmin: false, canEdit: false };
    await settle();
    expect(button('编辑题目标题')).toBeUndefined();
    expect(button('记录一次出现')).toBeUndefined();
    expect(button('题目更多操作')).toBeUndefined();
    expect(document.querySelector('form')).toBeNull();
  });
  it('删除记录藏在菜单，取消不请求；删除题目成功可通过关闭守卫', async () => {
    await click(q.title);
    await click('腾讯的记录更多操作');
    await click('删除腾讯的出现记录');
    await click('取消');
    expect(cloud.deleteOccurrence).not.toHaveBeenCalled();
    await click('题目更多操作');
    await click('删除题目');
    vi.mocked(cloud.deleteQuestion).mockResolvedValue(undefined);
    await click('删除');
    expect(cloud.deleteQuestion).toHaveBeenCalledWith(q.id);
    expect(router.currentRoute.value.path).toBe('/questions');
  });
});

describe.each(['/questions', '/reading'])('共用连续加载：%s', (path) => {
  async function openList(count = 42) {
    const rows = mockReadingRows(count);
    await router.replace(path + '?category=手撕');
    await settle();
    return rows;
  }
  it('默认20条，追加去重直至结束；详情和历史返回保留已加载批次', async () => {
    const rows = await openList();
    expect(wrapper.findAll('.question-link')).toHaveLength(20);
    expect(wrapper.find('.pagination-footer').exists()).toBe(false);
    expect(wrapper.find('[aria-label="每页题目数量"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('已加载 20／42 题');
    await click('继续加载');
    expect(wrapper.findAll('.question-link')).toHaveLength(40);
    const calls = vi.mocked(cloud.list).mock.calls.length;
    vi.mocked(cloud.detail).mockResolvedValue({ question: rows[25]!, occurrences: [] });
    await click(rows[25]!.title);
    await click('关闭题目详情');
    expect(wrapper.findAll('.question-link')).toHaveLength(40);
    expect(cloud.list).toHaveBeenCalledTimes(calls);
    expect(router.currentRoute.value.query.category).toBe('手撕');
    await router.back();
    await settle();
    expect(router.currentRoute.value.params.id).toBe(rows[25]!.id);
    await router.forward();
    await settle();
    expect(wrapper.findAll('.question-link')).toHaveLength(40);
    expect(cloud.list).toHaveBeenCalledTimes(calls);
    await click('继续加载');
    expect(wrapper.findAll('.question-link')).toHaveLength(42);
    expect(wrapper.text()).toContain('已加载 42／42 题');
    expect(wrapper.text()).toContain('已全部加载');
    expect(button('继续加载')).toBeUndefined();
  });
  it('距离底部240px触发一次追加，请求期间重复滚动不重复发起请求', async () => {
    const rows = await openList(40);
    const body = document.querySelector<HTMLElement>(
      '.n-data-table-base-table-body .n-scrollbar-container',
    )!;
    Object.defineProperties(body, { clientHeight: { value: 500 }, scrollHeight: { value: 2000 } });
    body.scrollTop = 1260;
    let resolve!: (value: ListResult) => void;
    vi.mocked(cloud.list).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    body.dispatchEvent(new Event('scroll'));
    body.dispatchEvent(new Event('scroll'));
    await settle();
    expect(vi.mocked(cloud.list).mock.calls.filter(([query]) => query.page === 2)).toHaveLength(1);
    resolve({
      items: rows.slice(20),
      total: 40,
      page: 2,
      pageSize: 20,
      usedCompanyIds: [company.id],
    });
    await settle();
    expect(wrapper.findAll('.question-link')).toHaveLength(40);
  });
  it('后续失败保留列表并重试，不清空已加载内容', async () => {
    await openList(40);
    vi.mocked(cloud.list).mockRejectedValueOnce(new Error('追加失败'));
    await click('继续加载');
    expect(wrapper.findAll('.question-link')).toHaveLength(20);
    expect(wrapper.text()).toContain('加载失败，重试');
    expect(wrapper.text()).not.toContain('暂时无法加载数据');
    await click('加载失败，重试');
    expect(wrapper.findAll('.question-link')).toHaveLength(40);
  });
  it('改变条件取消旧追加请求，保留工具栏，只接收新首批', async () => {
    const rows = await openList(40);
    let resolveOld!: (value: ListResult) => void;
    let oldSignal: AbortSignal | undefined;
    vi.mocked(cloud.list).mockImplementationOnce((_query, signal) => {
      oldSignal = signal;
      return new Promise((done) => {
        resolveOld = done;
      });
    });
    await click('继续加载');
    vi.mocked(cloud.list).mockResolvedValue({
      items: [{ ...q, id: 'new-filter', title: '新分类题目', category: '算法' }],
      total: 1,
      page: 1,
      pageSize: 20,
      usedCompanyIds: [company.id],
    });
    await router.replace(path + '?category=算法');
    await settle();
    expect(oldSignal?.aborted).toBe(true);
    resolveOld({ items: rows.slice(20), total: 40, page: 2, pageSize: 20, usedCompanyIds: [] });
    await settle();
    expect(wrapper.findAll('.question-link')).toHaveLength(1);
    expect(wrapper.text()).toContain('新分类题目');
    expect(wrapper.text()).not.toContain('并发题目 21');
    expect(button('继续加载')).toBeUndefined();
  });
  it('从列表底部切换条件时不把旧阅读锚点恢复到新分类，不意外加载下一批', async () => {
    await openList(40);
    const body = document.querySelector<HTMLElement>(
      '.n-data-table-base-table-body .n-scrollbar-container',
    )!;
    Object.defineProperties(body, {
      clientHeight: { value: 500 },
      scrollHeight: { value: 5000 },
      scrollTo: {
        configurable: true,
        value: (options: ScrollToOptions) => {
          if (options.top !== undefined) body.scrollTop = options.top;
          if (options.left !== undefined) body.scrollLeft = options.left;
        },
      },
    });
    body.scrollTop = 900;
    body.scrollLeft = 50;
    let resolve!: (value: ListResult) => void;
    vi.mocked(cloud.list).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await router.replace(path + '?category=算法');
    await settle();
    expect(body.scrollTop).toBe(0);
    resolve({
      items: [{ ...q, id: 'new-category', title: '新分类题目' }],
      total: 50,
      page: 1,
      pageSize: 20,
      usedCompanyIds: [],
    });
    await settle();
    expect(body.scrollTop).toBe(0);
    expect(body.scrollLeft).toBe(0);
    expect(
      vi.mocked(cloud.list).mock.calls.filter(([query]) => query.category === '算法'),
    ).toHaveLength(1);
  });
  it('修改后顺序刷新已有批次；记录减少导致页码回退时重新加载首批', async () => {
    await openList(40);
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
    vi.mocked(cloud.list).mockResolvedValue({
      items: [q],
      total: 1,
      page: 1,
      pageSize: 20,
      usedCompanyIds: [company.id],
    });
    await client.invalidateQueries({ queryKey: ['mianjing'] });
    await settle();
    expect(wrapper.findAll('.question-link')).toHaveLength(1);
    expect(wrapper.text()).toContain('已全部加载');
    expect(button('继续加载')).toBeUndefined();
  });
});

describe('首页窄屏连续加载', () => {
  it('使用页面滚动判断底部，窗口滚动时串行追加，不误用横向表格容器高度', async () => {
    await router.push('/login');
    await settle();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    vi.stubGlobal('innerHeight', 500);
    const scrollWindow = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const root = document.documentElement;
    const heightDescriptor = Object.getOwnPropertyDescriptor(root, 'scrollHeight');
    const clientDescriptor = Object.getOwnPropertyDescriptor(root, 'clientHeight');
    Object.defineProperties(root, {
      scrollHeight: { configurable: true, value: 1500 },
      clientHeight: { configurable: true, value: 500 },
    });
    root.scrollTop = 0;
    try {
      mockReadingRows(40);
      await router.push('/questions?category=手撕');
      await settle();
      expect(wrapper.findAll('.question-link')).toHaveLength(20);
      root.scrollTop = 760;
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await settle();
      expect(wrapper.findAll('.question-link')).toHaveLength(40);
      expect(vi.mocked(cloud.list).mock.calls.filter(([query]) => query.page === 2)).toHaveLength(
        1,
      );
      expect(wrapper.text()).toContain('已全部加载');
    } finally {
      scrollWindow.mockRestore();
      root.scrollTop = 0;
      if (heightDescriptor) Object.defineProperty(root, 'scrollHeight', heightDescriptor);
      else Reflect.deleteProperty(root, 'scrollHeight');
      if (clientDescriptor) Object.defineProperty(root, 'clientHeight', clientDescriptor);
      else Reflect.deleteProperty(root, 'clientHeight');
    }
  });
});
