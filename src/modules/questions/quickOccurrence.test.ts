import { describe, expect, it } from 'vitest';
import { quickOccurrenceErrors, quickOccurrenceInput } from './quickOccurrence';

describe('快速出现记录输入', () => {
  it.each([
    { company: '', content: '内容' },
    { company: '  ', content: '内容' },
    { company: '公司', content: '' },
    { company: '公司', content: ' \n ' },
    { company: '公'.repeat(101), content: '内容' },
    { company: '公司', content: 'x'.repeat(200001) },
  ])('拒绝空白及超出长度的公司或内容：%j', (draft) => {
    expect(Object.keys(quickOccurrenceErrors(draft)).length).toBeGreaterThan(0);
    expect(() => quickOccurrenceInput('q-1', draft)).toThrow();
  });

  it('去除首尾空白并保留内部换行，只生成当前题目的一条关联', () => {
    expect(
      quickOccurrenceInput('q-1', { company: '  自定义公司  ', content: '  实际问法\n追加追问  ' }),
    ).toEqual({
      company: '自定义公司',
      role: '',
      round: '',
      interviewDate: null,
      source: '',
      original: '',
      questions: [{ questionId: 'q-1', wording: '实际问法\n追加追问', followups: '' }],
    });
    expect(() => quickOccurrenceInput('', { company: '公司', content: '内容' })).toThrow(
      '题目不存在',
    );
    const boundary = { company: '公'.repeat(100), content: 'x'.repeat(200000) };
    expect(quickOccurrenceErrors(boundary)).toEqual({});
    expect(quickOccurrenceInput('q-1', boundary).questions[0]!.wording).toHaveLength(200000);
  });
});
