<script setup lang="ts">
import { parseDate } from '@internationalized/date';
import { useRouteQuery } from '@vueuse/router';
import {
  calendarDateInZone,
  timezoneLabel,
  validDate,
} from '~/utils/professionals';
import {
  dayBoundary,
  groupSessions,
  monday,
  type Session,
} from '~/utils/schedule';
import { formatDate } from '~/utils/dates';

definePageMeta({ layout: 'professional' });
useHead({ title: 'Schedule · ThoughtFull' });
const api = useApi();
const user = useCurrentUser();
const route = useRoute();
const timezone = computed(() => user.value?.timezone ?? 'UTC');
const desktop = useMediaQuery('(min-width: 1024px)');
const viewQuery = useRouteQuery<string>('view', '', { mode: 'push' });
const tabQuery = useRouteQuery<string>('tab', '', { mode: 'push' });
const cancelledQuery = useRouteQuery<string>('cancelled', '', { mode: 'push' });
const pageQuery = useRouteQuery<string>('page', '', { mode: 'push' });
const weekQuery = useRouteQuery<string>('week', '', { mode: 'push' });
const weekView = computed(() => desktop.value && viewQuery.value === 'week');
const period = computed<'upcoming' | 'past'>(() =>
  tabQuery.value === 'past' ? 'past' : 'upcoming',
);
const page = computed(() =>
  /^\d+$/.test(pageQuery.value)
    ? Math.max(1, Math.min(1000000, Number(pageQuery.value)))
    : 1,
);
const week = computed(() =>
  monday(
    validDate(weekQuery.value)
      ? parseDate(weekQuery.value)
      : calendarDateInZone(new Date(), timezone.value),
  ),
);
const query = computed(() => ({
  page: weekView.value ? 1 : page.value,
  pageSize: weekView.value ? 100 : 12,
  status: cancelledQuery.value === '1' ? undefined : ('active' as const),
  period: weekView.value ? undefined : period.value,
  from: weekView.value ? dayBoundary(week.value, timezone.value) : undefined,
  to: weekView.value
    ? dayBoundary(week.value.add({ days: 7 }), timezone.value)
    : undefined,
}));
const { data, status, error, refresh } = useAsyncData(
  'professional-schedule',
  async () => {
    const snapshot = { ...query.value };
    const result = await api('/api/v1/sessions', {
      method: 'get',
      query: snapshot,
    });
    if (snapshot.from) {
      for (let next = 2; next <= result.totalPages; next++) {
        const batch = await api('/api/v1/sessions', {
          method: 'get',
          query: { ...snapshot, page: next },
        });
        result.items.push(...batch.items);
      }
    }
    return result;
  },
  { watch: [query] },
);
const [hours, blockedDates] = await Promise.all([
  useAsyncData('schedule-hours', () =>
    api('/api/v1/working-hours', { method: 'get' }),
  ),
  useAsyncData(
    'schedule-blocked-dates',
    () => api('/api/v1/blocked-dates', { method: 'get' }),
    { watch: [timezone] },
  ),
]);
const groups = computed(() => {
  const grouped = groupSessions(data.value?.items ?? [], timezone.value);
  return period.value === 'past' ? grouped.reverse() : grouped;
});
const selected = ref<Session>();
const detailOpen = ref(false);
const cancelOpen = ref(false);

function cancel(session: Session) {
  selected.value = session;
  detailOpen.value = false;
  cancelOpen.value = true;
}

function moveWeek(days: number) {
  weekQuery.value = week.value.add({ days }).toString();
}

function setPeriod(value: string | number) {
  tabQuery.value = value === 'past' ? 'past' : '';
  pageQuery.value = '';
}
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold">Schedule</h1>
        <p class="mt-3 text-muted">Times in {{ timezoneLabel(timezone) }}</p>
      </div>
      <UTabs
        v-if="desktop"
        :model-value="weekView ? 'week' : 'list'"
        :items="[
          { label: 'List', value: 'list' },
          { label: 'Week', value: 'week' },
        ]"
        :content="false"
        @update:model-value="viewQuery = $event === 'week' ? 'week' : ''"
      />
    </div>
    <SessionsDetail
      v-if="typeof route.query.session === 'string'"
      :id="route.query.session"
      professional
      @changed="refresh()"
    />
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div v-if="weekView" class="flex flex-wrap items-center gap-3">
        <UButton
          icon="i-lucide-chevron-left"
          aria-label="Previous week"
          variant="outline"
          class="size-11 justify-center"
          @click="moveWeek(-7)"
        /><UButton
          icon="i-lucide-chevron-right"
          aria-label="Next week"
          variant="outline"
          class="size-11 justify-center"
          @click="moveWeek(7)"
        />
        <p>
          {{ formatDate(`${week}T12:00:00Z`, 'UTC') }} –
          {{ formatDate(`${week.add({ days: 6 })}T12:00:00Z`, 'UTC') }}
        </p>
        <UButton variant="outline" class="min-h-11" @click="weekQuery = ''"
          >This week</UButton
        >
      </div>
      <UTabs
        v-else
        :model-value="period"
        :items="[
          { label: 'Upcoming', value: 'upcoming' },
          { label: 'Past', value: 'past' },
        ]"
        :content="false"
        @update:model-value="setPeriod"
      />
      <USwitch
        :model-value="cancelledQuery === '1'"
        label="Show cancelled"
        @update:model-value="
          cancelledQuery = $event ? '1' : '';
          pageQuery = '';
        "
      />
    </div>
    <USkeleton
      v-if="status === 'pending'"
      class="h-64 rounded-2xl"
      aria-label="Loading schedule"
    />
    <UAlert
      v-else-if="error"
      role="alert"
      color="error"
      title="We couldn't load your schedule."
      ><template #actions
        ><UButton variant="outline" class="min-h-11" @click="refresh()"
          >Try again</UButton
        ></template
      ></UAlert
    >
    <template v-else-if="data">
      <template v-if="weekView">
        <UAlert
          v-if="hours.error.value"
          color="warning"
          title="Working-hour shading is unavailable."
          description="Your sessions are still shown."
          ><template #actions
            ><UButton variant="outline" @click="hours.refresh()"
              >Retry working hours</UButton
            ></template
          ></UAlert
        >
        <ScheduleWeek
          :sessions="data.items"
          :ranges="hours.data.value?.ranges ?? []"
          :blocked-dates="blockedDates.data.value?.items ?? []"
          :availability-known="
            hours.status.value === 'success' &&
            blockedDates.status.value === 'success'
          "
          :week="week.toString()"
          :timezone="timezone"
          @select="
            selected = $event;
            detailOpen = true;
          "
        />
        <UAlert
          v-if="blockedDates.error.value"
          role="alert"
          color="warning"
          title="Blocked dates couldn't be loaded."
          description="Availability shading is unavailable. Existing sessions are still shown."
        >
          <template #actions
            ><UButton
              variant="outline"
              class="min-h-11"
              @click="blockedDates.refresh()"
              >Retry blocked dates</UButton
            ></template
          >
        </UAlert>
      </template>
      <template v-else>
        <section
          v-for="[date, sessions] in groups"
          :key="date"
          class="space-y-4"
        >
          <h2 class="font-bold">
            {{ formatDate(`${date}T12:00:00Z`, 'UTC') }} · {{ sessions.length }}
            {{ sessions.length === 1 ? 'session' : 'sessions' }}
          </h2>
          <SessionsCard
            v-for="session in sessions"
            :key="session.id"
            :session="session"
            professional
            @cancel="cancel"
          />
        </section>
        <UEmpty
          v-if="!data.items.length"
          icon="i-lucide-calendar"
          title="No sessions to show"
          description="Your sessions will appear here once members book."
          ><template #actions
            ><UButton v-if="page > 1" class="min-h-11" @click="pageQuery = ''"
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
    </template>
    <UModal v-model:open="detailOpen" title="Session details"
      ><template #body
        ><SessionsCard
          v-if="selected"
          :session="selected"
          professional
          @cancel="cancel" /></template
    ></UModal>
    <SessionsCancelModal
      v-model="cancelOpen"
      :session="selected"
      professional
      @changed="refresh()"
    />
  </section>
</template>
