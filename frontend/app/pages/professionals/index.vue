<script setup lang="ts">
import {
  calendarDateInZone,
  languageLabel,
  specialisationLabel,
  timezoneCity,
  timezoneLabel,
} from '~/utils/professionals';

definePageMeta({ layout: 'member' });
useHead({ title: 'Find a professional · ThoughtFull' });
const user = useCurrentUser();
const {
  data,
  status,
  error,
  refresh,
  search,
  filters,
  setFilter,
  setPage,
  clear,
  pageSize,
} = useProfessionals();
const mobileFiltersOpen = ref(false);
const timezone = computed(() => user.value?.timezone ?? 'UTC');
const today = computed(() => calendarDateInZone(new Date(), timezone.value));
const minDate = computed(() => today.value.toString());
const maxDate = computed(() => today.value.add({ days: 28 }).toString());
const extraCount = computed(
  () =>
    [
      filters.value.specialisation,
      filters.value.language,
      filters.value.date,
    ].filter(Boolean).length,
);
const hasFilters = computed(() => !!filters.value.name || extraCount.value > 0);
const summary = computed(() =>
  [
    filters.value.specialisation &&
      specialisationLabel(filters.value.specialisation),
    filters.value.language && languageLabel(filters.value.language),
    filters.value.date && `Free on ${filters.value.date}`,
  ]
    .filter(Boolean)
    .join(' · '),
);
</script>

<template>
  <section aria-labelledby="directory-heading">
    <h1 id="directory-heading" class="text-3xl font-bold">
      Find a professional
    </h1>
    <p class="mt-1 text-[13px] leading-5 text-muted lg:text-sm">
      Counsellors and coaches you can book. Times shown in your time zone,
      {{ timezoneLabel(timezone) }}.
    </p>
    <div
      class="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-default bg-(--brand-surface) p-4 lg:grid-cols-4 lg:gap-4 lg:p-5"
    >
      <UFormField label="Name" class="min-w-0">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search by name"
          maxlength="100"
          class="w-full"
          :ui="{ base: 'min-h-11' }"
        />
      </UFormField>
      <div class="hidden lg:contents">
        <ProfessionalsFilters
          :specialisation="filters.specialisation"
          :language="filters.language"
          :date="filters.date"
          :min-date="minDate"
          :max-date="maxDate"
          :timezone="timezoneCity(timezone)"
          @change="setFilter"
        />
      </div>
      <USlideover
        v-model:open="mobileFiltersOpen"
        title="Filter professionals"
        description="Choose a specialisation, language or available date."
        :close="{ class: 'size-11' }"
        class="lg:hidden"
      >
        <UButton
          icon="i-lucide-list-filter"
          variant="outline"
          class="mt-6 min-h-11 justify-center lg:hidden"
          >Filters{{ extraCount ? ` (${extraCount})` : '' }}</UButton
        >
        <template #body>
          <div class="space-y-6">
            <ProfessionalsFilters
              :specialisation="filters.specialisation"
              :language="filters.language"
              :date="filters.date"
              :min-date="minDate"
              :max-date="maxDate"
              :timezone="timezoneCity(timezone)"
              @change="setFilter"
            />
          </div>
        </template>
        <template #footer>
          <UButton variant="outline" class="min-h-11" @click="clear"
            >Clear filters</UButton
          >
          <UButton
            class="min-h-11 flex-1 justify-center"
            @click="mobileFiltersOpen = false"
            >Show results</UButton
          >
        </template>
      </USlideover>
    </div>
    <div class="my-5 flex min-h-11 items-center justify-between gap-4">
      <p role="status" aria-live="polite" class="text-sm text-muted">
        <template v-if="status === 'pending'">Finding professionals…</template>
        <template v-else-if="!error && data"
          >{{ data.total }}
          {{ data.total === 1 ? 'professional' : 'professionals'
          }}<span v-if="summary"> · {{ summary }}</span></template
        >
      </p>
      <UButton
        v-if="hasFilters"
        variant="link"
        class="min-h-11 shrink-0"
        @click="clear"
        >Clear filters</UButton
      >
    </div>
    <div
      v-if="status === 'pending'"
      aria-label="Loading professionals"
      aria-busy="true"
      class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <USkeleton v-for="index in 6" :key="index" class="h-56 rounded-2xl" />
    </div>
    <UAlert
      v-else-if="error"
      role="alert"
      color="error"
      variant="soft"
      title="We couldn't load professionals."
      description="Please check your connection and try again."
    >
      <template #actions
        ><UButton
          color="error"
          variant="outline"
          class="min-h-11"
          @click="refresh()"
          >Try again</UButton
        ></template
      >
    </UAlert>
    <template v-else-if="data">
      <div
        v-if="data.items.length"
        class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <ProfessionalsCard
          v-for="professional in data.items"
          :key="professional.id"
          :professional="professional"
        />
      </div>
      <UEmpty
        v-else
        icon="i-lucide-search"
        :title="
          data.total ? 'No results on this page' : 'No professionals found'
        "
        :description="
          hasFilters
            ? 'Try a different name, specialisation, language or date.'
            : 'Please check back soon.'
        "
        class="rounded-2xl border border-default bg-(--brand-surface) py-14"
      >
        <template #actions>
          <UButton
            v-if="hasFilters"
            variant="outline"
            class="min-h-11"
            @click="clear"
            >Clear filters</UButton
          >
          <UButton
            v-else-if="filters.page > 1"
            class="min-h-11"
            @click="setPage(1)"
            >Go to first page</UButton
          >
        </template>
      </UEmpty>
      <nav
        v-if="data.total > pageSize || filters.page > 1"
        aria-label="Professionals pages"
        class="mt-8 flex justify-center"
      >
        <UPagination
          :page="filters.page"
          :total="data.total"
          :items-per-page="pageSize"
          :sibling-count="1"
          :show-edges="false"
          :ui="{
            first: 'hidden',
            last: 'hidden',
            prev: 'size-11 justify-center',
            next: 'size-11 justify-center',
            item: 'min-h-11 min-w-11 justify-center',
          }"
          @update:page="setPage"
        />
      </nav>
    </template>
  </section>
</template>
