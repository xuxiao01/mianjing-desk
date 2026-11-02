import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import type { Router } from 'vue-router';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { NMessageProvider, NSelect } from 'naive-ui';
import QuestionsPage from './QuestionsPage.vue';
import { createMockRepository } from '@/mocks/repository';
import type { DeskRepository } from '@/shared/api/contracts';
import type { CompanyCatalogInput } from '@/shared/types/domain';
import type { QuestionMetaPatch } from '@/shared/types/domain';

let repo: DeskRepository;
vi.mock('@/shared/api/repository', () => ({
  repository: {
    getSnapshot: () => repo.getSnapshot(),
    saveCompanyCatalog: (input: CompanyCatalogInput) => repo.saveCompanyCatalog(input),
    updateQuestionMeta: (id: string, input: QuestionMetaPatch) =>
      repo.updateQuestionMeta(id, input),
  },
}));
class MemoryStorage implements Storage {
  items = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.items.get(k) ?? null;
  }
  setItem(k: string, value: string) {
    if (this.failWrites) throw new Error('quota');
    this.items.set(k, value);
  }
  removeItem(k: string) {
    this.items.delete(k);
  }
}
let wrapper: VueWrapper,
  router: Router,
  client: QueryClient,
  host: HTMLDivElement,
  storage: MemoryStorage;
const title = '实现一个有并发限制的请求调度器';
function find(label: string) {
  const dialogs = [...document.querySelectorAll('[role="dialog"]')].reverse();
  return [
    ...dialogs.flatMap((dialog) => [...dialog.querySelectorAll<HTMLButtonElement>('button')]),
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find((b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label);
}
async function click(label: string) {
  const b = find(label);
  if (!b) throw new Error('找不到按钮 ' + label);
  b.click();
  await nextTick();
}
async function input(label: string, value: string) {
  const e = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  e.value = value;
  e.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
async function select(label: string, value: string | number | null) {
  const control = wrapper
    .findAllComponents(NSelect)
    .find((component) => component.attributes('aria-label') === label);
  if (!control) throw new Error('找不到选择框 ' + label);
  control.vm.$emit('update:value', value);
  await nextTick();
}
function mountWorkspace() {
  wrapper = mount(NMessageProvider, {
    attachTo: host,
    slots: { default: () => h(RouterView) },
    global: {
      stubs: { transition: false },
      plugins: [router, [VueQueryPlugin, { queryClient: client }]],
    },
  });
}
beforeEach(async () => {
  // jsdom has no scrolling implementation; exercise the real table with a browser API shim.
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  storage = new MemoryStorage();
  repo = createMockRepository(storage);
  await repo.getSnapshot();
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/questions/:id?', component: QuestionsPage },
      { path: '/reading/:id?', component: QuestionsPage, meta: { immersive: true } },
    ],
  });
  await router.push('/questions');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  host = document.createElement('div');
  document.body.append(host);
  mountWorkspace();
  await router.isReady();
  await vi.waitFor(() => expect(find('编辑' + title + '的掌握程度')).toBeTruthy());
});
afterEach(() => {
  wrapper.unmount();
  client.clear();
  host.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
});

describe('紧凑题库的查询与分页', () => {
  it('部署到子路径后沉浸链接和详情往返保留前缀及查询', async () => {
    wrapper.unmount();
    router = createRouter({
      history: createMemoryHistory('/mianjing/'),
      routes: router.options.routes,
    });
    const query = { search: '并发', pageSize: '50', sort: 'count' };
    await router.push({ path: '/questions', query });
    mountWorkspace();
    await vi.waitFor(() => expect(document.querySelector('.question-link')).toBeTruthy());
    const reading = document.querySelector<HTMLAnchorElement>('a[target="_blank"]')!;
    expect(reading.getAttribute('href')).toBe(router.resolve({ path: '/reading', query }).href);
    expect(reading.getAttribute('href')).toMatch(/^\/mianjing\/reading\?/);
    await router.push({ path: '/reading', query });
    await nextTick();
    document.querySelector<HTMLButtonElement>('.question-link')!.click();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/reading/q-4'));
    expect(router.currentRoute.value.query).toEqual(query);
    expect(router.resolve(router.currentRoute.value.fullPath).href).toMatch(
      /^\/mianjing\/reading\/q-4\?/,
    );
    await vi.waitFor(() => expect(document.querySelector('.n-drawer .n-base-close')).toBeTruthy());
    document.querySelector<HTMLButtonElement>('.n-drawer .n-base-close')!.click();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/reading'));
    expect(router.currentRoute.value.query).toEqual(query);
    expect(document.querySelector<HTMLAnchorElement>('.reading-link')!.href).toContain(
      '/mianjing/questions?',
    );
  });
  it.each(['/questions', '/reading'])(
    '%s 高亮标题和知识点，命中内外点击均保留查询进入详情',
    async (base) => {
      const before = await repo.getSnapshot();
      const query = { search: '并发 PROMISE', pageSize: '50', sort: 'count' };
      await router.push({ path: base, query });
      await vi.waitFor(() => expect(document.querySelectorAll('.question-link')).toHaveLength(1));
      const button = document.querySelector<HTMLButtonElement>('.question-link')!;
      expect(button.textContent).toBe(title);
      expect(button.title).toBe(title);
      expect([...button.querySelectorAll('mark')].map((item) => item.textContent)).toEqual([
        '并发',
      ]);
      expect(
        [...document.querySelectorAll('.question-subline mark')].map((item) => item.textContent),
      ).toEqual(['Promise', '并发']);
      expect(document.querySelector('.question-subline')!.textContent).toBe(
        '手撕 · Promise · 并发控制',
      );
      expect(document.querySelectorAll('.company-chips mark')).toHaveLength(0);
      button.querySelector<HTMLElement>('mark')!.click();
      await vi.waitFor(() => expect(router.currentRoute.value.path).toBe(base + '/q-4'));
      expect(router.currentRoute.value.query).toEqual(query);
      await vi.waitFor(() => expect(document.querySelector('.question-detail')).toBeTruthy());
      expect(document.querySelectorAll('.question-detail mark')).toHaveLength(0);
      document.querySelector<HTMLButtonElement>('.n-drawer .n-base-close')!.click();
      await vi.waitFor(() => expect(router.currentRoute.value.path).toBe(base));
      document.querySelector<HTMLElement>('.question-title .search-highlight')!.click();
      await vi.waitFor(() => expect(router.currentRoute.value.path).toBe(base + '/q-4'));
      expect(router.currentRoute.value.query).toEqual(query);
      expect(await repo.getSnapshot()).toEqual(before);
    },
  );

  it('清空查询和浏览器前进后退同步高亮，空白不高亮', async () => {
    await router.push('/reading?search=并发');
    await vi.waitFor(() =>
      expect(document.querySelector('.question-title mark')?.textContent).toBe('并发'),
    );
    await router.push('/reading?search=原型');
    await vi.waitFor(() =>
      expect(document.querySelector('.question-title mark')?.textContent).toBe('原型'),
    );
    router.back();
    await vi.waitFor(() =>
      expect(document.querySelector('.question-title mark')?.textContent).toBe('并发'),
    );
    router.forward();
    await vi.waitFor(() =>
      expect(document.querySelector('.question-title mark')?.textContent).toBe('原型'),
    );
    const search = document.querySelector<HTMLInputElement>('.search-input input')!;
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(router.currentRoute.value.query.search).toBeUndefined());
    expect(document.querySelectorAll('.questions-table mark')).toHaveLength(0);
    await router.push({ path: '/reading', query: { search: ' \t ' } });
    await nextTick();
    expect(document.querySelectorAll('.question-link')).toHaveLength(16);
    expect(document.querySelectorAll('.questions-table mark')).toHaveLength(0);
  });

  it.each(['腾讯', '打印顺序是什么'])(
    '仅公司或实际问法命中 %s 时照常返回，不强行高亮或显示摘要',
    async (search) => {
      await router.push({ path: '/questions', query: { search } });
      await nextTick();
      expect(document.querySelectorAll('.question-link').length).toBeGreaterThan(0);
      expect(document.querySelectorAll('.questions-table mark')).toHaveLength(0);
      expect(document.querySelector('.search-excerpt')).toBeNull();
    },
  );

  it('浏览器全屏切换、Escape退出同步状态；拒绝全屏不影响沉浸阅读或数据', async () => {
    const before = await repo.getSnapshot();
    wrapper.unmount();
    host.replaceChildren();
    let active: Element | null = null;
    const sync = (element: Element | null) => {
      active = element;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    const enter = vi.fn(async () => sync(document.documentElement));
    const exit = vi.fn(async () => sync(null));
    const properties: [object, string, PropertyDescriptor][] = [
      [document, 'fullscreenEnabled', { value: true }],
      [document, 'fullscreenElement', { get: () => active }],
      [document, 'exitFullscreen', { value: exit }],
      [document.documentElement, 'requestFullscreen', { value: enter }],
    ];
    const restore = properties.map(([target, name]) => ({
      target,
      name,
      descriptor: Object.getOwnPropertyDescriptor(target, name),
    }));
    onTestFinished(() =>
      restore.forEach(({ target, name, descriptor }) => {
        if (descriptor) Object.defineProperty(target, name, descriptor);
        else Reflect.deleteProperty(target, name);
      }),
    );
    properties.forEach(([target, name, descriptor]) =>
      Object.defineProperty(target, name, { ...descriptor, configurable: true }),
    );
    mountWorkspace();
    await router.push('/reading');
    await click('进入全屏');
    await vi.waitFor(() => expect(find('退出全屏')).toBeTruthy());
    expect(enter).toHaveBeenCalledOnce();
    sync(null); // Native Escape changes the browser state rather than invoking the app button.
    await nextTick();
    expect(find('进入全屏')).toBeTruthy();
    await click('进入全屏');
    await click('退出全屏');
    expect(exit).toHaveBeenCalledOnce();
    enter.mockRejectedValueOnce(new Error('Fullscreen denied'));
    await click('进入全屏');
    await vi.waitFor(() => expect(document.body.textContent).toContain('暂时无法切换全屏'));
    expect(router.currentRoute.value.path).toBe('/reading');
    expect(find('进入全屏')).toBeTruthy();
    expect(await repo.getSnapshot()).toEqual(before);
  });

  it('沉浸入口使用安全的新标签页链接，完整保留当前查询', async () => {
    const query = {
      category: '八股',
      company: '腾讯',
      mastery: '模糊',
      sort: 'count',
      pageSize: '10',
    };
    await router.replace({ path: '/questions', query });
    await nextTick();
    const link = document.querySelector<HTMLAnchorElement>(
      'a[aria-label="在新标签页打开沉浸阅读"]',
    )!;
    expect(link.getAttribute('href')).toBe(router.resolve({ path: '/reading', query }).href);
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(router.currentRoute.value.path).toBe('/questions');
  });

  it('沉浸模式的详情、重置和返回题库均使用正确地址并保留分页', async () => {
    const before = await repo.getSnapshot();
    const query = { pageSize: '10', page: '2', sort: 'count' };
    await router.push({ path: '/reading', query });
    await vi.waitFor(() => expect(document.querySelector('h1')!.textContent).toBe('沉浸题库'));
    expect(document.querySelectorAll('.question-link')).toHaveLength(6);
    expect(document.querySelector('a[target="_blank"]')).toBeNull();
    const returnLink = document.querySelector<HTMLAnchorElement>('.reading-link')!;
    expect(returnLink.getAttribute('href')).toBe(
      router.resolve({ path: '/questions', query }).href,
    );
    document.querySelector<HTMLButtonElement>('.question-link')!.click();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toMatch(/^\/reading\/q-/));
    expect(router.currentRoute.value.query).toEqual(query);
    await vi.waitFor(() => expect(document.querySelector('.n-drawer .n-base-close')).toBeTruthy());
    document.querySelector<HTMLButtonElement>('.n-drawer .n-base-close')!.click();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/reading'));
    expect(router.currentRoute.value.query).toEqual(query);
    await click('更多筛选');
    await click('重置筛选');
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/reading?pageSize=10'));
    document.querySelector<HTMLAnchorElement>('.reading-link')!.click();
    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/questions?pageSize=10'),
    );
    expect(await repo.getSnapshot()).toEqual(before);
  });

  it('默认每页20条，切换数量回第一页并保留其他条件', async () => {
    expect(document.querySelectorAll('.question-link')).toHaveLength(16);
    expect(document.querySelector('.page-size-select')?.textContent).toContain('20 条/页');
    await select('每页题目数量', 10);
    await vi.waitFor(() => expect(router.currentRoute.value.query.pageSize).toBe('10'));
    expect(document.querySelectorAll('.question-link')).toHaveLength(10);
    await router.replace('/questions?pageSize=10&page=2&sort=count');
    await vi.waitFor(() => expect(document.querySelectorAll('.question-link')).toHaveLength(6));
    await select('每页题目数量', 50);
    await vi.waitFor(() =>
      expect(router.currentRoute.value.query).toEqual({ pageSize: '50', sort: 'count' }),
    );
    expect(document.querySelectorAll('.question-link')).toHaveLength(16);
    await select('每页题目数量', 20);
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ sort: 'count' }));
  });

  it.each(['0', '-10', '15', '20.5', 'Infinity', '10&pageSize=50'])(
    '非法每页数量 %s 回退20条',
    async (query) => {
      await router.replace('/questions?pageSize=' + query);
      await nextTick();
      expect(document.querySelectorAll('.question-link')).toHaveLength(16);
      expect(document.querySelector('.page-size-select')?.textContent).toContain('20 条/页');
    },
  );

  it('更多筛选即时生效，Escape返回触发按钮；重置保留每页数量', async () => {
    await router.replace('/questions?pageSize=10');
    await click('八股基础');
    await select('筛选公司', '腾讯');
    await vi.waitFor(() => expect(router.currentRoute.value.query.company).toBe('腾讯'));
    await select('筛选掌握程度', '模糊');
    await vi.waitFor(() => expect(router.currentRoute.value.query.mastery).toBe('模糊'));
    await click('更多筛选');
    await vi.waitFor(() => expect(document.querySelector('.question-more-filters')).toBeTruthy());
    await select('筛选整理状态', 'true');
    await vi.waitFor(() => expect(router.currentRoute.value.query.organized).toBe('true'));
    expect(document.querySelectorAll('.question-link')).toHaveLength(1);
    expect(find('更多筛选 · 1')?.classList.contains('active')).toBe(true);
    document
      .querySelector('.question-more-filters')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(document.querySelector('.more-filters')?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(document.querySelector('.more-filters'));
    expect(router.currentRoute.value.query.organized).toBe('true');
    await click('更多筛选 · 1');
    await click('重置筛选');
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ pageSize: '10' }));
    expect(document.querySelectorAll('.question-link')).toHaveLength(10);
  });

  it('问法能搜索但只在详情显示，详情往返保留查询及每页数量', async () => {
    const before = await repo.getSnapshot();
    const occurrence = before.occurrences.find((item) => item.wording.trim())!;
    const question = before.questions.find((item) => item.id === occurrence.questionId)!;
    const query = { search: occurrence.wording, pageSize: '50', sort: 'updated' };
    await router.replace({ path: '/questions', query });
    await vi.waitFor(() => expect(document.querySelectorAll('.question-link')).toHaveLength(1));
    expect(document.querySelector('.questions-table')!.textContent).not.toContain(
      occurrence.wording,
    );
    expect(document.querySelector('.search-excerpt')).toBeNull();
    await click(question.title);
    await vi.waitFor(() => expect(router.currentRoute.value.params.id).toBe(question.id));
    await vi.waitFor(() => expect(document.querySelector('.question-detail')).toBeTruthy());
    expect(document.querySelector('.question-detail')!.textContent).toContain(occurrence.wording);
    expect(
      find(
        '编辑' +
          before.experiences.find((item) => item.id === occurrence.experienceId)!.company +
          '的这次问法',
      ),
    ).toBeTruthy();
    document.querySelector<HTMLButtonElement>('.n-drawer .n-base-close')!.click();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/questions'));
    expect(router.currentRoute.value.query).toEqual(query);
    expect(await repo.getSnapshot()).toEqual(before);
  });

  it('页码越界以及编辑后末页消失均校正为有效页码', async () => {
    await router.replace('/questions?pageSize=10&page=99&sort=count');
    await vi.waitFor(() => expect(router.currentRoute.value.query.page).toBe('2'));
    expect(document.querySelectorAll('.question-link')).toHaveLength(6);
    const snapshot = await repo.getSnapshot();
    snapshot.questions.forEach((question, index) => {
      question.organized = index < 11;
    });
    await repo.restore(snapshot);
    await client.invalidateQueries({ queryKey: ['desk', 'snapshot'] });
    await router.replace('/questions?pageSize=10&page=2&organized=true');
    await vi.waitFor(() => expect(document.querySelectorAll('.question-link')).toHaveLength(1));
    const lastTitle = document
      .querySelector<HTMLButtonElement>('.question-link')!
      .getAttribute('title')!;
    await click('切换' + lastTitle + '的整理状态');
    await vi.waitFor(() => expect(router.currentRoute.value.query.page).toBeUndefined());
    expect(document.querySelectorAll('.question-link')).toHaveLength(10);
    expect((await repo.getSnapshot()).occurrences).toEqual(snapshot.occurrences);
  });

  it('斜杠聚焦搜索，关键词输入返回第一页并保留每页数量', async () => {
    await router.replace('/questions?pageSize=10&page=2');
    await vi.waitFor(() => expect(document.querySelectorAll('.question-link')).toHaveLength(6));
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }),
    );
    const search = document.querySelector<HTMLInputElement>('.search-input input')!;
    expect(document.activeElement).toBe(search);
    search.value = title;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() =>
      expect(router.currentRoute.value.query).toEqual({ search: title, pageSize: '10' }),
    );
    expect(document.querySelectorAll('.question-link')).toHaveLength(1);
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ pageSize: '10' }));
  });
});

describe('列表点击编辑与共享数据刷新', () => {
  it('首次明确保存默认公司配色会持久化目录，且不会改写题目或来源', async () => {
    const before = await repo.getSnapshot();
    await click('编辑' + title + '的公司标签：腾讯');
    await click('管理公司标签');
    await vi.waitFor(() => expect(find('保存配置')).toBeTruthy());
    await click('保存配置');
    await vi.waitFor(() => expect(find('保存配置')).toBeUndefined());
    const after = await repo.getSnapshot();
    expect(after.companyCatalog?.revision).toBe(1);
    expect(after.companyCatalog?.items.find((item) => item.name === '百度')?.palette).toBe('white');
    expect(after.companyCatalog?.items.find((item) => item.name === '腾讯')?.palette).toBe('blue');
    expect(after.companyCatalog?.items.find((item) => item.name === '智谱')?.palette).toBe('black');
    expect(after).toEqual({ ...before, companyCatalog: after.companyCatalog });
  });
  it('管理配置失败保留草稿，重试改名换色后返回原题目标签草稿，不误保存题目选择', async () => {
    const before = await repo.getSnapshot();
    await click('编辑' + title + '的公司标签：腾讯');
    await click('腾讯');
    await click('管理公司标签');
    await vi.waitFor(() => expect(find('编辑公司百度')).toBeTruthy());
    await click('编辑公司百度');
    await input('配置公司名称', '百度科技');
    await click('红');
    await click('确认修改');
    storage.failWrites = true;
    await click('保存配置');
    await vi.waitFor(() =>
      expect(document.querySelector('.catalog-error')?.textContent).toContain('存储失败'),
    );
    expect(document.querySelector('.catalog-list')!.textContent).toContain('百度科技');
    expect((await repo.getSnapshot()).companyCatalog).toBeUndefined();
    storage.failWrites = false;
    await click('保存配置');
    await vi.waitFor(() => expect(find('百度科技')?.getAttribute('aria-pressed')).toBe('true'));
    expect(find('腾讯')?.getAttribute('aria-pressed')).toBe('false');
    const after = await repo.getSnapshot();
    expect(after.questions.find((q) => q.id === 'q-4')!.companyTags).toBeUndefined();
    expect(after.occurrences).toEqual(before.occurrences);
    expect(
      find('编辑' + title + '的公司标签：百度科技')!.style.getPropertyValue('--company-color'),
    ).toBe('#FFFFFF');
    await click('取消');
    await vi.waitFor(() => expect(find('继续编辑')).toBeTruthy());
    await click('继续编辑');
    await vi.waitFor(() => expect(find('继续编辑')).toBeUndefined());
    expect(find('百度科技')?.getAttribute('aria-pressed')).toBe('true');
    await click('取消');
    await click('放弃修改');
    await vi.waitFor(() =>
      expect(document.querySelector('[aria-label="编辑公司标签"]')).toBeNull(),
    );
    expect(
      (await repo.getSnapshot()).questions.find((q) => q.id === 'q-4')!.companyTags,
    ).toBeUndefined();
  });

  it('掌握程度选中后自动保存，当前筛选中的行可正常移出；不增加复习', async () => {
    await router.replace('/questions?mastery=不会');
    await nextTick();
    const before = await repo.getSnapshot();
    await click('编辑' + title + '的掌握程度');
    await vi.waitFor(() => expect(document.querySelector('[role="menuitemradio"]')).toBeTruthy());
    const option = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')].find(
      (e) => e.textContent?.includes('熟练'),
    )!;
    option.click();
    await vi.waitFor(() => expect(find('编辑' + title + '的掌握程度')).toBeUndefined());
    const after = await repo.getSnapshot();
    expect(after.questions.find((q) => q.id === 'q-4')!.mastery).toBe('熟练');
    expect(after.reviews).toEqual(before.reviews);
    expect(after.questions.find((q) => q.id === 'q-4')!.nextReview).toBe(
      before.questions.find((q) => q.id === 'q-4')!.nextReview,
    );
  });
  it('公司标签保存后刷新筛选，移出该公司筛选但保留原始来源与次数', async () => {
    await router.replace('/questions?company=腾讯');
    await nextTick();
    const before = await repo.getSnapshot();
    await click('编辑' + title + '的公司标签：腾讯');
    await vi.waitFor(() => expect(find('腾讯')?.getAttribute('aria-pressed')).toBe('true'));
    await click('腾讯');
    await click('保存');
    await vi.waitFor(() => expect(find('编辑' + title + '的出现次数')).toBeUndefined());
    const after = await repo.getSnapshot();
    expect(after.questions.find((q) => q.id === 'q-4')!.companyTags).toEqual(['百度', '字节跳动']);
    expect(after.occurrences).toEqual(before.occurrences);
    expect(after.experiences).toEqual(before.experiences);
    expect(after.questions.find((q) => q.id === 'q-4')!.historicalCount).toBe(
      before.questions.find((q) => q.id === 'q-4')!.historicalCount,
    );
  });
  it('次数修改成功刷新排序，关闭编辑弹窗', async () => {
    await router.replace('/questions?sort=count');
    await nextTick();
    await click('编辑' + title + '的出现次数');
    await vi.waitFor(() =>
      expect(document.querySelector('input[aria-label="总次数"]')).toBeTruthy(),
    );
    await input('总次数', '30');
    await click('保存');
    await vi.waitFor(() =>
      expect(document.querySelector('.question-link')!.textContent).toBe(title),
    );
    expect(document.querySelector('[aria-label="修改出现次数"]')).toBeNull();
    expect((await repo.getSnapshot()).questions.find((q) => q.id === 'q-4')!.historicalCount).toBe(
      29,
    );
  });
  it('保存期间禁用该行所有快捷操作，失败不改变原状态，可重试切换整理状态', async () => {
    const original = repo.updateQuestionMeta.bind(repo);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const update = vi
      .spyOn(repo, 'updateQuestionMeta')
      .mockImplementationOnce(async (id, patch) => {
        await gate;
        return original(id, patch);
      });
    await click('切换' + title + '的整理状态');
    expect(find('编辑' + title + '的出现次数')!.disabled).toBe(true);
    expect(find('编辑' + title + '的掌握程度')!.disabled).toBe(true);
    await click('切换' + title + '的整理状态');
    await click('编辑' + title + '的公司标签：腾讯');
    storage.failWrites = true;
    release();
    await vi.waitFor(() => expect(document.body.textContent).toContain('存储失败'));
    expect(update).toHaveBeenCalledOnce();
    expect((await repo.getSnapshot()).questions.find((q) => q.id === 'q-4')!.organized).toBe(false);
    expect(find('切换' + title + '的整理状态')!.disabled).toBe(false);
    storage.failWrites = false;
    await click('切换' + title + '的整理状态');
    await vi.waitFor(() =>
      expect(find('切换' + title + '的整理状态')!.getAttribute('aria-pressed')).toBe('true'),
    );
    expect((await repo.getSnapshot()).reviews).toHaveLength(0);
  });
});
