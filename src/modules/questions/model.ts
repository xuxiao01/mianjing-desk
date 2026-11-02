import { getCompanyCatalog, canonicalCompany } from '@/shared/utils/companyCatalog';
import type { DeskSnapshot, PageResult, Question, QuestionFilters } from '@/shared/types/domain';

export const emptyFilters: QuestionFilters = {
  search: '',
  category: '',
  company: '',
  mastery: '',
  organized: '',
  sort: 'priority',
  page: 1,
};
export function questionOccurrences(data: DeskSnapshot, id: string) {
  return data.occurrences.filter((o) => o.questionId === id);
}
export function companyNames(data: DeskSnapshot, q: Question): string[] {
  const canonical = (name: string) => canonicalCompany(getCompanyCatalog(data), name);
  if (q.companyTags !== undefined) return [...new Set(q.companyTags.map(canonical))];
  const experienceIds = new Set(questionOccurrences(data, q.id).map((o) => o.experienceId));
  return [
    ...new Set([
      ...q.historicalCompanies.map(canonical),
      ...data.experiences.filter((x) => experienceIds.has(x.id)).map((x) => canonical(x.company)),
    ]),
  ];
}
export function occurrenceCount(data: DeskSnapshot, q: Question): number {
  return q.historicalCount + questionOccurrences(data, q.id).length;
}
export function priorityScore(q: Question): number {
  return (
    { 高: 3, 中: 2, 低: 1 }[q.priority] * 10 + { 不会: 4, 模糊: 3, 基本掌握: 2, 熟练: 1 }[q.mastery]
  );
}
export function selectQuestions(
  data: DeskSnapshot,
  filters: QuestionFilters,
  pageSize = 10,
): PageResult<Question> {
  const terms = filters.search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const items = data.questions
    .filter((q) => {
      const os = questionOccurrences(data, q.id);
      const text = [
        q.title,
        ...q.tags,
        ...companyNames(data, q),
        ...os.flatMap((o) => [o.wording, o.followups]),
      ]
        .join(' ')
        .toLocaleLowerCase();
      return (
        terms.every((term) => text.includes(term)) &&
        (!filters.category || q.category === filters.category) &&
        (!filters.company ||
          companyNames(data, q).includes(
            canonicalCompany(getCompanyCatalog(data), filters.company),
          )) &&
        (!filters.mastery || q.mastery === filters.mastery) &&
        (!filters.organized || String(q.organized) === filters.organized)
      );
    })
    .sort((a, b) => {
      const titleHits = (q: Question) =>
        terms.filter((term) => q.title.toLocaleLowerCase().includes(term)).length;
      if (terms.length && titleHits(a) !== titleHits(b)) return titleHits(b) - titleHits(a);
      if (filters.sort === 'count')
        return occurrenceCount(data, b) - occurrenceCount(data, a) || a.id.localeCompare(b.id);
      if (filters.sort === 'updated')
        return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
      return (
        priorityScore(b) - priorityScore(a) ||
        occurrenceCount(data, b) - occurrenceCount(data, a) ||
        a.id.localeCompare(b.id)
      );
    });
  const page = Math.max(
    1,
    Math.min(filters.page || 1, Math.max(1, Math.ceil(items.length / pageSize))),
  );
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  };
}
