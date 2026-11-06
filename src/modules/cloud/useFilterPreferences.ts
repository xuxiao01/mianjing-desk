import { computed, onScopeDispose, ref, watch } from 'vue';
import { useRoute, useRouter, type LocationQuery } from 'vue-router';
import {
  hasFilterQuery,
  preferencesFromQuery,
  preferencesQuery,
  readFilterPreferences,
  writeFilterPreferences,
} from './filterPreferences';

/** Restore once on entry; subsequent URL changes (including clear) are authoritative. */
export function useFilterPreferences() {
  const route = useRoute(),
    router = useRouter();
  const saved = hasFilterQuery(route.query) ? null : readFilterPreferences();
  const savedQuery = saved ? preferencesQuery(saved) : {};
  const initialQuery: LocationQuery = { ...route.query, ...savedQuery };
  delete initialQuery.page;
  const restoring = ref<LocationQuery | null>(Object.keys(savedQuery).length ? initialQuery : null);
  const ready = computed(() => restoring.value === null);
  const query = computed(() => restoring.value || route.query);
  let disposed = false;
  onScopeDispose(() => {
    disposed = true;
  });
  watch(
    [() => route.query, ready],
    ([current, canSave]) => {
      if (canSave) writeFilterPreferences(preferencesFromQuery(current));
    },
    { immediate: true, flush: 'post' },
  );
  if (restoring.value) {
    void router
      .replace({ path: route.path, query: initialQuery, hash: route.hash })
      .catch(() => {
        /* URL-only filtering remains usable if navigation is interrupted. */
      })
      .finally(() => {
        if (!disposed) restoring.value = null;
      });
  }
  return { ready, query };
}
