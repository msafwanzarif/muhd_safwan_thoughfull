<script setup lang="ts">
import type { DateValue } from '@internationalized/date';
import type { components } from '~/types/api';
import { calendarDateInZone } from '~/utils/professionals';
import { formatDate, formatTime, localDate } from '~/utils/dates';
import { scheduleDate, scheduleTimezone } from '~/utils/schedule-display';
import { dayOfWeek, type Session } from '~/utils/schedule';
import { problemMessage } from '~/utils/problem';

definePageMeta({ layout: 'professional' });
useHead({ title: 'Blocked dates · ThoughtFull' });
const api = useApi();
const user = useCurrentUser();
const desktop = useMediaQuery('(min-width: 1024px)');
const {
  data,
  error: loadError,
  status,
  refresh,
} = await useAsyncData('blocked-dates', () =>
  api('/api/v1/blocked-dates', { method: 'get' }),
);
const selection = shallowRef<DateValue[]>([]);
const selected = computed({
  get: () => selection.value,
  set: (value: DateValue[] | undefined) => {
    selection.value = (value ?? []).filter(
      (date) => !blocked.value.has(date.toString()),
    );
  },
});
const zone = computed(() => scheduleTimezone(user.value?.timezone ?? 'UTC'));
const { data: hours } = await useAsyncData('blocked-date-hours', () =>
  api('/api/v1/working-hours', { method: 'get' }),
);
function noHours(date: DateValue) {
  return (
    !!hours.value &&
    !hours.value.ranges.some(
      (range) => range.weekday === dayOfWeek(date.toString()),
    )
  );
}
function dateLabel(date: DateValue) {
  return scheduleDate(date.toString() + 'T12:00:00Z', 'UTC', true);
}

const { data: bookings, error: bookingError } = useAsyncData(
  'blocked-date-bookings',
  async () => {
    const query = {
      page: 1,
      pageSize: 100,
      status: 'active' as const,
      period: 'upcoming' as const,
    };
    const result = await api('/api/v1/sessions', { method: 'get', query });
    const items: Session[] = [...result.items];
    for (let page = 2; page <= result.totalPages; page++) {
      const batch = await api('/api/v1/sessions', {
        method: 'get',
        query: { ...query, page },
      });
      items.push(...batch.items);
    }
    return items;
  },
);
const affected = computed(() => {
  const dates = new Set(selected.value.map((date) => date.toString()));
  return (
    bookings.value?.filter((session) =>
      dates.has(localDate(session.startAt, user.value?.timezone ?? 'UTC')),
    ) ?? []
  );
});
const reason = ref('');
const busy = ref(false);
const error = ref('');
const success = ref('');
const now = useNow({ interval: 60000 });
const min = computed(() =>
  calendarDateInZone(now.value, user.value?.timezone ?? 'UTC'),
);
const month = shallowRef<DateValue>(min.value);
function inMonth(date: DateValue, offset: number) {
  const displayed = month.value.add({ months: offset });
  return date.year === displayed.year && date.month === displayed.month;
}

function selectMonth(value: DateValue[] | undefined, offset: number) {
  selected.value = [
    ...selected.value.filter((date) => !inMonth(date, offset)),
    ...(value ?? []),
  ].sort((a, b) => a.compare(b));
}
const upcoming = computed(
  () =>
    data.value?.items.filter(
      (item) => item.localDate >= min.value.toString(),
    ) ?? [],
);
const blocked = computed(
  () => new Set(upcoming.value.map((item) => item.localDate)),
);
const warnings = ref<components['schemas']['AffectedSessionDto'][]>([]);
useUnsavedChanges(computed(() => selected.value.length > 0 || !!reason.value));

async function save() {
  if (busy.value || !selected.value.length || selected.value.length > 90)
    return;
  busy.value = true;
  error.value = '';
  success.value = '';
  try {
    const result = await api('/api/v1/blocked-dates/bulk', {
      method: 'put',
      body: {
        dates: selected.value
          .filter((date) => !blocked.value.has(date.toString()))
          .map((date) => ({
            localDate: date.toString(),
            reason: reason.value.trim() || undefined,
          })),
      },
    });
    warnings.value = [
      ...new Map(
        result.items
          .flatMap((item) => item.warnings)
          .map((session) => [session.id, session]),
      ).values(),
    ];
    selected.value = [];
    reason.value = '';
    success.value = 'Blocked dates saved. Existing bookings have been kept.';
    await refresh();
    await refreshNuxtData('schedule-blocked-dates');
  } catch (cause) {
    error.value = problemMessage(cause);
  } finally {
    busy.value = false;
  }
}

async function remove(id: string, date: string) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await api('/api/v1/blocked-dates/{id}', {
      method: 'delete',
      params: { id },
    });
    selected.value = selected.value.filter((item) => item.toString() !== date);
    warnings.value = [];
    success.value = 'Date unblocked.';
    await refresh();
    await refreshNuxtData('schedule-blocked-dates');
  } catch (cause) {
    error.value = problemMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="blocked-page">
    <header>
      <h1 class="text-2xl leading-8 font-bold lg:text-3xl lg:leading-10">
        Blocked dates
      </h1>
      <p
        class="mt-1 text-[13px] leading-[19px] text-muted lg:text-sm lg:leading-5"
      >
        <span class="lg:hidden"
          >Block whole days, like holidays. Days are in
          {{ zone.city }} time.</span
        ><span class="hidden lg:inline"
          >Block whole days, like holidays. Members can't book on them. Days are
          in your time zone, {{ zone.city }} ({{ zone.offset }}).</span
        >
      </p>
    </header>
    <USkeleton v-if="status === 'pending'" class="h-72 rounded-xl" />
    <UAlert
      v-else-if="loadError"
      role="alert"
      color="error"
      title="We couldn't load blocked dates."
      ><template #actions
        ><UButton variant="outline" @click="refresh()"
          >Try again</UButton
        ></template
      ></UAlert
    >
    <template v-else>
      <UAlert v-if="success" role="status" color="success" :title="success" />
      <UAlert v-if="error" role="alert" color="error" :title="error" />
      <HoursKeptSessions :warnings="warnings" />
      <div class="blocked-layout">
        <div class="blocked-calendar blocked-card">
          <p class="mb-3 hidden text-center text-[13px] text-muted lg:block">
            Select one or more dates
          </p>
          <div class="blocked-months">
            <UCalendar
              v-for="offset in desktop ? [0, 1] : [0]"
              :key="offset"
              :model-value="selected.filter((date) => inMonth(date, offset))"
              :class="offset ? 'second-month' : 'first-month'"
              :placeholder="month.add({ months: offset })"
              multiple
              :min-value="min"
              :week-starts-on="1"
              :number-of-months="1"
              weekday-format="short"
              :fixed-weeks="false"
              :disabled="busy"
              :is-date-disabled="(date) => blocked.has(date.toString())"
              :year-controls="false"
              :view-control="false"
              locale="en-GB"
              :ui="{
                header: offset ? '[&>button]:invisible' : '',
                body: 'flex-col items-center sm:flex-col sm:space-x-0 space-y-5 sm:space-y-5',
                grid: 'max-w-[322px]',
                cell: 'flex justify-center',
                cellTrigger: 'm-0 size-11 rounded-full',
                headingLabel: 'text-base font-bold',
                headCell: 'text-xs text-muted',
              }"
              @update:placeholder="month = $event.subtract({ months: offset })"
              @update:model-value="
                selectMonth(Array.isArray($event) ? $event : [], offset)
              "
            >
              <template #day="{ day }"
                ><span
                  class="blocked-day"
                  :class="{
                    'is-blocked': blocked.has(day.toString()),
                    'no-hours': noHours(day) && !blocked.has(day.toString()),
                  }"
                  >{{ day.day }}</span
                ></template
              >
            </UCalendar>
          </div>
          <div class="blocked-legend">
            <span><i class="selected-dot" />Selected</span
            ><span
              ><i class="blocked-dot" /><span class="lg:hidden">Blocked</span
              ><span class="hidden lg:inline">Already blocked</span></span
            ><span
              ><i class="empty-dot" /><span class="lg:hidden"
                >No working hours</span
              ><span class="hidden lg:inline"
                >No working hours that day</span
              ></span
            >
          </div>
        </div>
        <div class="blocked-side">
          <section
            class="blocked-card space-y-3"
            aria-label="Block selected dates"
          >
            <h2 class="text-base font-bold">
              {{
                selected.length
                  ? 'Block ' +
                    selected.length +
                    (selected.length === 1 ? ' date' : ' dates')
                  : 'Select dates to block'
              }}
            </h2>
            <p v-if="!selected.length" class="text-[13px] text-muted">
              Choose one or more dates on the calendar.
            </p>
            <div v-else class="flex flex-wrap gap-1.5">
              <UButton
                v-for="date in selected"
                :key="date.toString()"
                variant="soft"
                size="xs"
                :disabled="busy"
                :aria-label="'Remove ' + date.toString() + ' from selection'"
                @click="
                  selected = selected.filter(
                    (item) => item.toString() !== date.toString(),
                  )
                "
                >{{ dateLabel(date) }}</UButton
              >
            </div>
            <UFormField label="Reason (optional, only you see it)"
              ><UInput
                v-model="reason"
                maxlength="1000"
                :disabled="busy"
                class="w-full"
                :ui="{
                  base: 'min-h-11 rounded-[10px] bg-(--brand-surface) ring-default',
                }"
            /></UFormField>
            <aside
              v-if="affected.length"
              class="booking-warning text-[13px] leading-[19px]"
              role="status"
            >
              <p class="font-bold">
                {{ affected.length }}
                {{ affected.length === 1 ? 'session' : 'sessions' }} on these
                dates
              </p>
              <ul>
                <li v-for="session in affected" :key="session.id">
                  {{
                    scheduleDate(
                      session.startAt,
                      user?.timezone ?? 'UTC',
                      true,
                    )
                  }},
                  {{ formatTime(session.startAt, user?.timezone ?? 'UTC') }} –
                  {{ session.member.name }}
                </li>
              </ul>
              <p>
                These sessions stay booked. Cancel them from your
                <NuxtLink to="/pro/schedule" class="underline"
                  >schedule</NuxtLink
                >
                if needed.
              </p>
            </aside>
            <p
              v-if="bookingError && selected.length"
              class="text-xs text-muted"
            >
              Couldn't check existing sessions. Blocking keeps existing
              bookings.
            </p>
            <p
              v-if="selected.length > 90"
              role="alert"
              class="text-sm text-error"
            >
              Select no more than 90 dates.
            </p>
            <UButton
              block
              class="min-h-11 justify-center font-bold"
              aria-label="Block selected dates"
              :disabled="busy || !selected.length || selected.length > 90"
              :loading="busy"
              @click="save"
              >Block {{ selected.length || '' }}
              {{ selected.length === 1 ? 'date' : 'dates' }}</UButton
            >
          </section>
          <section class="blocked-card" aria-label="Upcoming blocked dates">
            <h2 class="mb-2 text-base font-bold">Upcoming blocked dates</h2>
            <p v-if="!upcoming.length" class="text-sm text-muted">
              No upcoming blocked dates
            </p>
            <ul v-else>
              <li
                v-for="date in upcoming"
                :key="date.id"
                class="flex items-center justify-between gap-3 border-t border-default py-2"
              >
                <div class="min-w-0">
                  <p class="text-sm font-semibold">
                    {{ formatDate(date.localDate + 'T12:00:00Z', 'UTC') }}
                  </p>
                  <p
                    v-if="date.reason"
                    class="text-xs text-muted wrap-anywhere"
                  >
                    {{ date.reason }}
                  </p>
                </div>
                <UButton
                  variant="outline"
                  class="min-h-11 shrink-0 justify-center"
                  :disabled="busy"
                  :aria-label="'Unblock ' + date.localDate"
                  @click="remove(date.id, date.localDate)"
                  >Unblock</UButton
                >
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </section>
</template>
<style scoped>
.booking-warning {
  padding: 12px;
  border: 1px solid #ffbe45;
  border-radius: 14px;
  color: var(--ui-warning);
  background: var(--brand-surface);
}
.blocked-page {
  display: grid;
  gap: 16px;
}
.blocked-layout,
.blocked-side {
  display: grid;
  gap: 16px;
  align-items: start;
}
.blocked-card {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--brand-surface);
}
.blocked-calendar {
  padding: 12px 8px;
}
.blocked-months {
  container-type: inline-size;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 322px), 1fr));
  gap: 24px;
}
@container (min-width: 668px) {
  .first-month :deep([data-slot='header'] > button:last-child) {
    visibility: hidden;
  }
  .second-month :deep([data-slot='header'] > button:last-child) {
    visibility: visible;
  }
}
.blocked-calendar :deep([data-outside-view]) {
  visibility: hidden;
}
.blocked-day {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
}
.is-blocked,
.blocked-dot {
  background: repeating-linear-gradient(135deg, #e2e8ec 0 4px, #f4f8fa 4px 8px);
  border: 1px solid #a8bdc7;
  color: #415b65;
}
.no-hours {
  border: 1px solid #c9d6dc;
}
.blocked-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 8px 0;
  border-top: 1px solid var(--ui-border);
  font-size: 11px;
  color: var(--ui-text-muted);
}
.blocked-legend > span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.blocked-legend i {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
}
.selected-dot {
  background: var(--ui-primary);
}
.empty-dot {
  border: 1px solid #c9d6dc;
}
@media (min-width: 1024px) {
  .blocked-page {
    gap: 20px;
    margin-right: -16px;
  }
  .blocked-layout {
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 20px;
  }
  .blocked-card {
    padding: 20px;
  }
  .blocked-legend {
    font-size: 12px;
    padding-inline: 0;
  }
}
</style>
