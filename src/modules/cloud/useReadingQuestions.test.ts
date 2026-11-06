import { describe, it, expect } from 'vitest';
import { nextReadingPage, readingConditions, uniqueReadingRows } from './useReadingQuestions';
import { emptyFilters } from '@/modules/questions/model';
import type { ListResult, Question } from './types';

const page = (ids: string[], current: number, total: number): ListResult => ({
  items: ids.map((id) => ({ id }) as Question),
  page: current,
  total,
  pageSize: 20,
  usedCompanyIds: [],
});
describe('共享连续加载规则', () => {
  it('查询键保留筛选条件和批量数量，忽略旧分页page', () => {
    const filters = { ...emptyFilters, page: 9, search: '并发', company: 'a' };
    expect(readingConditions(filters, 50)).toEqual({
      search: '并发',
      category: '',
      company: 'a',
      mastery: '',
      organized: '',
      sort: 'priority',
      pageSize: 50,
    });
  });
  it('跨批次按ID去重，保持首次出现的顺序和数据', () => {
    const first = page(['a', 'b'], 1, 3);
    const second = page(['b', 'c'], 2, 3);
    expect(uniqueReadingRows([first, second])).toEqual([...first.items, second.items[1]]);
  });
  it('按服务器总数决定下一批，到底后停止', () => {
    expect(nextReadingPage(page(['a'], 1, 42), [], 1)).toBe(2);
    expect(nextReadingPage(page(['a'], 3, 42), [], 3)).toBeUndefined();
  });
  it('空结果和页码被服务器回退时不循环请求', () => {
    expect(nextReadingPage(page([], 1, 0), [], 1)).toBeUndefined();
    expect(nextReadingPage(page(['a'], 1, 1), [], 3)).toBeUndefined();
  });
});
