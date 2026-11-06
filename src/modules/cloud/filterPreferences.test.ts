import { describe, expect, it } from 'vitest';
import {
  FILTER_PREFERENCES_KEY,
  hasFilterQuery,
  normalizeFilterPreferences,
  preferencesFromQuery,
  preferencesQuery,
  readFilterPreferences,
  writeFilterPreferences,
} from './filterPreferences';
const company = '00000000-0000-4000-8000-000000000001';
const defaults = {
  search: '',
  category: '',
  company: '',
  mastery: '',
  organized: '',
  sort: 'priority',
  pageSize: 20,
};
describe('本地筛选偏好', () => {
  it('仅写入白名单条件，完整往返，不记录已加载页、身份和业务内容', () => {
    const values = new Map<string, string>([['mianjing.auth.token', 'untouched']]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const input = {
      ...defaults,
      search: ' 并发 Promise ',
      category: '八股',
      company,
      mastery: '熟练',
      organized: 'false',
      sort: 'count',
      pageSize: 50,
      page: 4,
      id: 'question',
      token: 'secret',
      records: ['private'],
    };
    expect(writeFilterPreferences(input, storage)).toBe(true);
    expect(readFilterPreferences(storage)).toEqual({
      search: ' 并发 Promise ',
      category: '八股',
      company,
      mastery: '熟练',
      organized: 'false',
      sort: 'count',
      pageSize: 50,
    });
    const raw = JSON.parse(values.get(FILTER_PREFERENCES_KEY)!);
    expect(Object.keys(raw).sort()).toEqual(Object.keys(defaults).sort());
    expect(values.get('mianjing.auth.token')).toBe('untouched');
  });
  it('空、损坏和不支持的数据安全回退；有效字段独立恢复', () => {
    for (const raw of [null, '{broken', 'null', '42', '[]', '"text"']) {
      expect(readFilterPreferences({ getItem: () => raw })).toBeNull();
    }
    expect(
      normalizeFilterPreferences({
        search: [],
        category: '未知',
        company: 'invalid',
        mastery: 'invalid',
        organized: true,
        sort: 'invalid',
        pageSize: 100,
      }),
    ).toEqual(defaults);
    expect(preferencesFromQuery({ category: '算法', pageSize: '10', organized: 'true' })).toEqual({
      ...defaults,
      category: '算法',
      pageSize: 10,
      organized: 'true',
    });
  });
  it('显式条件包括空值；仅旧页码或无关参数不覆盖本地设置', () => {
    expect(hasFilterQuery({ search: '' })).toBe(true);
    expect(hasFilterQuery({ pageSize: '20' })).toBe(true);
    expect(hasFilterQuery({ page: '3', unknown: 'x' })).toBe(false);
    expect(preferencesQuery({ ...defaults, category: '八股', sort: 'count' })).toEqual({
      category: '八股',
      sort: 'count',
    });
    expect(preferencesQuery(defaults)).toEqual({});
  });
  it('浏览器禁用存储或容量不足不会抛出错误', () => {
    expect(
      readFilterPreferences({
        getItem: () => {
          throw Error('blocked');
        },
      }),
    ).toBeNull();
    expect(
      writeFilterPreferences(defaults, {
        setItem: () => {
          throw Error('full');
        },
      }),
    ).toBe(false);
  });
});
