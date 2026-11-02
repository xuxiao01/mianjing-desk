import { computed } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { identity } from '@/modules/auth/session';
import { cloud } from './api';
export function useCatalog() {
  return useQuery({
    queryKey: ['mianjing', 'catalog'],
    queryFn: ({ signal }) => cloud.catalog(signal),
    enabled: computed(() => !!identity.value),
  });
}
export function useRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['mianjing'] });
}
