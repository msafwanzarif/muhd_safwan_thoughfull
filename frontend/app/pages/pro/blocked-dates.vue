<script setup lang="ts">
import type { DateValue } from '@internationalized/date';
import type { components } from '~/types/api';
import { calendarDateInZone, timezoneLabel } from '~/utils/professionals';
import { formatDate } from '~/utils/dates';
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
const selected = shallowRef<DateValue[]>([]);
const reason = ref('');
const busy = ref(false);
const error = ref('');
const success = ref('');
const now = useNow({ interval: 60000 });
const min = computed(() =>
  calendarDateInZone(now.value, user.value?.timezone ?? 'UTC'),
);
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
        dates: selected.value.map((date) => ({
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
  } catch (cause) {
    error.value = problemMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="max-w-4xl space-y-6">
    <h1 class="text-3xl font-bold">Blocked dates</h1>
    <p class="text-muted">
      Whole calendar days in {{ timezoneLabel(user?.timezone ?? 'UTC') }}.
      Blocking a day stops new bookings; existing sessions are kept.
    </p>
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
      <UAlert
        v-if="success"
        role="status"
        color="success"
        :title="success"
      /><UAlert
        v-if="error"
        role="alert"
        color="error"
        :title="error"
      /><HoursKeptSessions :warnings="warnings" />
      <div
        class="space-y-6 rounded-2xl border border-default bg-(--brand-surface) p-4 sm:p-6"
      >
        <UCalendar
          v-model="selected"
          multiple
          :min-value="min"
          :week-starts-on="1"
          :number-of-months="desktop ? 2 : 1"
          :disabled="busy"
          locale="en-GB"
          :ui="{ cellTrigger: 'm-0 h-11 w-full' }"
          ><template #day="{ day }"
            ><span>{{ day.day }}</span
            ><span
              v-if="blocked.has(day.toString())"
              aria-label="Already blocked"
              class="absolute bottom-1 size-1 rounded-full bg-red-600" /></template
        ></UCalendar>
        <p class="text-sm text-muted">
          {{ selected.length }} selected · Select up to 90 dates. Red dots mark
          blocked days.
        </p>
        <div v-if="selected.length" class="flex flex-wrap gap-2">
          <UButton
            v-for="date in selected"
            :key="date.toString()"
            variant="soft"
            trailing-icon="i-lucide-x"
            :disabled="busy"
            :aria-label="`Remove ${date.toString()} from selection`"
            @click="
              selected = selected.filter(
                (item) => item.toString() !== date.toString(),
              )
            "
            >{{ date.toString() }}</UButton
          >
        </div>
        <UFormField label="Reason (optional)"
          ><UTextarea
            v-model="reason"
            maxlength="1000"
            :disabled="busy"
            class="w-full"
            :rows="3"
        /></UFormField>
        <div class="flex flex-wrap gap-3">
          <UButton
            class="min-h-11"
            :disabled="busy || !selected.length || selected.length > 90"
            :loading="busy"
            @click="save"
            >Block selected dates</UButton
          ><UButton
            variant="outline"
            class="min-h-11"
            :disabled="busy || (!selected.length && !reason)"
            @click="
              selected = [];
              reason = '';
            "
            >Clear selection</UButton
          >
        </div>
      </div>
      <h2 class="text-xl font-bold">Upcoming blocked dates</h2>
      <UEmpty
        v-if="!upcoming.length"
        icon="i-lucide-calendar-off"
        title="No upcoming blocked dates"
      />
      <ul v-else class="space-y-3">
        <li
          v-for="date in upcoming"
          :key="date.id"
          class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-default bg-(--brand-surface) p-4"
        >
          <div>
            <p class="font-semibold">
              {{ formatDate(`${date.localDate}T12:00:00Z`, 'UTC') }}
            </p>
            <p v-if="date.reason" class="mt-1 text-sm text-muted">
              {{ date.reason }}
            </p>
          </div>
          <UButton
            variant="outline"
            class="min-h-11"
            :disabled="busy"
            :aria-label="`Unblock ${date.localDate}`"
            @click="remove(date.id, date.localDate)"
            >Unblock</UButton
          >
        </li>
      </ul>
    </template>
  </section>
</template>
