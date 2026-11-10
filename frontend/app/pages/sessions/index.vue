<script setup lang="ts">
import { scheduleTimezone } from '~/utils/schedule-display';
import { useRouteQuery } from '@vueuse/router';
import type { components } from '~/types/api';

definePageMeta({ layout: 'member' });
useHead({ title: 'My sessions · ThoughtFull' });
const api = useApi();
const user = useCurrentUser();
const zone = computed(() => scheduleTimezone(user.value?.timezone ?? 'UTC'));
const route = useRoute();
const tabQuery = useRouteQuery<string>('tab', '', { mode: 'push' });
const cancelledQuery = useRouteQuery<string>('cancelled', '', { mode: 'push' });
const pageQuery = useRouteQuery<string>('page', '', { mode: 'push' });
const period = computed<'past' | 'upcoming'>(() =>
  tabQuery.value === 'past' ? 'past' : 'upcoming',
);
const cancelled = computed(() => cancelledQuery.value === '1');
const page = computed(() =>
  /^\d+$/.test(pageQuery.value)
    ? Math.min(1000000, Math.max(1, Number(pageQuery.value)))
    : 1,
);
const query = computed(() => ({
  page: page.value,
  pageSize: 12,
  period: period.value,
  status: cancelled.value ? undefined : ('active' as const),
}));
const { data, status, error, refresh } = useAsyncData(
  'member-sessions',
  () => api('/api/v1/sessions', { method: 'get', query: query.value }),
  { watch: [query] },
);
const selected = ref<components['schemas']['SessionResponseDto']>();
const cancelOpen = ref(false);
const rescheduleOpen = ref(false);
const toast = useToast();

function setPeriod(value: string | number) {
  tabQuery.value = value === 'past' ? 'past' : '';
  pageQuery.value = '';
}

function setCancelled(value: boolean) {
  cancelledQuery.value = value ? '1' : '';
  pageQuery.value = '';
}

function cancel(session: components['schemas']['SessionResponseDto']) {
  selected.value = session;
  cancelOpen.value = true;
}

function reschedule(session: components['schemas']['SessionResponseDto']) {
  selected.value = session;
  rescheduleOpen.value = true;
}

async function changed() {
  toast.add({ title: 'Your session has been updated.', color: 'success' });
  await refresh();
}
</script>

<template>
  <section class="mx-auto max-w-5xl space-y-5">
    <header>
      <h1 class="text-3xl font-bold">My sessions</h1>
      <p class="mt-1 text-[13px] leading-5 text-muted lg:text-sm">
        Times in {{ zone.city }} ({{ zone.offset }}). Sessions last 50 minutes.
      </p>
    </header>
    <SessionsDetail
      v-if="typeof route.query.session === 'string'"
      :id="route.query.session"
      @changed="refresh()"
    />
    <div class="flex flex-wrap items-center justify-between gap-4">
      <UTabs
        :model-value="period"
        :items="[
          { label: 'Upcoming', value: 'upcoming' },
          { label: 'Past', value: 'past' },
        ]"
        class="w-full sm:w-auto"
        :ui="{
          list: 'h-12 rounded-full bg-[#e5eef1] p-1 dark:bg-muted',
          trigger:
            'h-10 flex-1 rounded-full px-6 text-sm data-[state=active]:text-primary',
          indicator: 'rounded-full bg-(--brand-surface) shadow-none',
        }"
        :content="false"
        @update:model-value="setPeriod"
      />
      <USwitch
        :model-value="cancelled"
        label="Show cancelled"
        @update:model-value="setCancelled"
      />
    </div>
    <USkeleton
      v-if="status === 'pending'"
      class="h-52 rounded-2xl"
      aria-label="Loading sessions"
    />
    <UAlert
      v-else-if="error"
      role="alert"
      color="error"
      title="We couldn't load sessions."
      ><template #actions
        ><UButton variant="outline" class="min-h-11" @click="refresh()"
          >Try again</UButton
        ></template
      ></UAlert
    >
    <template v-else-if="data">
      <div v-if="data.items.length" class="space-y-5">
        <SessionsCard
          v-for="session in data.items"
          :key="session.id"
          :session="session"
          @cancel="cancel"
          @reschedule="reschedule"
        />
      </div>
      <UEmpty
        v-else
        class="rounded-2xl border border-default bg-(--brand-surface) py-14"
        icon="i-lucide-calendar"
        title="No sessions to show"
        :description="
          period === 'upcoming'
            ? 'Find a professional and choose a time that works for you.'
            : 'Your session history will appear here.'
        "
        ><template #actions
          ><UButton
            v-if="period === 'upcoming'"
            to="/professionals"
            class="min-h-11"
            >Find a professional</UButton
          ><UButton
            v-if="page > 1"
            variant="outline"
            class="min-h-11"
            @click="pageQuery = ''"
            >Go to first page</UButton
          ></template
        ></UEmpty
      >
      <AppPagination
        :page="page"
        :total="data.total"
        :page-size="12"
        @change="pageQuery = $event === 1 ? '' : String($event)"
      />
    </template>
    <SessionsCancelModal
      v-model="cancelOpen"
      :session="selected"
      @changed="changed"
    />
    <SessionsReschedule
      v-model="rescheduleOpen"
      :session="selected"
      @changed="changed"
    />
  </section>
</template>
