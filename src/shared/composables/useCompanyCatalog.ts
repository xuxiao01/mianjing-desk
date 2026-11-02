import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type { CompanyCatalog, DeskSnapshot } from '@/shared/types/domain';
import { getCompanyCatalog } from '@/shared/utils/companyCatalog';

export const companyCatalogKey: InjectionKey<ComputedRef<CompanyCatalog>> =
  Symbol('companyCatalog');
export function useCompanyCatalog(data?: Ref<DeskSnapshot | undefined>) {
  const inherited = inject(companyCatalogKey, undefined);
  return computed(() =>
    data?.value ? getCompanyCatalog(data.value) : inherited?.value || getCompanyCatalog(),
  );
}
