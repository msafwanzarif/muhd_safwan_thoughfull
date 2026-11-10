<script setup lang="ts">
import {
  languageLabel,
  specialisationLabel,
  timezoneCity,
  timezoneLabel,
} from '~/utils/professionals';

definePageMeta({ layout: 'member' });
const route = useRoute();
const api = useApi();
const user = useCurrentUser();
const id = computed(() => String(route.params.id));
const { data, status, error, refresh } = useAsyncData(
  () => `professional-${id.value}`,
  () =>
    api('/api/v1/professionals/{id}', {
      method: 'get',
      params: { id: id.value },
    }),
);
useHead({
  title: computed(() => `${data.value?.name ?? 'Professional'} · ThoughtFull`),
});
</script>

<template>
  <section>
    <UButton
      to="/professionals"
      variant="link"
      icon="i-lucide-arrow-left"
      class="mb-4 min-h-11 px-0"
      >All professionals</UButton
    >
    <USkeleton
      v-if="status === 'pending'"
      class="h-80 rounded-2xl"
      aria-label="Loading profile"
    />
    <UAlert
      v-else-if="error"
      role="alert"
      color="error"
      variant="soft"
      :title="
        error.statusCode === 404
          ? 'Professional not found'
          : 'We couldn’t load this profile.'
      "
      description="Please try again or return to the directory."
    >
      <template #actions
        ><UButton variant="outline" class="min-h-11" @click="refresh()"
          >Try again</UButton
        ></template
      >
    </UAlert>
    <div
      v-else-if="data"
      class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
    >
      <article
        class="space-y-5 rounded-2xl border border-default bg-(--brand-surface) p-4 sm:p-6 xl:sticky xl:top-6"
      >
        <div class="flex items-start gap-4">
          <UAvatar
            :alt="data.name"
            size="3xl"
            :ui="{
              root: 'size-18 shrink-0 bg-teal-brand-200 dark:bg-teal-brand-800',
              fallback:
                'text-3xl font-semibold text-indigo-brand-600 dark:text-teal-brand-200',
            }"
          />
          <div>
            <h1 class="text-3xl font-bold wrap-anywhere">{{ data.name }}</h1>
            <p class="mt-2 text-muted">
              {{ data.title || 'Professional' }} · Based in
              {{ timezoneCity(data.timezone) }}
            </p>
          </div>
        </div>
        <p
          v-if="data.bio"
          class="leading-relaxed whitespace-pre-line wrap-anywhere"
        >
          {{ data.bio }}
        </p>
        <div v-if="data.specialisations.length" class="flex flex-wrap gap-2">
          <UBadge
            v-for="code in data.specialisations"
            :key="code"
            color="secondary"
            variant="soft"
            :ui="{
              base: 'bg-teal-brand-50 text-teal-brand-600 dark:bg-teal-brand-900 dark:text-teal-brand-400',
            }"
            class="rounded-full"
            >{{ specialisationLabel(code) }}</UBadge
          >
        </div>
        <p class="text-muted">
          {{
            data.languages.length
              ? `Speaks ${data.languages.map(languageLabel).join(', ')}`
              : 'Languages not listed'
          }}
        </p>
        <UAlert
          v-if="!data.hasWorkingHours"
          color="neutral"
          variant="soft"
          title="No availability"
          description="This professional has not added working hours yet."
        />
        <p class="border-t border-default pt-6 text-sm text-muted">
          Your session times use {{ timezoneLabel(user?.timezone ?? 'UTC') }}.
        </p>
      </article>
      <BookingBook
        :key="data.id"
        :professional-id="data.id"
        :professional-name="data.name"
      />
    </div>
  </section>
</template>
