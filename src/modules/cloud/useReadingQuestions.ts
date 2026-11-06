import { computed, watch, type Ref } from 'vue';
import { useInfiniteQuery, useQueryClient } from '@tanstack/vue-query';
import { cloud } from './api';
import type { Question, ListResult } from './types';
import type { QuestionFilters } from '@/shared/types/domain';

export function readingConditions(filters: QuestionFilters, pageSize: number) {
  return {
    search: filters.search,
    category: filters.category,
    company: filters.company,
    mastery: filters.mastery,
    organized: filters.organized,
    sort: filters.sort,
    pageSize,
  };
}

export function uniqueReadingRows(pages: ListResult[]): Question[] {
  const seen = new Set<string>();
  return pages.flatMap((page) =>
    page.items.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    }),
  );
}

export function nextReadingPage(last: ListResult, _pages: ListResult[], requested: number) {
  if (last.page !== requested || !last.items.length) return undefined;
  return last.page * last.pageSize < last.total ? requested + 1 : undefined;
}

export function useReadingQuestions(
  enabled: Ref<boolean>,
  filters: Ref<QuestionFilters>,
  pageSize: Ref<number>,
) {
  const client = useQueryClient();
  const conditions = computed(() => readingConditions(filters.value, pageSize.value));
  const key = computed(() => ['mianjing', 'reading', conditions.value]);
  const query = useInfiniteQuery({
    queryKey: key,
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      cloud.list({ ...conditions.value, page: pageParam }, signal),
    getNextPageParam: nextReadingPage,
    // Reading position belongs to this mounted list, not to a persisted session.
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const pages = computed(() => query.data.value?.pages || []);
  const result = computed<ListResult | undefined>(() => {
    if (!pages.value.length) return undefined;
    const first = pages.value[0]!;
    return { ...first, page: 1, items: uniqueReadingRows(pages.value) };
  });
  const resetVersion = computed(
    () =>
      pages.value.some((page, index) => page.page !== index + 1) ||
      pages.value.some((page) => page.total !== pages.value[0]?.total),
  );
  watch(resetVersion, (invalid) => {
    if (invalid && enabled.value) void client.resetQueries({ queryKey: key.value, exact: true });
  });
  function loadMore() {
    if (!enabled.value || !query.hasNextPage.value || query.isFetching.value || query.isError.value)
      return;
    void query.fetchNextPage();
  }
  function retry() {
    if (query.isFetching.value) return;
    if (query.isFetchNextPageError.value) void query.fetchNextPage();
    else void query.refetch();
  }
  return { ...query, result, conditions, loadMore, retry };
}
