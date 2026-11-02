import { afterEach, describe, it, expect, vi } from 'vitest';
import { cloud } from './api';
import { setAuthentication } from '@/shared/api/http';
const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true, data: {} })));
afterEach(() => {
  vi.unstubAllGlobals();
  fetcher.mockClear();
  setAuthentication(
    () => '',
    () => {},
  );
});
describe('云端接口契约', () => {
  it('列表传递服务端查询和分页，不拉取 snapshot 或 experiences', async () => {
    vi.stubGlobal('fetch', fetcher);
    await cloud.list({
      search: '并发 Promise',
      company: 'id',
      category: '八股',
      mastery: '不会',
      organized: 'true',
      sort: 'count',
      page: 2,
      pageSize: 50,
    });
    const url = new URL(
      (fetcher.mock.calls as unknown as [string, RequestInit][])[0]![0],
      'http://localhost',
    );
    expect(url.pathname).toBe('/api/mianjing/questions');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      search: '并发 Promise',
      company: 'id',
      category: '八股',
      mastery: '不会',
      organized: 'true',
      sort: 'count',
      page: '2',
      pageSize: '50',
    });
  });
  it('来源保留 companyId、招聘与轮次；快速记录和问法编辑只发 content', async () => {
    vi.stubGlobal('fetch', fetcher);
    setAuthentication(
      () => 'test-token',
      () => {},
    );
    await cloud.create({
      title: '并发',
      category: '手撕',
      tags: [],
      priority: '高',
      mastery: '不会',
      organized: false,
      source: { companyId: 'c1', recruitmentType: '暑期', round: '一面' },
    });
    await cloud.record('q1', { companyId: 'c1', content: '实际问法\n追问' });
    await cloud.wording('o1', '更新内容');
    await cloud.meta('q1', { companyIds: [], totalCount: 3 });
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(JSON.parse(calls[0]![1].body as string).source).toEqual({
      companyId: 'c1',
      recruitmentType: '暑期',
      round: '一面',
    });
    expect(calls[1]![0]).toBe('/api/mianjing/questions/q1/occurrences');
    expect(JSON.parse(calls[1]![1].body as string)).toEqual({
      companyId: 'c1',
      content: '实际问法\n追问',
    });
    expect(JSON.parse(calls[2]![1].body as string)).toEqual({ content: '更新内容' });
    expect(JSON.parse(calls[3]![1].body as string)).toEqual({ companyIds: [], totalCount: 3 });
    expect(new Headers(calls[0]![1].headers).get('Authorization')).toBe('Bearer test-token');
  });
  it('全量公司配置只发送后端字段，两个删除接口使用 DELETE', async () => {
    vi.stubGlobal('fetch', fetcher);
    await cloud.saveCatalog({
      items: [{ id: 'c1', name: '腾讯', palette: 'blue', enabled: true, sortOrder: 0 }],
    });
    await cloud.deleteQuestion('q1');
    await cloud.deleteOccurrence('o1');
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(JSON.parse(calls[0]![1].body as string)).toEqual({
      items: [{ id: 'c1', name: '腾讯', palette: 'blue', enabled: true }],
    });
    expect(calls.slice(1).map(([url, options]) => [url, options.method])).toEqual([
      ['/api/mianjing/questions/q1', 'DELETE'],
      ['/api/mianjing/occurrences/o1', 'DELETE'],
    ]);
  });
});
