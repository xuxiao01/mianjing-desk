import { describe, expect, it } from 'vitest';
import { emptyFilters } from '@/modules/questions/model';
import { activeFilterChips, clearedFilters, filterCount, questionFilterQuery } from './filterModel';
describe('共享筛选模型', () => {
  it('整理false是生效条件；筛选计数不含关键词分类排序', () => {
    const filters = {
      ...emptyFilters,
      search: '关键词',
      category: '八股',
      sort: 'count',
      company: 'id',
      mastery: '不会',
      organized: 'false',
    };
    expect(filterCount(filters)).toBe(3);
    expect(activeFilterChips(filters, '腾讯')).toEqual([
      { key: 'search', label: '关键词', value: '关键词' },
      { key: 'company', label: '公司', value: '腾讯' },
      { key: 'mastery', label: '掌握程度', value: '不会' },
      { key: 'organized', label: '整理状态', value: '待整理' },
    ]);
  });
  it('空白搜索不生成标签，无条件不生成标签行', () => {
    expect(activeFilterChips({ ...emptyFilters, search: '  ' }, '')).toEqual([]);
    expect(filterCount(emptyFilters)).toBe(0);
  });
  it('批量清除保留分类排序数量并去除页码，不修改输入', () => {
    const filters = {
      ...emptyFilters,
      search: '原文',
      company: 'id',
      mastery: '不会',
      organized: 'true',
      category: '手撕',
      sort: 'count',
      page: 4,
    };
    expect(questionFilterQuery(filters, 50, clearedFilters)).toEqual({
      category: '手撕',
      sort: 'count',
      pageSize: '50',
    });
    expect(filters.page).toBe(4);
    expect(filters.search).toBe('原文');
  });
  it('单项移除保持其他条件，翻页不自动回到首页，改变数量则重置', () => {
    const filters = { ...emptyFilters, company: 'id', mastery: '不会', page: 2 };
    expect(questionFilterQuery(filters, 20, { company: '' })).toEqual({ mastery: '不会' });
    expect(questionFilterQuery(filters, 20, { page: 3 })).toEqual({
      company: 'id',
      mastery: '不会',
      page: '3',
    });
    expect(questionFilterQuery(filters, 20, { pageSize: 10 })).toEqual({
      company: 'id',
      mastery: '不会',
      pageSize: '10',
    });
  });
});
