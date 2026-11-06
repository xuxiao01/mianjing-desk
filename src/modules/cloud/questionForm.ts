import type { QuestionInput } from './types';

export function questionPayload(input: QuestionInput, tags: string): QuestionInput {
  if (!input.title.trim()) throw new Error('请填写题目');
  return {
    title: input.title,
    category: input.category,
    priority: input.priority,
    mastery: input.mastery,
    organized: input.organized,
    tags: tags
      .split(/[,，、]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}
