import type { ExperienceInput } from '@/shared/types/domain';

export interface QuickOccurrenceDraft {
  company: string;
  content: string;
}

export function quickOccurrenceErrors(input: QuickOccurrenceDraft) {
  const errors: Partial<Record<keyof QuickOccurrenceDraft, string>> = {};
  if (!input.company.trim()) errors.company = '请选择或输入公司';
  else if (input.company.trim().length > 100) errors.company = '公司名称不能超过 100 字';
  if (!input.content.trim()) errors.content = '请填写这次问的内容';
  else if (input.content.trim().length > 200000) errors.content = '内容不能超过 200000 字符';
  return errors;
}

export function quickOccurrenceInput(
  questionId: string,
  input: QuickOccurrenceDraft,
): ExperienceInput {
  const errors = quickOccurrenceErrors(input);
  if (errors.company || errors.content) throw new Error(errors.company || errors.content);
  if (!questionId.trim()) throw new Error('关联题目不存在，请重新打开题目');
  return {
    company: input.company.trim(),
    role: '',
    round: '',
    interviewDate: null,
    source: '',
    original: '',
    questions: [{ questionId, wording: input.content.trim(), followups: '' }],
  };
}
