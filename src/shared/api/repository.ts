import { normalizeCatalogInput } from '@/shared/utils/companyCatalog';
import type { DeskRepository } from './contracts';
import { createMockRepository } from '@/mocks/repository';
import { request } from './http';
import {
  parseSnapshot,
  validateQuestionCreate,
  validateQuestionOccurrence,
  normalizeQuestionMetaPatch,
} from './validation';

export const dataSource = import.meta.env.VITE_DATA_SOURCE || 'mock';
if (!['mock', 'api'].includes(dataSource)) throw new Error('VITE_DATA_SOURCE 只能为 mock 或 api');
const unavailable = async (): Promise<never> => {
  throw new Error('API 模式不支持替换或重置数据，请通过后端管理备份。');
};
const apiRepository: DeskRepository = {
  saveCompanyCatalog(input) {
    const payload = normalizeCatalogInput(input);
    return request('/mianjing/company-catalog', { method: 'PUT', body: JSON.stringify(payload) });
  },
  async getSnapshot(signal) {
    return parseSnapshot(await request('/mianjing/snapshot', { signal }));
  },
  createQuestion(input) {
    validateQuestionCreate(input);
    return request('/mianjing/questions', { method: 'POST', body: JSON.stringify(input) });
  },
  saveQuestion(input, id) {
    return request('/mianjing/questions' + (id ? '/' + encodeURIComponent(id) : ''), {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(input),
    });
  },
  updateQuestionMeta(id, input) {
    const patch = normalizeQuestionMetaPatch(input);
    return request('/mianjing/questions/' + encodeURIComponent(id) + '/meta', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  updateOccurrence(id, input) {
    validateQuestionOccurrence(input);
    return request('/mianjing/occurrences/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify({ wording: input.wording, followups: input.followups }),
    });
  },
  addExperience(input) {
    return request('/mianjing/experiences', { method: 'POST', body: JSON.stringify(input) });
  },
  restore: unavailable,
  reset: unavailable,
  async exportRaw() {
    return JSON.stringify(await this.getSnapshot(), null, 2);
  },
};
export const repository: DeskRepository =
  dataSource === 'mock' ? createMockRepository() : apiRepository;
