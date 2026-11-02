import { getCompanyCatalog } from '@/shared/utils/companyCatalog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_DATA_SOURCE', 'api');
});

describe('API 逐次问法编辑协议', () => {
  it('PATCH 正确编码记录 ID，只提交两项问法字段；无效输入不发送请求', async () => {
    const record = {
      id: 'o/1',
      questionId: 'q-1',
      experienceId: 'e-1',
      wording: '变形',
      followups: '',
    };
    const fetcher = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ success: true, data: record }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetcher);
    const { repository } = await import('./repository');
    const patch = { ...record, questionId: 'q-other' };
    expect(await repository.updateOccurrence('o/1', patch)).toEqual(record);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]![0]).toBe('/api/mianjing/occurrences/o%2F1');
    expect(fetcher.mock.calls[0]![1].method).toBe('PATCH');
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ wording: '变形', followups: '' });
    expect(() =>
      repository.updateOccurrence('o/1', { wording: null, followups: '' } as never),
    ).toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe('API 题目快捷修改', () => {
  it('只提交归一化后的部分字段到 meta 接口，非法输入不发请求', async () => {
    const result = { id: 'q/1', companyTags: ['美团'] };
    const fetcher = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ success: true, data: result }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetcher);
    const { repository } = await import('./repository');
    expect(await repository.updateQuestionMeta('q/1', { companyTags: [' 美团 ', '美团'] })).toEqual(
      result,
    );
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]![0]).toBe('/api/mianjing/questions/q%2F1/meta');
    expect(fetcher.mock.calls[0]![1].method).toBe('PATCH');
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ companyTags: ['美团'] });
    expect(() => repository.updateQuestionMeta('q/1', { totalCount: -1 })).toThrow();
    expect(() => repository.updateQuestionMeta('q/1', { notes: '不允许修改' } as never)).toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const input = {
  title: '请求调度器',
  category: '手撕' as const,
  priority: '中' as const,
  mastery: '模糊' as const,
  tags: [],
  notes: '',
  organized: false,
};
const source = { company: '腾讯', recruitmentType: '暑期' as const, round: '二面' as const };

describe('API 新增题目协议', () => {
  it('将可选来源与题目一次提交到新增接口；普通编辑不包含来源', async () => {
    const fetcher = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ success: true, data: { ...input, id: 'new-id' } }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const { repository } = await import('./repository');
    await repository.createQuestion({ ...input, source });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![0]).toBe('/api/mianjing/questions');
    expect(fetcher.mock.calls[0]![1].method).toBe('POST');
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ ...input, source });
    await repository.saveQuestion(input, 'new-id');
    expect(fetcher.mock.calls[1]![0]).toBe('/api/mianjing/questions/new-id');
    expect(fetcher.mock.calls[1]![1].method).toBe('PATCH');
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual(input);
  });
  it('无来源输入不发送来源对象；无效来源不会发送请求', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { ...input, id: 'new-id' } }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const { repository } = await import('./repository');
    await repository.createQuestion(input);
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).not.toHaveProperty('source');
    expect(() =>
      repository.createQuestion({ ...input, source: { ...source, company: '' } }),
    ).toThrow('来源公司');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('API 公司标签配置', () => {
  it('PUT 提交版本与规范化完整配置，非法数据不发送请求', async () => {
    const result = getCompanyCatalog();
    result.revision = 1;
    const fetcher = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ success: true, data: result }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetcher);
    const { repository } = await import('./repository');
    const items = getCompanyCatalog().items;
    items[0]!.name = ' 新公司名 ';
    expect(await repository.saveCompanyCatalog({ expectedRevision: 0, items })).toEqual(result);
    expect(fetcher.mock.calls[0]![0]).toBe('/api/mianjing/company-catalog');
    expect(fetcher.mock.calls[0]![1].method).toBe('PUT');
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toMatchObject({
      expectedRevision: 0,
      items: [{ id: 'company-byte', name: '新公司名' }, ...items.slice(1)],
    });
    expect(() => repository.saveCompanyCatalog({ expectedRevision: -1, items })).toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
