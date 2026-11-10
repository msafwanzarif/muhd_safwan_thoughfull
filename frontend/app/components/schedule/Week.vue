<script setup lang="ts">
import { parseDate } from '@internationalized/date';
import type { components } from '~/types/api';
import {
  dayEvents,
  dayOfWeek,
  wallMinute,
  type Session,
  type WorkingRange,
} from '~/utils/schedule';
import {
  formatDate,
  formatSession,
  formatTime,
  localDate,
} from '~/utils/dates';

const props = defineProps<{
  sessions: Session[];
  ranges: WorkingRange[];
  blockedDates: components['schemas']['BlockedDateResponseDto'][];
  availabilityKnown: boolean;
  week: string;
  timezone: string;
}>();
const emit = defineEmits<{ select: [session: Session] }>();
const now = useNow({ interval: 30000 });
const blockedByDate = computed(
  () => new Map(props.blockedDates.map((date) => [date.localDate, date])),
);
const days = computed(() =>
  Array.from({ length: 7 }, (_, index) =>
    parseDate(props.week).add({ days: index }).toString(),
  ),
);
const bounds = computed(() => {
  const starts = [
    ...props.ranges.map((range) => range.startMinute),
    ...props.sessions.map((session) =>
      wallMinute(session.startAt, props.timezone),
    ),
  ];
  const ends = [
    ...props.ranges.map((range) => range.startMinute + range.lengthHours * 60),
    ...props.sessions.map((session) =>
      localDate(session.startAt, props.timezone) ===
      localDate(session.endAt, props.timezone)
        ? wallMinute(session.endAt, props.timezone)
        : 1440,
    ),
  ];
  return {
    start: starts.length ? Math.floor(Math.min(...starts) / 60) * 60 : 540,
    end: ends.length ? Math.ceil(Math.max(...ends) / 60) * 60 : 1080,
  };
});
const minutes = computed(() =>
  Array.from(
    { length: (bounds.value.end - bounds.value.start) / 15 },
    (_, index) => bounds.value.start + index * 15,
  ),
);
const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
function working(date: string, minute: number) {
  if (blockedByDate.value.has(date)) return false;
  return props.ranges.some(
    (range) =>
      range.weekday === dayOfWeek(date) &&
      minute >= range.startMinute &&
      minute < range.startMinute + range.lengthHours * 60,
  );
}
</script>

<template>
  <div class="space-y-4">
    <div
      class="overflow-x-auto rounded-2xl border border-default bg-(--brand-surface)"
    >
      <div
        class="grid min-w-[850px] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]"
      >
        <div aria-hidden="true" />
        <h3
          v-for="date in days"
          :key="date"
          class="border-b border-l border-default p-3 text-center text-xs font-semibold"
        >
          {{ formatDate(`${date}T12:00:00Z`, 'UTC') }}
          <UPopover v-if="blockedByDate.has(date)">
            <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-calendar-off"
              class="ml-1 inline-flex size-4 min-h-0 justify-center p-0 align-middle"
              :ui="{ leadingIcon: 'size-3' }"
              :aria-label="`Blocked ${date}. Show reason`"
              title="Blocked date — show reason"
            />
            <template #content
              ><p class="max-w-64 p-4 text-sm break-words">
                {{
                  blockedByDate.get(date)?.reason ||
                  'No new bookings are available on this date.'
                }}
              </p></template
            >
          </UPopover>
        </h3>
        <div
          class="relative"
          :style="{ height: `${bounds.end - bounds.start}px` }"
        >
          <span
            v-for="minute in minutes.filter((value) => value % 60 === 0)"
            :key="minute"
            class="absolute right-2 text-xs text-muted"
            :style="{ top: `${minute - bounds.start}px` }"
            >{{ clock(minute) }}</span
          >
        </div>
        <div
          v-for="date in days"
          :key="date"
          class="relative border-l border-default"
          :class="blockedByDate.has(date) ? 'bg-error/5' : ''"
          :data-date="date"
          :style="{ height: `${bounds.end - bounds.start}px` }"
        >
          <div
            v-for="minute in minutes"
            :key="minute"
            aria-hidden="true"
            class="absolute inset-x-0 h-[15px] border-b border-default/30"
            :class="
              !availabilityKnown
                ? 'bg-muted'
                : working(date, minute)
                  ? ''
                  : 'outside-hours'
            "
            :style="{ top: `${minute - bounds.start}px` }"
          />
          <button
            v-for="event in dayEvents(sessions, date, timezone)"
            :key="event.session.id"
            type="button"
            class="absolute z-10 min-h-11 overflow-hidden rounded-lg border p-1 text-left text-xs"
            :class="
              event.session.status !== 'active'
                ? 'border-dashed border-muted bg-muted text-muted'
                : Date.parse(event.session.endAt) < now.getTime()
                  ? 'border-default bg-muted text-muted'
                  : 'border-primary bg-primary text-inverted'
            "
            :style="{
              top: `${event.start - bounds.start}px`,
              height: `${Math.max(44, event.end - event.start)}px`,
              left: `calc(${(event.lane * 100) / event.lanes}% + 2px)`,
              width: `calc(${100 / event.lanes}% - 4px)`,
            }"
            :aria-label="`${event.session.member.name}, ${formatSession(event.session.startAt, event.session.endAt, timezone)}, ${event.session.status}`"
            @click="emit('select', event.session)"
          >
            <span
              class="block font-semibold"
              :class="event.session.status !== 'active' ? 'line-through' : ''"
              >{{ formatTime(event.session.startAt, timezone) }}</span
            ><span class="block truncate">{{ event.session.member.name }}</span
            ><span
              v-if="event.session.status !== 'active'"
              class="block text-[10px] font-semibold capitalize"
              >{{ event.session.status }}</span
            >
          </button>
          <div
            v-if="
              localDate(now.toISOString(), timezone) === date &&
              wallMinute(now.toISOString(), timezone) >= bounds.start &&
              wallMinute(now.toISOString(), timezone) < bounds.end
            "
            aria-label="Current time"
            class="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-600"
            :style="{
              top: `${wallMinute(now.toISOString(), timezone) - bounds.start}px`,
            }"
          />
        </div>
      </div>
    </div>
    <p class="text-xs text-muted">
      {{
        availabilityKnown
          ? 'Striped: outside working hours or blocked date'
          : 'Availability shading is unavailable'
      }}
      · Blue: upcoming · Muted: past/cancelled · Red line: now. Select a session
      for details.
    </p>
  </div>
</template>

<style scoped>
.outside-hours {
  background: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 5px,
    var(--ui-border) 5px,
    var(--ui-border) 6px
  );
}
</style>
