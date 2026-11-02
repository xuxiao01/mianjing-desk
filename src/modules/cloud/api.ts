import { request } from '@/shared/api/http';
import type {
  Catalog,
  CreateInput,
  Question,
  QuestionInput,
  MetaPatch,
  Occurrence,
  ListResult,
  Detail,
} from './types';
const send = <T>(path: string, method: string, body?: unknown) =>
  request<T>('/mianjing' + path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
export const cloud = {
  list: (query: Record<string, string | number>, signal?: AbortSignal) =>
    request<ListResult>(
      '/mianjing/questions?' +
        new URLSearchParams(
          Object.entries(query)
            .filter(([, v]) => v !== '')
            .map(([k, v]) => [k, String(v)]),
        ),
      { signal },
    ),
  detail: (id: string, signal?: AbortSignal) =>
    request<Detail>('/mianjing/questions/' + encodeURIComponent(id), { signal }),
  catalog: (signal?: AbortSignal) => request<Catalog>('/mianjing/company-catalog', { signal }),
  saveCatalog: (input: Catalog) =>
    send<Catalog>('/company-catalog', 'PUT', {
      items: input.items.map(({ id, name, palette, enabled }) => ({ id, name, palette, enabled })),
    }),
  create: (input: CreateInput) => send<Question>('/questions', 'POST', input),
  edit: (id: string, input: QuestionInput) => send<Question>('/questions/' + id, 'PATCH', input),
  meta: (id: string, input: MetaPatch) =>
    send<Question>('/questions/' + id + '/meta', 'PATCH', input),
  record: (id: string, input: { companyId: string; content: string }) =>
    send<Occurrence>('/questions/' + id + '/occurrences', 'POST', input),
  wording: (id: string, content: string) =>
    send<Occurrence>('/occurrences/' + id, 'PATCH', { content }),
  deleteQuestion: (id: string) => send('/questions/' + id, 'DELETE'),
  deleteOccurrence: (id: string) => send('/occurrences/' + id, 'DELETE'),
};
