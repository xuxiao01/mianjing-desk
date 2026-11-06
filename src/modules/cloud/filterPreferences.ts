import { categories, masteries, type QuestionFilters } from '@/shared/types/domain';
import { emptyFilters } from '@/modules/questions/model';
import { questionFilterQuery } from './filterModel';

export const FILTER_PREFERENCES_KEY = 'mianjing.filters.v1';
const preferenceKeys = [
  'search',
  'category',
  'company',
  'mastery',
  'organized',
  'sort',
  'pageSize',
] as const;
export type FilterPreferences = Pick<
  QuestionFilters,
  'search' | 'category' | 'company' | 'mastery' | 'organized' | 'sort'
> & { pageSize: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function normalizeFilterPreferences(value: unknown): FilterPreferences | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const text = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : '');
  const size =
    typeof input.pageSize === 'number' || typeof input.pageSize === 'string'
      ? Number(input.pageSize)
      : 20;
  return {
    search: text('search'),
    category: (categories as readonly string[]).includes(text('category')) ? text('category') : '',
    company: uuid.test(text('company').trim()) ? text('company').trim() : '',
    mastery: (masteries as readonly string[]).includes(text('mastery')) ? text('mastery') : '',
    organized: ['true', 'false'].includes(text('organized')) ? text('organized') : '',
    sort: ['priority', 'count', 'updated'].includes(text('sort')) ? text('sort') : 'priority',
    pageSize: [10, 20, 50].includes(size) ? size : 20,
  };
}
export function hasFilterQuery(query: Record<string, unknown>) {
  return preferenceKeys.some((key) => Object.hasOwn(query, key));
}
export function preferencesFromQuery(query: Record<string, unknown>): FilterPreferences {
  return normalizeFilterPreferences(query)!;
}
export function readFilterPreferences(
  storage?: Pick<Storage, 'getItem'>,
): FilterPreferences | null {
  try {
    const raw = (storage || localStorage).getItem(FILTER_PREFERENCES_KEY);
    return raw === null ? null : normalizeFilterPreferences(JSON.parse(raw));
  } catch {
    return null;
  }
}
export function writeFilterPreferences(
  value: FilterPreferences,
  storage?: Pick<Storage, 'setItem'>,
): boolean {
  try {
    (storage || localStorage).setItem(
      FILTER_PREFERENCES_KEY,
      JSON.stringify(normalizeFilterPreferences(value)),
    );
    return true;
  } catch {
    return false;
  }
}
export function preferencesQuery(value: FilterPreferences) {
  return questionFilterQuery({ ...emptyFilters, ...value }, value.pageSize, {});
}
