import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRepository, STORAGE_KEY } from './repository';
import { createSeed } from './seed';
import type { QuestionCreateInput, QuestionOccurrenceInput } from '@/shared/types/domain';
import { parseSnapshot } from '@/shared/api/validation';
import {
  companyNames,
  occurrenceCount,
  selectQuestions,
  emptyFilters,
} from '@/modules/questions/model';
import { localDay } from '@/shared/utils/dates';
import { quickOccurrenceInput } from '@/modules/questions/quickOccurrence';

class MemoryStorage implements Storage {
  items = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('quota');
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}
let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});

describe('快速记录一次出现', () => {
  it('一次写入新增一个来源和一条出现，更新公司筛选与搜索，备份恢复后计数不变', async () => {
    const repo = createMockRepository(storage);
    const before = await repo.getSnapshot();
    const write = vi.spyOn(storage, 'setItem');
    const experience = await repo.addExperience(
      quickOccurrenceInput('q-1', {
        company: '  快速录入公司  ',
        content: '  独特变形问法\n追问细节  ',
      }),
    );
    expect(write).toHaveBeenCalledOnce();
    const after = await repo.getSnapshot();
    expect(after.questions).toEqual(before.questions);
    expect(after.reviews).toEqual(before.reviews);
    expect(after.experiences).toHaveLength(before.experiences.length + 1);
    expect(after.occurrences.slice(0, -1)).toEqual(before.occurrences);
    expect(after.occurrences.at(-1)).toMatchObject({
      questionId: 'q-1',
      experienceId: experience.id,
      wording: '独特变形问法\n追问细节',
      followups: '',
    });
    expect(experience).toMatchObject({
      company: '快速录入公司',
      round: '',
      role: '',
      original: '',
      source: '',
      interviewDate: null,
    });
    expect(experience).not.toHaveProperty('recruitmentType');
    expect(occurrenceCount(after, after.questions[0]!)).toBe(
      occurrenceCount(before, before.questions[0]!) + 1,
    );
    expect(
      selectQuestions(after, {
        ...emptyFilters,
        company: '快速录入公司',
        search: '追问细节',
      }).items.map((q) => q.id),
    ).toEqual(['q-1']);
    const backup = parseSnapshot(JSON.parse(await repo.exportRaw()));
    const restored = createMockRepository(new MemoryStorage());
    await restored.restore(backup);
    expect(await restored.getSnapshot()).toEqual(after);
  });

  it('相同公司和内容再次保存独立计次，不合并或改动旧记录', async () => {
    const repo = createMockRepository(storage);
    const before = await repo.getSnapshot();
    const input = quickOccurrenceInput('q-1', { company: '美团', content: '同一公司的相同问法' });
    const first = await repo.addExperience(input);
    const second = await repo.addExperience(input);
    const after = await repo.getSnapshot();
    expect(first.id).not.toBe(second.id);
    expect(after.occurrences).toHaveLength(before.occurrences.length + 2);
    expect(occurrenceCount(after, after.questions[0]!)).toBe(
      occurrenceCount(before, before.questions[0]!) + 2,
    );
    expect(after.experiences.slice(0, -2)).toEqual(before.experiences);
    expect(after.occurrences.slice(0, -2)).toEqual(before.occurrences);
  });

  it('题目不存在或写入失败时不留下部分来源，输入可原样重试', async () => {
    const repo = createMockRepository(storage);
    await repo.getSnapshot();
    const before = await repo.exportRaw();
    await expect(
      repo.addExperience(quickOccurrenceInput('missing', { company: '公司', content: '内容' })),
    ).rejects.toThrow('题目不存在');
    expect(await repo.exportRaw()).toBe(before);
    const draft = { company: '公司', content: '未保存的内容' };
    storage.failWrites = true;
    await expect(repo.addExperience(quickOccurrenceInput('q-1', draft))).rejects.toThrow(
      '存储失败',
    );
    expect(await repo.exportRaw()).toBe(before);
    expect(draft).toEqual({ company: '公司', content: '未保存的内容' });
    storage.failWrites = false;
    await repo.addExperience(quickOccurrenceInput('q-1', draft));
    expect((await repo.getSnapshot()).occurrences).toHaveLength(
      createSeed().occurrences.length + 1,
    );
  });
});

describe('题目列表快捷修改', () => {
  it('公司标签独立增改删和清空，不改变来源、明细、旧答案及次数', async () => {
    const repo = createMockRepository(storage);
    const before = await repo.getSnapshot();
    const q = before.questions[0]!;
    const write = vi.spyOn(storage, 'setItem');
    await repo.updateQuestionMeta(q.id, { companyTags: [' 美团 ', '快手', '美团'] });
    expect(write).toHaveBeenCalledOnce();
    const after = await repo.getSnapshot();
    expect(companyNames(after, after.questions[0]!)).toEqual(['美团', '快手']);
    expect(after.questions[0]).toEqual({
      ...q,
      companyTags: ['美团', '快手'],
      updatedAt: expect.any(String),
    });
    expect(after.experiences).toEqual(before.experiences);
    expect(after.occurrences).toEqual(before.occurrences);
    expect(occurrenceCount(after, after.questions[0]!)).toBe(occurrenceCount(before, q));
    expect(
      selectQuestions(after, { ...emptyFilters, company: '腾讯' }).items.map((x) => x.id),
    ).not.toContain(q.id);
    expect(
      selectQuestions(after, { ...emptyFilters, search: '快手' }).items.map((x) => x.id),
    ).toContain(q.id);
    await repo.updateQuestionMeta(q.id, { companyTags: [] });
    const empty = await repo.getSnapshot();
    expect(companyNames(empty, empty.questions[0]!)).toEqual([]);
    expect(empty.questions[0]!.historicalCompanies).toEqual(q.historicalCompanies);
    expect(empty.experiences[0]!.company).toBe('腾讯');
  });
  it('新增出现自动补回已删除的公司标签，和新来源、明细一次写入；旧数据仍自动推导', async () => {
    const repo = createMockRepository(storage);
    await repo.getSnapshot();
    await repo.updateQuestionMeta('q-1', { companyTags: [] });
    const before = await repo.getSnapshot();
    const write = vi.spyOn(storage, 'setItem');
    const input = {
      ...quickOccurrenceInput('q-1', { company: '腾讯', content: '再次出现' }),
      questions: [
        { questionId: 'q-1', wording: '再次出现', followups: '' },
        { questionId: 'q-2', wording: '同场另一题', followups: '' },
      ],
    };
    await repo.addExperience(input);
    expect(write).toHaveBeenCalledOnce();
    const after = await repo.getSnapshot();
    expect(after.questions[0]!.companyTags).toEqual(['腾讯']);
    expect(after.questions[1]).not.toHaveProperty('companyTags');
    expect(companyNames(after, after.questions[1]!)).toContain('腾讯');
    expect(after.occurrences).toHaveLength(before.occurrences.length + 2);
    await repo.addExperience(quickOccurrenceInput('q-1', { company: '腾讯', content: '再一次' }));
    expect((await repo.getSnapshot()).questions[0]!.companyTags).toEqual(['腾讯']);
    const raw = await repo.exportRaw();
    storage.failWrites = true;
    await expect(
      repo.addExperience(quickOccurrenceInput('q-1', { company: '美团', content: '保存失败' })),
    ).rejects.toThrow('存储失败');
    expect(await repo.exportRaw()).toBe(raw);
  });
  it('总次数只调整历史累计，保留所有明细；保存时使用最新明细数', async () => {
    const repo = createMockRepository(storage);
    const before = await repo.getSnapshot();
    await repo.updateQuestionMeta('q-1', { totalCount: 14 });
    let after = await repo.getSnapshot();
    expect(after.questions[0]!.historicalCount).toBe(13);
    expect(occurrenceCount(after, after.questions[0]!)).toBe(14);
    expect(after.occurrences).toEqual(before.occurrences);
    await repo.updateQuestionMeta('q-1', { totalCount: 1 });
    expect((await repo.getSnapshot()).questions[0]!.historicalCount).toBe(0);
    await repo.addExperience(
      quickOccurrenceInput('q-1', { company: '腾讯', content: '保存前新增了明细' }),
    );
    const raw = await repo.exportRaw();
    await expect(
      repo.updateQuestionMeta('q-1', { totalCount: 1, companyTags: ['不能留下的标签'] }),
    ).rejects.toThrow('已有 2 条逐次记录');
    expect(await repo.exportRaw()).toBe(raw);
    after = await repo.getSnapshot();
    const noRecords = after.questions.find(
      (q) => !after.occurrences.some((o) => o.questionId === q.id),
    )!;
    await repo.updateQuestionMeta(noRecords.id, { totalCount: 0 });
    expect(
      (await repo.getSnapshot()).questions.find((q) => q.id === noRecords.id)!.historicalCount,
    ).toBe(0);
  });
  it('状态修改保留其他字段与复习日期，不生成复习记录', async () => {
    const seed = createSeed();
    seed.questions[0]!.notes = '历史答案';
    seed.questions[0]!.nextReview = '2026-11-10';
    const repo = createMockRepository(storage);
    await repo.restore(seed);
    await repo.updateQuestionMeta('q-1', { mastery: '熟练', organized: false });
    const after = await repo.getSnapshot();
    expect(after.questions[0]).toEqual({
      ...seed.questions[0],
      mastery: '熟练',
      organized: false,
      updatedAt: expect.any(String),
    });
    expect(after.reviews).toEqual(seed.reviews);
    expect(after.occurrences).toEqual(seed.occurrences);
    await repo.updateQuestionMeta('q-1', { totalCount: 20 });
    expect((await repo.getSnapshot()).questions[0]).toMatchObject({
      mastery: '熟练',
      organized: false,
      notes: '历史答案',
      nextReview: '2026-11-10',
    });
  });
  it('无效题目和存储失败不留下部分修改，输入不被归一化过程改写', async () => {
    const repo = createMockRepository(storage);
    await repo.getSnapshot();
    const raw = await repo.exportRaw();
    await expect(repo.updateQuestionMeta('missing', { organized: true })).rejects.toThrow(
      '题目不存在',
    );
    const input = {
      companyTags: [' 美团 ', '美团'],
      mastery: '熟练' as const,
      organized: false,
      totalCount: 10,
    };
    storage.failWrites = true;
    await expect(repo.updateQuestionMeta('q-1', input)).rejects.toThrow('存储失败');
    expect(await repo.exportRaw()).toBe(raw);
    expect(input.companyTags).toEqual([' 美团 ', '美团']);
    storage.failWrites = false;
    await repo.updateQuestionMeta('q-1', input);
    expect((await repo.getSnapshot()).questions[0]).toMatchObject({
      companyTags: ['美团'],
      mastery: '熟练',
      organized: false,
      historicalCount: 9,
    });
  });
  it('旧备份不迁移，新字段和明确清空可导出恢复，非法标签不能覆盖数据', async () => {
    const repo = createMockRepository(storage);
    const legacy = await repo.getSnapshot();
    expect(legacy.questions.every((q) => q.companyTags === undefined)).toBe(true);
    await repo.updateQuestionMeta('q-1', { companyTags: [], totalCount: 3 });
    await repo.updateQuestionMeta('q-2', { companyTags: ['自定义公司'] });
    const backup = parseSnapshot(JSON.parse(await repo.exportRaw()));
    const restored = createMockRepository(new MemoryStorage());
    await restored.restore(backup);
    expect(await restored.getSnapshot()).toEqual(backup);
    expect(companyNames(backup, backup.questions[0]!)).toEqual([]);
    expect(backup.version).toBe(1);
    const raw = await repo.exportRaw();
    for (const tags of [null, [''], ['x'.repeat(101)]]) {
      const invalid = structuredClone(backup);
      (invalid.questions[0] as { companyTags: unknown }).companyTags = tags;
      await expect(repo.restore(invalid)).rejects.toThrow('公司标签');
      expect(await repo.exportRaw()).toBe(raw);
    }
  });
});

describe('独立编辑逐次问法', () => {
  it('一次写入只更新选中记录，同题不同公司及同场其他题目保持独立，搜索读取新问法', async () => {
    const repo = createMockRepository(storage);
    await repo.getSnapshot();
    await repo.addExperience({
      company: '美团',
      recruitmentType: '暑期',
      role: '',
      round: '二面',
      interviewDate: null,
      source: '',
      original: '',
      questions: [{ questionId: 'q-1', wording: '另一公司的独立变形', followups: '' }],
    });
    const before = await repo.getSnapshot();
    const write = vi.spyOn(storage, 'setItem');
    const input = {
      wording: '新的事件循环变形问法',
      followups: '增加异步嵌套追问',
      questionId: 'q-4',
      experienceId: 'e-2',
    };
    const saved = await repo.updateOccurrence('o-1', input);
    expect(write).toHaveBeenCalledTimes(1);
    expect(saved).toEqual({
      ...before.occurrences[0],
      wording: input.wording,
      followups: input.followups,
    });
    const after = await repo.getSnapshot();
    expect(after.questions).toEqual(before.questions);
    expect(after.experiences).toEqual(before.experiences);
    expect(after.occurrences.filter((o) => o.id !== 'o-1')).toEqual(
      before.occurrences.filter((o) => o.id !== 'o-1'),
    );
    expect(after.occurrences).toHaveLength(before.occurrences.length);
    expect(occurrenceCount(after, after.questions[0]!)).toBe(
      occurrenceCount(before, before.questions[0]!),
    );
    expect(
      selectQuestions(after, { ...emptyFilters, search: '腾讯 异步嵌套' }).items.map((q) => q.id),
    ).toEqual(['q-1']);
    expect(
      selectQuestions(after, { ...emptyFilters, search: '美团 独立变形' }).items.map((q) => q.id),
    ).toEqual(['q-1']);
    expect(
      selectQuestions(after, { ...emptyFilters, search: 'Promise 和 setTimeout 的打印顺序是什么' })
        .total,
    ).toBe(0);
  });

  it('无效 ID、字段类型及超长输入不能留下部分修改', async () => {
    const repo = createMockRepository(storage);
    await repo.getSnapshot();
    const before = await repo.exportRaw();
    await expect(repo.updateOccurrence('missing', { wording: '', followups: '' })).rejects.toThrow(
      '不存在',
    );
    for (const invalid of [
      null,
      { wording: '' },
      { wording: 1, followups: '' },
      { wording: '', followups: 'x'.repeat(200001) },
    ]) {
      await expect(
        repo.updateOccurrence('o-1', invalid as QuestionOccurrenceInput),
      ).rejects.toThrow();
    }
    expect(await repo.exportRaw()).toBe(before);
  });

  it('存储失败保留原记录和输入，可重试或清空两个文本字段', async () => {
    const repo = createMockRepository(storage);
    await repo.getSnapshot();
    const before = await repo.exportRaw();
    const input = { wording: '待重试的变形', followups: '待重试的追问' };
    storage.failWrites = true;
    await expect(repo.updateOccurrence('o-1', input)).rejects.toThrow('存储失败');
    expect(await repo.exportRaw()).toBe(before);
    expect(input).toEqual({ wording: '待重试的变形', followups: '待重试的追问' });
    storage.failWrites = false;
    expect(await repo.updateOccurrence('o-1', input)).toMatchObject(input);
    expect(await repo.updateOccurrence('o-1', { wording: '', followups: '' })).toMatchObject({
      wording: '',
      followups: '',
    });
  });

  it('旧答案不再参与搜索，题目信息和问法修改后导出恢复仍完整保留旧答案及引用', async () => {
    const seed = createSeed();
    seed.questions[0]!.notes = '仅存在于历史答案的独特内容';
    const repo = createMockRepository(storage);
    await repo.restore(seed);
    expect(
      selectQuestions(seed, { ...emptyFilters, search: '仅存在于历史答案的独特内容' }).total,
    ).toBe(0);
    await repo.saveQuestion(
      { ...seed.questions[0]!, title: '新的标准标题', category: '场景题', tags: ['新标签'] },
      'q-1',
    );
    await repo.updateOccurrence('o-1', { wording: '新的实际问法', followups: '' });
    const backup = parseSnapshot(JSON.parse(await repo.exportRaw()));
    const restored = createMockRepository(new MemoryStorage());
    await restored.restore(backup);
    const fresh = await restored.getSnapshot();
    expect(fresh).toEqual(backup);
    expect(fresh.questions[0]).toMatchObject({
      notes: seed.questions[0]!.notes,
      title: '新的标准标题',
      category: '场景题',
      tags: ['新标签'],
    });
    expect(fresh.occurrences[0]).toMatchObject({
      id: 'o-1',
      questionId: 'q-1',
      experienceId: 'e-1',
      wording: '新的实际问法',
    });
  });
});

describe('题库搜索与计数', () => {
  it('跨公司、标签、追问匹配所有关键词，忽略英文大小写', () => {
    const data = createSeed();
    const result = selectQuestions(data, { ...emptyFilters, search: '腾讯 PROMISE 微任务' });
    expect(result.items.map((q) => q.id)).toEqual(['q-1']);
    expect(selectQuestions(data, { ...emptyFilters, search: '腾讯 不存在的词' }).total).toBe(0);
    expect(selectQuestions(data, { ...emptyFilters, search: '并发 任务取消' }).total).toBe(0);
  });
  it('对多个条件求交集，正确排序与限制越界页码', () => {
    const data = createSeed();
    const result = selectQuestions(data, {
      ...emptyFilters,
      category: '八股',
      mastery: '模糊',
      company: '腾讯',
      organized: 'true',
    });
    expect(result.items.map((q) => q.id)).toEqual(['q-1']);
    const last = selectQuestions(data, { ...emptyFilters, sort: 'count', page: 99 }, 10);
    expect(last.page).toBe(2);
    expect(last.items).toHaveLength(6);
    const q = data.questions[0]!;
    expect(occurrenceCount(data, q)).toBe(8);
    expect(companyNames(data, q)).toEqual(['腾讯', '百度']);
  });
});

describe('持久化与完整业务流程', () => {
  it('新增题目 → 关联来源和追问 → 修改掌握程度 → 刷新读取', async () => {
    const repo = createMockRepository(storage);
    const q = await repo.saveQuestion({
      title: '测试题',
      category: '手撕',
      tags: ['Promise'],
      priority: '高',
      mastery: '不会',
      organized: false,
      notes: '## 思路\n独立完成',
    });
    await repo.addExperience({
      company: '测试公司',
      role: '前端',
      round: '二面',
      interviewDate: null,
      source: '',
      original: '',
      questions: [{ questionId: q.id, wording: '实现 Promise.all', followups: '如何处理失败？' }],
    });
    await repo.updateQuestionMeta(q.id, { mastery: '基本掌握' });
    const fresh = await createMockRepository(storage).getSnapshot();
    const saved = fresh.questions.find((item) => item.id === q.id)!;
    expect(saved.notes).toContain('思路');
    expect(saved.mastery).toBe('基本掌握');
    expect(saved.nextReview).toBeNull();
    expect(occurrenceCount(fresh, saved)).toBe(1);
    expect(fresh.reviews).toEqual([]);
    expect(selectQuestions(fresh, { ...emptyFilters, search: '测试公司 失败' }).items[0]?.id).toBe(
      q.id,
    );
  });
  it('拒绝重复题目关联和无效引用，失败时不写入半篇面经', async () => {
    const repo = createMockRepository(storage);
    await repo.getSnapshot();
    const before = storage.getItem(STORAGE_KEY);
    const relation = { questionId: 'q-1', wording: '', followups: '' };
    const base = {
      company: '公司',
      role: '',
      round: '',
      interviewDate: null,
      source: '',
      original: '',
    };
    await expect(repo.addExperience({ ...base, questions: [relation, relation] })).rejects.toThrow(
      '重复关联',
    );
    await expect(
      repo.addExperience({ ...base, questions: [{ ...relation, questionId: 'missing' }] }),
    ).rejects.toThrow('不存在');
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });
  it('备份恢复保留所有关联，非法备份不覆盖当前内容', async () => {
    const repo = createMockRepository(storage);
    await repo.getSnapshot();
    const legacy = createSeed();
    legacy.reviews = [
      {
        id: 'legacy-review',
        questionId: 'q-1',
        mastery: '模糊',
        note: '历史复习内容',
        createdAt: '2026-10-01T12:00:00.000Z',
      },
    ];
    legacy.questions[0]!.nextReview = '2026-10-03';
    await repo.restore(legacy);
    const raw = await repo.exportRaw();
    const backup = parseSnapshot(JSON.parse(raw));
    const other = createMockRepository(new MemoryStorage());
    await other.restore(backup);
    expect(await other.getSnapshot()).toEqual(backup);
    await other.updateQuestionMeta('q-1', { mastery: '熟练' });
    const edited = await other.getSnapshot();
    expect(edited.reviews).toEqual(legacy.reviews);
    expect(edited.questions[0]!.nextReview).toBe('2026-10-03');
    const invalid = structuredClone(backup);
    invalid.occurrences[0]!.questionId = 'missing';
    await expect(repo.restore(invalid)).rejects.toThrow('不存在');
    expect(await repo.exportRaw()).toBe(raw);
    const duplicate = structuredClone(backup);
    duplicate.questions.push({ ...duplicate.questions[0]! });
    expect(() => parseSnapshot(duplicate)).toThrow('重复 ID');
  });
  it('损坏数据可导出原文，不自动重置；磁盘写入失败保留旧内容', async () => {
    storage.setItem(STORAGE_KEY, '{broken');
    const repo = createMockRepository(storage);
    await expect(repo.getSnapshot()).rejects.toThrow('未覆盖原数据');
    expect(await repo.exportRaw()).toBe('{broken');
    await repo.reset();
    const old = await repo.exportRaw();
    storage.failWrites = true;
    const q = (await repo.getSnapshot()).questions[0]!;
    await expect(repo.saveQuestion({ ...q, title: '不应该保存' }, q.id)).rejects.toThrow(
      '存储失败',
    );
    expect(await repo.exportRaw()).toBe(old);
  });
  it('历史次数不能通过普通编辑覆盖', async () => {
    const repo = createMockRepository(storage);
    const before = (await repo.getSnapshot()).questions[0]!;
    const updated = await repo.saveQuestion(
      { ...before, historicalCount: 999, title: '更新标题' } as typeof before,
      before.id,
    );
    expect(updated.historicalCount).toBe(before.historicalCount);
  });
});
describe('历史日期校验', () => {
  it('保持本地日历日期格式，拒绝备份中的无效日期', () => {
    expect(localDay(new Date(2026, 9, 27, 0, 1))).toBe('2026-10-27');
    const bad = createSeed();
    bad.experiences[0]!.interviewDate = '2026-02-30';
    expect(() => parseSnapshot(bad)).toThrow('日期');
  });
});

describe('新增题目与可选面试来源', () => {
  const question = {
    title: '带面试背景的题目',
    category: '手撕' as const,
    tags: ['Promise'],
    priority: '中' as const,
    mastery: '模糊' as const,
    organized: false,
    notes: '',
  };
  const source = {
    company: '  新公司  ',
    recruitmentType: '秋招' as const,
    round: '二面' as const,
  };

  it('无来源只创建题目，所有状态在刷新后仍可读取', async () => {
    const repo = createMockRepository(storage);
    const before = await repo.getSnapshot();
    const q = await repo.createQuestion(question);
    const after = await createMockRepository(storage).getSnapshot();
    expect(after.questions).toHaveLength(before.questions.length + 1);
    expect(after.experiences).toEqual(before.experiences);
    expect(after.occurrences).toEqual(before.occurrences);
    expect(after.questions.find((item) => item.id === q.id)).toMatchObject({
      notes: '',
      organized: false,
    });
  });

  it('一次写入保存题目、来源及出现明细，并支持公司筛选', async () => {
    const repo = createMockRepository(storage);
    const before = await repo.getSnapshot();
    const writes = vi.spyOn(storage, 'setItem');
    const q = await repo.createQuestion({ ...question, source });
    expect(writes).toHaveBeenCalledTimes(1);
    const after = await createMockRepository(storage).getSnapshot();
    expect(after.experiences).toHaveLength(before.experiences.length + 1);
    expect(after.experiences.at(-1)).toMatchObject({
      company: '新公司',
      recruitmentType: '秋招',
      round: '二面',
      interviewDate: null,
    });
    expect(after.occurrences.at(-1)).toMatchObject({
      questionId: q.id,
      experienceId: after.experiences.at(-1)!.id,
    });
    expect(occurrenceCount(after, q)).toBe(1);
    expect(companyNames(after, q)).toEqual(['新公司']);
    expect(
      selectQuestions(after, { ...emptyFilters, company: '新公司' }).items.map((item) => item.id),
    ).toEqual([q.id]);
  });

  it.each([
    { company: '公司' },
    { company: ' ', recruitmentType: '暑期', round: '一面' },
    { company: '公司', recruitmentType: '社招', round: '一面' },
    { company: '公司', recruitmentType: '暑期', round: '四面' },
    { company: '公司', recruitmentType: '暑期' },
    { company: '公'.repeat(101), recruitmentType: '暑期', round: '一面' },
  ])('不完整或无效来源不能留下部分记录：%j', async (invalid) => {
    const repo = createMockRepository(storage);
    await repo.getSnapshot();
    const before = await repo.exportRaw();
    await expect(
      repo.createQuestion({ ...question, source: invalid } as QuestionCreateInput),
    ).rejects.toThrow();
    expect(await repo.exportRaw()).toBe(before);
  });

  it('存储失败时题目和来源全部不保存，同一输入可重试', async () => {
    const repo = createMockRepository(storage);
    await repo.getSnapshot();
    const before = await repo.exportRaw();
    const input = { ...question, source };
    storage.failWrites = true;
    await expect(repo.createQuestion(input)).rejects.toThrow('存储失败');
    expect(await repo.exportRaw()).toBe(before);
    expect(input.source).toEqual(source);
    storage.failWrites = false;
    const q = await repo.createQuestion(input);
    expect(occurrenceCount(await repo.getSnapshot(), q)).toBe(1);
  });

  it('相同公司与轮次的独立录入不会自动合并，编辑笔记不重复记录来源', async () => {
    const repo = createMockRepository(storage);
    const before = await repo.getSnapshot();
    const first = await repo.createQuestion({ ...question, source });
    const second = await repo.createQuestion({ ...question, title: '另一道题', source });
    await repo.saveQuestion({ ...first, notes: '补充答案', organized: true }, first.id);
    const after = await repo.getSnapshot();
    expect(after.experiences).toHaveLength(before.experiences.length + 2);
    expect(after.experiences.at(-1)!.id).not.toBe(after.experiences.at(-2)!.id);
    expect(occurrenceCount(after, first)).toBe(1);
    expect(occurrenceCount(after, second)).toBe(1);
    expect(after.questions.find((q) => q.id === first.id)!.notes).toBe('补充答案');
  });

  it('旧备份不补造招聘类型，新备份恢复保留来源，非法招聘类型不覆盖数据', async () => {
    const legacy = createSeed();
    expect(parseSnapshot(legacy)).toEqual(legacy);
    const repo = createMockRepository(storage);
    await repo.restore(legacy);
    expect((await repo.getSnapshot()).experiences[0]).not.toHaveProperty('recruitmentType');
    const q = await repo.createQuestion({ ...question, source });
    const backup = parseSnapshot(JSON.parse(await repo.exportRaw()));
    const restored = createMockRepository(new MemoryStorage());
    await restored.restore(backup);
    const fresh = await restored.getSnapshot();
    expect(fresh).toEqual(backup);
    expect(occurrenceCount(fresh, q)).toBe(1);
    const invalid = structuredClone(backup);
    (invalid.experiences.at(-1)! as { recruitmentType?: string }).recruitmentType = '未知';
    const before = await repo.exportRaw();
    await expect(repo.restore(invalid)).rejects.toThrow('招聘类型');
    expect(await repo.exportRaw()).toBe(before);
  });
});
