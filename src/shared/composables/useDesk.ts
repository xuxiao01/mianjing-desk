import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { repository } from '@/shared/api/repository';
import type {
  ExperienceInput,
  CompanyCatalogInput,
  QuestionInput,
  QuestionMetaPatch,
  QuestionCreateInput,
  QuestionOccurrenceInput,
} from '@/shared/types/domain';

export const deskKey = ['desk', 'snapshot'] as const;
export function useDesk() {
  return useQuery({ queryKey: deskKey, queryFn: ({ signal }) => repository.getSnapshot(signal) });
}
export function useDeskActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: deskKey });
  return {
    companyCatalog: useMutation({
      mutationFn: (input: CompanyCatalogInput) => repository.saveCompanyCatalog(input),
      onSuccess: refresh,
    }),
    createQuestion: useMutation({
      mutationFn: (input: QuestionCreateInput) => repository.createQuestion(input),
      onSuccess: refresh,
    }),
    question: useMutation({
      mutationFn: ({ input, id }: { input: QuestionInput; id?: string }) =>
        repository.saveQuestion(input, id),
      onSuccess: refresh,
    }),
    questionMeta: useMutation({
      mutationFn: ({ id, input }: { id: string; input: QuestionMetaPatch }) =>
        repository.updateQuestionMeta(id, input),
      onSuccess: refresh,
    }),
    occurrence: useMutation({
      mutationFn: ({ id, input }: { id: string; input: QuestionOccurrenceInput }) =>
        repository.updateOccurrence(id, input),
      onSuccess: refresh,
    }),
    experience: useMutation({
      mutationFn: (input: ExperienceInput) => repository.addExperience(input),
      onSuccess: refresh,
    }),
  };
}
