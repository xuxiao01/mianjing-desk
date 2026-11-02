import {
  getCompanyCatalog,
  normalizeCatalogInput,
  normalizeCatalogItems,
  canonicalCompany,
} from '@/shared/utils/companyCatalog';
import type { DeskRepository } from '@/shared/api/contracts';
import type { DeskSnapshot, Question, QuestionInput } from '@/shared/types/domain';
import {
  parseSnapshot,
  validateExperience,
  validateQuestion,
  validateQuestionCreate,
  validateQuestionOccurrence,
  normalizeCompanyTags,
  normalizeQuestionMetaPatch,
} from '@/shared/api/validation';
import { createSeed } from './seed';

export const STORAGE_KEY = 'mianjing-desk:demo:v1';
export function createMockRepository(storage: Storage = localStorage): DeskRepository {
  function write(data: DeskSnapshot) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      throw new Error('浏览器存储失败：可能空间不足或存储被禁用。输入仍保留，请先导出备份。');
    }
  }
  function read(): DeskSnapshot {
    let raw: string | null;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch {
      throw new Error('无法访问浏览器存储，请允许此站点使用本地存储。');
    }
    if (raw === null) {
      const data = createSeed();
      write(data);
      return data;
    }
    try {
      return parseSnapshot(JSON.parse(raw));
    } catch {
      throw new Error('本地演示数据无法读取，未覆盖原数据。请到数据管理导出原始备份后恢复或重置。');
    }
  }
  function commit<T>(change: (data: DeskSnapshot) => T): T {
    const data = read();
    const result = change(data);
    write(data);
    return result;
  }
  function upsertQuestion(data: DeskSnapshot, input: QuestionInput, id?: string): Question {
    const existing = id ? data.questions.find((q) => q.id === id) : undefined;
    if (id && !existing) throw new Error('题目不存在');
    const stamp = new Date().toISOString();
    const q = {
      ...(existing || {
        id: crypto.randomUUID(),
        historicalCount: 0,
        historicalCompanies: [],
        createdAt: stamp,
        nextReview: null,
      }),
      title: input.title.trim(),
      category: input.category,
      priority: input.priority,
      mastery: input.mastery,
      organized: input.organized,
      notes: input.notes,
      tags: [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))],
      updatedAt: stamp,
    };
    if (existing) data.questions[data.questions.findIndex((item) => item.id === id)] = q;
    else data.questions.push(q);
    return q;
  }
  return {
    async saveCompanyCatalog(input) {
      const payload = normalizeCatalogInput(input);
      return commit((data) => {
        const previous = getCompanyCatalog(data);
        if (previous.revision !== payload.expectedRevision)
          throw new Error('公司标签配置已在其他页面更新，请重新加载配置后重试。草稿仍保留。');
        if (previous.items.some((old) => !payload.items.some((item) => item.id === old.id)))
          throw new Error('已有公司请使用停用，不能删除配置');
        const items = normalizeCatalogItems(
          payload.items.map((item) => {
            const old = previous.items.find((x) => x.id === item.id);
            return {
              ...item,
              aliases: [
                ...item.aliases,
                ...(old?.aliases || []),
                ...(old && old.name !== item.name ? [old.name] : []),
              ].filter((name) => name !== item.name),
            };
          }),
        );
        const renames = new Map<string, string>();
        for (const old of previous.items) {
          const next = items.find((item) => item.id === old.id)!;
          if (old.name !== next.name)
            for (const name of [old.name, ...old.aliases]) renames.set(name, next.name);
        }
        const rename = (name: string) => renames.get(name.trim()) || name;
        for (const q of data.questions) {
          const historical = [...new Set(q.historicalCompanies.map(rename))];
          const tags = q.companyTags?.map(rename);
          if (
            JSON.stringify(historical) !== JSON.stringify(q.historicalCompanies) ||
            (tags && JSON.stringify(tags) !== JSON.stringify(q.companyTags))
          ) {
            q.historicalCompanies = historical;
            if (tags) q.companyTags = [...new Set(tags)];
            q.updatedAt = new Date().toISOString();
          }
        }
        for (const x of data.experiences) x.company = rename(x.company);
        data.companyCatalog = { revision: previous.revision + 1, items };
        return data.companyCatalog;
      });
    },
    async getSnapshot(signal) {
      signal?.throwIfAborted();
      return read();
    },
    async createQuestion(input) {
      validateQuestionCreate(input);
      return commit((data) => {
        const q = upsertQuestion(data, input);
        if (input.source) {
          const experienceId = crypto.randomUUID();
          data.experiences.push({
            id: experienceId,
            company: canonicalCompany(getCompanyCatalog(data), input.source.company),
            recruitmentType: input.source.recruitmentType,
            round: input.source.round,
            role: '',
            interviewDate: null,
            source: '',
            original: '',
            createdAt: q.createdAt,
          });
          data.occurrences.push({
            id: crypto.randomUUID(),
            experienceId,
            questionId: q.id,
            wording: '',
            followups: '',
          });
        }
        return q;
      });
    },
    async saveQuestion(input, id) {
      validateQuestion(input);
      return commit((data) => {
        return upsertQuestion(data, input, id);
      });
    },
    async updateQuestionMeta(id, input) {
      const patch = normalizeQuestionMetaPatch(input);
      return commit((data) => {
        const q = data.questions.find((item) => item.id === id);
        if (!q) throw new Error('题目不存在，请刷新后重试');
        if (patch.totalCount !== undefined) {
          const records = data.occurrences.filter((o) => o.questionId === id).length;
          if (patch.totalCount < records)
            throw new Error(`已有 ${records} 条逐次记录，总次数不能低于 ${records}`);
          q.historicalCount = patch.totalCount - records;
        }
        if (patch.companyTags !== undefined)
          q.companyTags = [
            ...new Set(
              patch.companyTags.map((name) => canonicalCompany(getCompanyCatalog(data), name)),
            ),
          ];
        if (patch.mastery !== undefined) q.mastery = patch.mastery;
        if (patch.organized !== undefined) q.organized = patch.organized;
        q.updatedAt = new Date().toISOString();
        return q;
      });
    },
    async updateOccurrence(id, input) {
      validateQuestionOccurrence(input);
      return commit((data) => {
        const occurrence = data.occurrences.find((item) => item.id === id);
        if (!occurrence) throw new Error('出现记录不存在，请刷新后重试');
        occurrence.wording = input.wording;
        occurrence.followups = input.followups;
        return occurrence;
      });
    },
    async addExperience(input) {
      validateExperience(input);
      return commit((data) => {
        if (input.questions.some((q) => !data.questions.some((x) => x.id === q.questionId)))
          throw new Error('关联题目不存在，请刷新后重试');
        const { questions, ...fields } = structuredClone(input);
        const x = {
          ...fields,
          company: canonicalCompany(getCompanyCatalog(data), fields.company),
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        data.experiences.push(x);
        data.occurrences.push(
          ...questions.map((q) => ({ ...q, id: crypto.randomUUID(), experienceId: x.id })),
        );
        for (const relation of questions) {
          const q = data.questions.find((item) => item.id === relation.questionId)!;
          if (q.companyTags !== undefined)
            q.companyTags = normalizeCompanyTags([...q.companyTags, x.company]);
        }
        return x;
      });
    },
    async restore(snapshot) {
      write(parseSnapshot(snapshot));
    },
    async reset() {
      write(createSeed());
    },
    async exportRaw() {
      const raw = storage.getItem(STORAGE_KEY);
      return raw ?? JSON.stringify(read());
    },
  };
}
