import type {
  Category,
  Priority,
  Mastery,
  RecruitmentType,
  InterviewRound,
  CompanyPaletteKey,
} from '@/shared/types/domain';
export interface Company {
  id: string;
  name: string;
  palette: CompanyPaletteKey;
  enabled: boolean;
  sortOrder: number;
}
export interface Catalog {
  items: Company[];
}
export interface Question {
  id: string;
  title: string;
  category: Category;
  tags: string[];
  companyIds: string[];
  companies: Company[];
  priority: Priority;
  mastery: Mastery;
  organized: boolean;
  baseCount: number;
  recordCount: number;
  totalCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface Occurrence {
  id: string;
  questionId: string;
  companyId: string;
  company: Company;
  content: string;
  createdAt: string;
  recruitmentType: RecruitmentType | null;
  round: InterviewRound | null;
}
export interface QuestionInput {
  title: string;
  category: Category;
  tags: string[];
  priority: Priority;
  mastery: Mastery;
  organized: boolean;
}
export interface CreateInput extends QuestionInput {
  source?: { companyId: string; recruitmentType: RecruitmentType; round: InterviewRound };
}
export interface MetaPatch {
  companyIds?: string[];
  mastery?: Mastery;
  organized?: boolean;
  totalCount?: number;
}
export interface ListResult {
  items: Question[];
  total: number;
  page: number;
  pageSize: number;
  usedCompanyIds: string[];
}
export interface Detail {
  question: Question;
  occurrences: Occurrence[];
}
export interface Identity {
  role: 'admin' | 'guest';
  user: { id: number; email: string; username: string } | null;
  isAdmin: boolean;
  canEdit: boolean;
}
