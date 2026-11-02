import type {
  DeskSnapshot,
  CompanyCatalog,
  CompanyCatalogInput,
  Experience,
  ExperienceInput,
  Question,
  QuestionInput,
  QuestionMetaPatch,
  QuestionCreateInput,
  QuestionOccurrence,
  QuestionOccurrenceInput,
} from '@/shared/types/domain';
export type ApiResponse<T> = { success: true; data: T } | { success: false; message: string };
export interface DeskRepository {
  saveCompanyCatalog(input: CompanyCatalogInput): Promise<CompanyCatalog>;
  getSnapshot(signal?: AbortSignal): Promise<DeskSnapshot>;
  createQuestion(input: QuestionCreateInput): Promise<Question>;
  saveQuestion(input: QuestionInput, id?: string): Promise<Question>;
  updateQuestionMeta(id: string, input: QuestionMetaPatch): Promise<Question>;
  updateOccurrence(id: string, input: QuestionOccurrenceInput): Promise<QuestionOccurrence>;
  addExperience(input: ExperienceInput): Promise<Experience>;
  restore(snapshot: DeskSnapshot): Promise<void>;
  reset(): Promise<void>;
  exportRaw(): Promise<string>;
}
