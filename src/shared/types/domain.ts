export const categories = ['八股', '手撕', '算法', '场景题'] as const;
export const masteries = ['不会', '模糊', '基本掌握', '熟练'] as const;
export const priorities = ['高', '中', '低'] as const;
export const recruitmentTypes = ['日常', '暑期', '秋招'] as const;
export const interviewRounds = ['一面', '二面', '三面'] as const;
export type Category = (typeof categories)[number];
export type Mastery = (typeof masteries)[number];
export type Priority = (typeof priorities)[number];
export type RecruitmentType = (typeof recruitmentTypes)[number];
export type InterviewRound = (typeof interviewRounds)[number];
export const companyPaletteKeys = [
  'teal',
  'orange',
  'yellow',
  'red',
  'coral',
  'blue',
  'purple',
  'gray',
  'white',
  'black',
] as const;
export type CompanyPaletteKey = (typeof companyPaletteKeys)[number];
export interface CompanyTag {
  id: string;
  name: string;
  aliases: string[];
  palette: CompanyPaletteKey;
  enabled: boolean;
}
export interface CompanyCatalog {
  revision: number;
  items: CompanyTag[];
}
export interface CompanyCatalogInput {
  expectedRevision: number;
  items: CompanyTag[];
}

export interface Question {
  id: string;
  title: string;
  category: Category;
  tags: string[];
  priority: Priority;
  mastery: Mastery;
  organized: boolean;
  notes: string;
  historicalCount: number;
  historicalCompanies: string[];
  companyTags?: string[];
  createdAt: string;
  updatedAt: string;
  nextReview: string | null;
}
export type QuestionInput = Pick<
  Question,
  'title' | 'category' | 'tags' | 'priority' | 'mastery' | 'organized' | 'notes'
>;
export interface QuestionMetaPatch {
  companyTags?: string[];
  mastery?: Mastery;
  organized?: boolean;
  totalCount?: number;
}
export interface InterviewSourceInput {
  company: string;
  recruitmentType: RecruitmentType;
  round: InterviewRound;
}
export interface QuestionCreateInput extends QuestionInput {
  source?: InterviewSourceInput;
}
export interface Experience {
  id: string;
  company: string;
  role: string;
  round: string;
  recruitmentType?: RecruitmentType;
  interviewDate: string | null;
  source: string;
  original: string;
  createdAt: string;
}
export interface QuestionOccurrence {
  id: string;
  questionId: string;
  experienceId: string;
  wording: string;
  followups: string;
}
export type QuestionOccurrenceInput = Pick<QuestionOccurrence, 'wording' | 'followups'>;
export interface ExperienceInput extends Omit<Experience, 'id' | 'createdAt'> {
  questions: Pick<QuestionOccurrence, 'questionId' | 'wording' | 'followups'>[];
}
export interface ReviewRecord {
  id: string;
  questionId: string;
  mastery: Mastery;
  note: string;
  createdAt: string;
}
export interface DeskSnapshot {
  version: 1;
  companyCatalog?: CompanyCatalog;
  questions: Question[];
  experiences: Experience[];
  occurrences: QuestionOccurrence[];
  reviews: ReviewRecord[];
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface QuestionFilters {
  search: string;
  category: string;
  company: string;
  mastery: string;
  organized: string;
  sort: string;
  page: number;
}
