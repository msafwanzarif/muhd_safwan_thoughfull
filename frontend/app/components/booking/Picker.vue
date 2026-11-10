<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date';
import type { components } from '~/types/api';
import {
  formatDate,
  formatSession,
  formatTime,
  localDate,
  meetsNotice,
} from '~/utils/dates';
import { calendarDateInZone, timezoneLabel } from '~/utils/professionals';

type Slot = components['schemas']['SlotResponseDto'];
const props = defineProps<{ professionalId: string; currentStart?: string }>();
const selected = defineModel<Slot | undefined>();
const api = useApi();
const user = useCurrentUser();
const timezone = computed(() => user.value?.timezone ?? 'UTC');
const now = useNow({ interval: 30000 });
const desktop = useMediaQuery('(min-width: 1024px)');
const min = computed(() => calendarDateInZone(now.value, timezone.value));
const max = computed(() => min.value.add({ days: 28 }));
const day = shallowRef<DateValue>();
const { data, status, error, refresh } = useAsyncData(
  () => `slots-${props.professionalId}`,
  () =>
    api('/api/v1/professionals/{professionalId}/slots', {
      method: 'get',
      params: { professionalId: props.professionalId },
    }),
);
const slots = computed(() => data.value?.slots ?? []);
const available = (slot: Slot) =>
  slot.available && meetsNotice(slot.startAt, now.value.getTime());
const freeDays = computed(
  () =>
    new Set(
      slots.value
        .filter(available)
        .map((slot) => localDate(slot.startAt, timezone.value)),
    ),
);
const daySlots = computed(() =>
  slots.value.filter(
    (slot) => localDate(slot.startAt, timezone.value) === day.value?.toString(),
  ),
);

watch(
  [slots, timezone],
  () => {
    selected.value = undefined;
    if (!day.value) {
      const first = slots.value.find(available);
      day.value = first
        ? parseDate(localDate(first.startAt, timezone.value))
        : min.value;
    }
  },
  { immediate: true },
);
watch(day, () => {
  selected.value = undefined;
});
watch(now, () => {
  if (selected.value && !available(selected.value)) selected.value = undefined;
});

function select(slot: Slot) {
  if (available(slot)) selected.value = slot;
}

defineExpose({ refresh });
</script>

<template>
  <div class="space-y-5">
    <p class="text-sm text-muted">
      Times in {{ timezoneLabel(timezone) }}. Book today through 28 days ahead,
      with at least two hours' notice.
    </p>
    <USkeleton
      v-if="status === 'pending'"
      class="h-80 rounded-xl"
      aria-label="Loading available times"
    />
    <UAlert
      v-else-if="error"
      role="alert"
      color="error"
      title="We couldn't load available times."
    >
      <template #actions
        ><UButton variant="outline" class="min-h-11" @click="refresh()"
          >Try again</UButton
        ></template
      >
    </UAlert>
    <template v-else>
      <UCalendar
        v-model="day"
        :min-value="min"
        :max-value="max"
        :week-starts-on="1"
        prevent-deselect
        :number-of-months="desktop ? 2 : 1"
        locale="en-GB"
        :fixed-weeks="true"
        :next-month="{ class: 'size-11' }"
        :prev-month="{ class: 'size-11' }"
        :ui="{ cell: 'flex justify-center', cellTrigger: 'm-0 size-11' }"
      >
        <template #day="{ day: date }">
          <span
            :class="
              currentStart &&
              localDate(currentStart, timezone) === date.toString()
                ? 'rounded-full border border-dashed border-primary px-1'
                : ''
            "
            >{{ date.day }}</span
          >
          <span
            v-if="freeDays.has(date.toString())"
            aria-label="Free times"
            class="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-teal-brand-600 dark:bg-teal-brand-400"
          />
        </template>
      </UCalendar>
      <p class="text-xs text-muted">
        ● Days with free times<span v-if="currentStart">
          · Dashed ring: current session</span
        >
      </p>
      <h3 class="border-t border-default pt-5 font-semibold">
        {{
          day
            ? formatDate(`${day.toString()}T12:00:00Z`, 'UTC')
            : 'Choose a day'
        }}
      </h3>
      <div
        v-if="daySlots.length"
        class="flex flex-wrap gap-3"
        aria-label="Session times"
      >
        <template v-for="slot in daySlots" :key="slot.startAt">
          <UButton
            v-if="available(slot)"
            :variant="selected?.startAt === slot.startAt ? 'solid' : 'outline'"
            :aria-pressed="selected?.startAt === slot.startAt"
            class="min-h-11 min-w-20 justify-center"
            @click="select(slot)"
            >{{ formatTime(slot.startAt, timezone) }}</UButton
          >
          <UPopover v-else>
            <UButton
              color="neutral"
              variant="soft"
              :aria-label="`${formatTime(slot.startAt, timezone)} unavailable. Show reason`"
              class="min-h-11 min-w-20 justify-center line-through"
              >{{ formatTime(slot.startAt, timezone) }}</UButton
            >
            <template #content
              ><p class="max-w-64 p-4 text-sm">
                {{
                  slot.available
                    ? 'This time is less than two hours away.'
                    : 'This time overlaps another session of yours.'
                }}
              </p></template
            >
          </UPopover>
        </template>
      </div>
      <p v-else class="text-muted">
        No times available on this day. Please choose another day.
      </p>
      <p
        v-if="selected"
        role="status"
        class="rounded-xl bg-muted p-4 font-semibold"
      >
        Selected:
        {{ formatSession(selected.startAt, selected.endAt, timezone) }}
      </p>
    </template>
  </div>
</template>
