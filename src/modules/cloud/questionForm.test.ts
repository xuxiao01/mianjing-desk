import { describe, expect, it } from 'vitest';
import { questionPayload } from './questionForm';
import type { QuestionInput } from './types';
const input: QuestionInput = {
  title: '原始题目\n代码与标点',
  category: '手撕',
  tags: ['旧标签'],
  priority: '高',
  mastery: '不会',
  organized: false,
};
describe('共享题目字段提交', () => {
  it('只提交可编辑字段，保留标题原文并沿用知识点拆分规则', () => {
    const source = { ...input, companyIds: ['company'], baseCount: 5, totalCount: 8 };
    expect(questionPayload(source, ' JS， Promise、并发,  ')).toEqual({
      ...input,
      tags: ['JS', 'Promise', '并发'],
    });
    expect(source.tags).toEqual(['旧标签']);
    expect(source.baseCount).toBe(5);
  });
  it('空白标题拒绝，防止新建与原位编辑校验分叉', () => {
    expect(() => questionPayload({ ...input, title: ' \n ' }, '')).toThrow('请填写题目');
  });
});
