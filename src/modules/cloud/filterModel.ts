import type { QuestionFilters } from '@/shared/types/domain';

export type FilterTool = 'company' | 'mastery' | 'organized' | 'sort';
export type FilterChipKey = 'search' | 'company' | 'mastery' | 'organized';
export interface FilterChip {
  key: FilterChipKey;
  label: string;
  value: string;
}
export interface FilterCompany {
  label: string;
  value: string;
}
export type FilterPatch = Partial<
  Record<keyof QuestionFilters | 'pageSize', string | number | null>
>;
export const categoryOptions = [
  { value: '', label: '全部题目' },
  { value: '八股', label: '八股基础' },
  { value: '手撕', label: '手撕代码' },
  { value: '算法', label: '算法练习' },
  { value: '场景题', label: '场景应用' },
] as const;
export const sortOptions = [
  { value: 'priority', label: '优先级' },
  { value: 'count', label: '出现次数' },
  { value: 'updated', label: '最近更新' },
] as const;
export const clearedFilters: FilterPatch = { search: '', company: '', mastery: '', organized: '' };
export function filterCount(filters: QuestionFilters) {
  return [filters.company, filters.mastery, filters.organized].filter(Boolean).length;
}
export function activeFilterChips(filters: QuestionFilters, company: string): FilterChip[] {
  return [
    { key: 'search', label: '关键词', value: filters.search.trim() },
    { key: 'company', label: '公司', value: filters.company ? company : '' },
    { key: 'mastery', label: '掌握程度', value: filters.mastery },
    {
      key: 'organized',
      label: '整理状态',
      value: filters.organized ? (filters.organized === 'true' ? '已整理' : '待整理') : '',
    },
  ].filter((item) => !!item.value) as FilterChip[];
}
export function questionFilterQuery(
  filters: QuestionFilters,
  pageSize: number,
  patch: FilterPatch,
) {
  const next = {
    ...filters,
    pageSize,
    ...Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value ?? ''])),
  };
  if (Object.keys(patch).some((key) => key !== 'page')) next.page = 1;
  return Object.fromEntries(
    Object.entries(next)
      .filter(
        ([key, value]) =>
          value !== '' &&
          !(key === 'page' && value === 1) &&
          !(key === 'pageSize' && value === 20) &&
          !(key === 'sort' && value === 'priority'),
      )
      .map(([key, value]) => [key, String(value)]),
  );
}
