import { normalizeCatalogItems, validateCatalogRevision } from '@/shared/utils/companyCatalog';
import {
  categories,
  masteries,
  priorities,
  recruitmentTypes,
  interviewRounds,
} from '@/shared/types/domain';
import type {
  DeskSnapshot,
  ExperienceInput,
  QuestionInput,
  QuestionMetaPatch,
  QuestionCreateInput,
  QuestionOccurrenceInput,
  ReviewRecord,
} from '@/shared/types/domain';
import { isCalendarDay } from '@/shared/utils/dates';

function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('数据格式不正确');
  return v as Record<string, unknown>;
}
function text(v: unknown, name: string, max = 200000): asserts v is string {
  if (typeof v !== 'string' || v.length > max) throw new Error(name + '格式无效或过长');
}
function required(v: unknown, name: string): asserts v is string {
  text(v, name, 10000);
  if (!v.trim()) throw new Error('请填写' + name);
}
function strings(v: unknown) {
  if (
    !Array.isArray(v) ||
    v.length > 100 ||
    !v.every((x) => typeof x === 'string' && x.length <= 100)
  )
    throw new Error('标签格式无效');
}
function timestamp(v: unknown) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(v) || !Number.isFinite(Date.parse(v)))
    throw new Error('记录时间无效');
}
function calendar(v: unknown) {
  if (v !== null && (typeof v !== 'string' || !isCalendarDay(v))) throw new Error('日期格式无效');
}
export function normalizeCompanyTags(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !Array.from(value).every(
      (name) => typeof name === 'string' && name.trim() && name.trim().length <= 100,
    )
  )
    throw new Error('公司标签须为非空名称，每个名称不能超过 100 字');
  return [...new Set(value.map((name) => (name as string).trim()))];
}
export function normalizeQuestionMetaPatch(value: unknown): QuestionMetaPatch {
  const input = object(value);
  const keys = Object.keys(input);
  if (
    !keys.length ||
    keys.some((key) => !['companyTags', 'mastery', 'organized', 'totalCount'].includes(key))
  )
    throw new Error('题目快捷修改字段无效');
  const patch: QuestionMetaPatch = {};
  if (Object.hasOwn(input, 'companyTags'))
    patch.companyTags = normalizeCompanyTags(input.companyTags);
  if (Object.hasOwn(input, 'mastery')) {
    if (!masteries.includes(input.mastery as never)) throw new Error('掌握程度无效');
    patch.mastery = input.mastery as QuestionMetaPatch['mastery'];
  }
  if (Object.hasOwn(input, 'organized')) {
    if (typeof input.organized !== 'boolean') throw new Error('整理状态无效');
    patch.organized = input.organized;
  }
  if (Object.hasOwn(input, 'totalCount')) {
    if (!Number.isSafeInteger(input.totalCount) || (input.totalCount as number) < 0)
      throw new Error('总次数必须是安全范围内的非负整数');
    patch.totalCount = input.totalCount as number;
  }
  return patch;
}
export function validateQuestion(value: unknown): asserts value is QuestionInput {
  const q = object(value);
  required(q.title, '题目');
  if (
    !categories.includes(q.category as never) ||
    !masteries.includes(q.mastery as never) ||
    !priorities.includes(q.priority as never)
  )
    throw new Error('题目分类或状态无效');
  strings(q.tags);
  text(q.notes, '笔记');
  if (typeof q.organized !== 'boolean') throw new Error('整理状态无效');
}
export function interviewSourceErrors(source: {
  company: string;
  recruitmentType: string | null;
  round: string | null;
}) {
  const errors: Partial<Record<'company' | 'recruitmentType' | 'round', string>> = {};
  if (!source.company.trim() && !source.recruitmentType && !source.round) return errors;
  if (!source.company.trim()) errors.company = '请选择或输入公司';
  else if (source.company.trim().length > 100) errors.company = '公司名称不能超过 100 字';
  if (!recruitmentTypes.includes(source.recruitmentType as never))
    errors.recruitmentType = '请选择招聘类型';
  if (!interviewRounds.includes(source.round as never)) errors.round = '请选择面试轮次';
  return errors;
}
export function validateQuestionCreate(value: unknown): asserts value is QuestionCreateInput {
  validateQuestion(value);
  const source = object(value).source;
  if (source === undefined) return;
  const x = object(source);
  required(x.company, '来源公司');
  text(x.company.trim(), '公司名称', 100);
  if (!recruitmentTypes.includes(x.recruitmentType as never)) throw new Error('请选择招聘类型');
  if (!interviewRounds.includes(x.round as never)) throw new Error('请选择面试轮次');
}
export function validateExperience(value: unknown): asserts value is ExperienceInput {
  const x = object(value);
  required(x.company, '公司');
  if (x.recruitmentType !== undefined && !recruitmentTypes.includes(x.recruitmentType as never))
    throw new Error('招聘类型无效');
  for (const key of ['role', 'round', 'source', 'original']) text(x[key], key);
  calendar(x.interviewDate);
  if (!Array.isArray(x.questions) || x.questions.length > 500) throw new Error('题目关联格式无效');
  const ids = new Set();
  for (const raw of x.questions) {
    const o = object(raw);
    required(o.questionId, '关联题目');
    if (ids.has(o.questionId))
      throw new Error('同一篇面经不能重复关联一道题，追问请写在同一记录中');
    ids.add(o.questionId);
    validateQuestionOccurrence(o);
  }
}
export function validateQuestionOccurrence(
  value: unknown,
): asserts value is QuestionOccurrenceInput {
  const o = object(value);
  text(o.wording, '实际问法');
  text(o.followups, '追问');
}
function validateLegacyReview(value: unknown): asserts value is ReviewRecord {
  const r = object(value);
  required(r.questionId, '关联题目');
  if (!masteries.includes(r.mastery as never)) throw new Error('掌握程度无效');
  text(r.note, '复习备注');
}
export function parseSnapshot(value: unknown): DeskSnapshot {
  const data = object(value);
  if (data.version !== 1) throw new Error('不支持的备份版本，请导入面经台 v1 备份');
  for (const key of ['questions', 'experiences', 'occurrences', 'reviews']) {
    if (!Array.isArray(data[key]) || data[key].length > 100000) throw new Error('备份列表格式无效');
    const ids = new Set();
    for (const row of data[key] as unknown[]) {
      const item = object(row);
      required(item.id, '记录 ID');
      if (ids.has(item.id)) throw new Error('备份中存在重复 ID');
      ids.add(item.id);
    }
  }
  if (data.companyCatalog !== undefined) {
    const catalog = object(data.companyCatalog);
    validateCatalogRevision(catalog.revision);
    normalizeCatalogItems(catalog.items);
  }
  const qs = data.questions as Record<string, unknown>[];
  const xs = data.experiences as Record<string, unknown>[];
  const os = data.occurrences as Record<string, unknown>[];
  const rs = data.reviews as Record<string, unknown>[];
  const qids = new Set(qs.map((q) => q.id)),
    xids = new Set(xs.map((x) => x.id));
  for (const q of qs) {
    validateQuestion({ ...q });
    if (!Number.isSafeInteger(q.historicalCount) || (q.historicalCount as number) < 0)
      throw new Error('历史累计次数无效');
    strings(q.historicalCompanies);
    if (q.companyTags !== undefined) normalizeCompanyTags(q.companyTags);
    timestamp(q.createdAt);
    timestamp(q.updatedAt);
    calendar(q.nextReview);
  }
  for (const x of xs) {
    validateExperience({ ...x, questions: [] });
    timestamp(x.createdAt);
  }
  const pairs = new Set();
  for (const o of os) {
    if (!qids.has(o.questionId) || !xids.has(o.experienceId))
      throw new Error('出现明细引用了不存在的题目或面经');
    const pair = JSON.stringify([o.questionId, o.experienceId]);
    if (pairs.has(pair)) throw new Error('同一面经存在重复题目明细');
    pairs.add(pair);
    validateQuestionOccurrence(o);
  }
  for (const r of rs) {
    validateLegacyReview({ ...r });
    if (!qids.has(r.questionId)) throw new Error('复习记录引用了不存在的题目');
    timestamp(r.createdAt);
  }
  const snapshot = structuredClone(data) as unknown as DeskSnapshot;
  if (snapshot.companyCatalog)
    snapshot.companyCatalog.items = normalizeCatalogItems(snapshot.companyCatalog.items);
  return snapshot;
}
