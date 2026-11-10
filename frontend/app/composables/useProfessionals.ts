import { useRouteQuery } from '@vueuse/router';
import type { operations } from '~/types/api';
import { readDirectoryFilters } from '~/utils/professionals';

type Query = NonNullable<
  operations['ProfessionalsController_list_v1']['parameters']['query']
>;

export function useProfessionals() {
  const api = useApi();
  const route = useRoute();
  const nameQuery = useRouteQuery<string>('name', '', { mode: 'replace' });
  const specQuery = useRouteQuery<string>('spec', '', { mode: 'push' });
  const langQuery = useRouteQuery<string>('lang', '', { mode: 'push' });
  const dateQuery = useRouteQuery<string>('date', '', { mode: 'push' });
  const pageQuery = useRouteQuery<string>('page', '', { mode: 'push' });
  const filters = computed(() => readDirectoryFilters(route.query));
  const search = ref(filters.value.name);
  const debouncedSearch = refDebounced(search, 300);
  const pageSize = 12;

  watch(
    () => filters.value.name,
    (value) => {
      search.value = value;
    },
  );
  watch(debouncedSearch, (value) => {
    if (value.trim() === filters.value.name) return;
    nameQuery.value = value.trim().slice(0, 100);
    pageQuery.value = '';
  });

  function setFilter(key: 'spec' | 'lang' | 'date', value: string) {
    const refs = { spec: specQuery, lang: langQuery, date: dateQuery };
    refs[key].value = value;
    pageQuery.value = '';
  }

  function setPage(page: number) {
    pageQuery.value = page === 1 ? '' : String(page);
  }

  function clear() {
    search.value = '';
    nameQuery.value = '';
    specQuery.value = '';
    langQuery.value = '';
    dateQuery.value = '';
    pageQuery.value = '';
  }

  const query = computed<Query>(() => ({
    page: filters.value.page,
    pageSize,
    name: filters.value.name || undefined,
    specialisation: (filters.value.specialisation ||
      undefined) as Query['specialisation'],
    language: (filters.value.language || undefined) as Query['language'],
    date: filters.value.date || undefined,
  }));
  const request = useAsyncData(
    'professionals-directory',
    () => api('/api/v1/professionals', { method: 'get', query: query.value }),
    { watch: [query], dedupe: 'cancel' },
  );

  return { ...request, search, filters, setFilter, setPage, clear, pageSize };
}
