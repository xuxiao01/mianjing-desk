import { describe, expect, it } from 'vitest';
import { interviewSourceErrors, normalizeQuestionMetaPatch } from './validation';

describe('可选来源字段反馈', () => {
  it('全空来源允许略过，任一项有内容后逐字段提示缺失值', () => {
    expect(interviewSourceErrors({ company: ' ', recruitmentType: null, round: null })).toEqual({});
    expect(interviewSourceErrors({ company: '腾讯', recruitmentType: null, round: null })).toEqual({
      recruitmentType: '请选择招聘类型',
      round: '请选择面试轮次',
    });
    expect(interviewSourceErrors({ company: '', recruitmentType: '暑期', round: '二面' })).toEqual({
      company: '请选择或输入公司',
    });
    expect(
      interviewSourceErrors({ company: '新公司', recruitmentType: '秋招', round: '三面' }),
    ).toEqual({});
  });
});

describe('题目快捷修改校验', () => {
  it('只保留明确提交的字段，公司去空白去重，允许清空和次数边界', () => {
    const companyTags = [' 腾讯 ', '百度', '腾讯'];
    expect(
      normalizeQuestionMetaPatch({ companyTags, mastery: '熟练', organized: false, totalCount: 0 }),
    ).toEqual({ companyTags: ['腾讯', '百度'], mastery: '熟练', organized: false, totalCount: 0 });
    expect(companyTags).toEqual([' 腾讯 ', '百度', '腾讯']);
    expect(normalizeQuestionMetaPatch({ companyTags: [] })).toEqual({ companyTags: [] });
    expect(normalizeQuestionMetaPatch({ totalCount: Number.MAX_SAFE_INTEGER })).toEqual({
      totalCount: Number.MAX_SAFE_INTEGER,
    });
    expect(normalizeQuestionMetaPatch({ mastery: '不会' })).toEqual({ mastery: '不会' });
  });
  it.each([
    null,
    {},
    { notes: '不能通过快捷编辑修改' },
    { mastery: '一般' },
    { mastery: undefined },
    { organized: 'true' },
    { companyTags: null },
    { companyTags: [null] },
    { companyTags: [' '] },
    { companyTags: ['x'.repeat(101)] },
    { companyTags: Array(1) },
    { totalCount: -1 },
    { totalCount: 1.5 },
    { totalCount: Number.MAX_SAFE_INTEGER + 1 },
    { totalCount: NaN },
    { totalCount: Infinity },
    { totalCount: '2' },
  ])('拒绝无效或越界修改 %#', (input) => {
    expect(() => normalizeQuestionMetaPatch(input)).toThrow();
  });
});
