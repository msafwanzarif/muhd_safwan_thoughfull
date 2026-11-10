<script setup lang="ts">
import type { components } from '~/types/api';
import type { WorkingRange } from '~/utils/schedule';
import { copyRanges, rangeError } from '~/utils/hours';
import { problemMessage } from '~/utils/problem';
import { scheduleTimezone } from '~/utils/schedule-display';

definePageMeta({ layout: 'professional' });
useHead({ title: 'Working hours · ThoughtFull' });
const api = useApi();
const user = useCurrentUser();
const zone = computed(() => scheduleTimezone(user.value?.timezone ?? 'UTC'));
const {
  data,
  status,
  error: loadError,
  refresh,
} = await useAsyncData('working-hours-editor', () =>
  api('/api/v1/working-hours', { method: 'get' }),
);
const draft = ref<WorkingRange[]>(copyRanges(data.value?.ranges ?? []));
const baseline = ref(JSON.stringify(draft.value));
const busy = ref(false);
const error = ref('');
const saved = ref(false);
const warnings = ref<components['schemas']['AffectedSessionDto'][]>([]);
const dirty = computed(() => JSON.stringify(draft.value) !== baseline.value);
const invalid = computed(() => rangeError(draft.value));
const modalOpen = ref(false);
const timezone = ref(user.value?.timezone ?? 'UTC');
const replacement = ref<WorkingRange[]>([]);
const clearAvailability = ref(false);
const timezoneDirty = computed(
  () =>
    modalOpen.value &&
    (timezone.value !== user.value?.timezone ||
      replacement.value.length > 0 ||
      clearAvailability.value),
);
const timezoneOpen = computed({
  get: () => modalOpen.value,
  set: (value) => {
    if (
      !value &&
      timezoneDirty.value &&
      !window.confirm('Discard the new timezone and replacement hours?')
    )
      return;
    modalOpen.value = value;
  },
});
const desktop = useMediaQuery('(min-width: 1024px)');
useUnsavedChanges(computed(() => dirty.value || timezoneDirty.value));
watch(data, (value) => {
  if (value && !dirty.value) applyRanges(value.ranges);
});

function applyRanges(ranges: WorkingRange[]) {
  draft.value = copyRanges(ranges);
  baseline.value = JSON.stringify(draft.value);
}

function discard() {
  applyRanges(data.value?.ranges ?? []);
  error.value = '';
}

function openTimezone() {
  timezone.value = user.value?.timezone ?? 'UTC';
  replacement.value = [];
  clearAvailability.value = false;
  error.value = '';
  modalOpen.value = true;
}

async function save() {
  if (invalid.value || busy.value) return;
  busy.value = true;
  error.value = '';
  saved.value = false;
  try {
    const result = await api('/api/v1/working-hours', {
      method: 'put',
      body: { ranges: copyRanges(draft.value) },
    });
    data.value = result;
    applyRanges(result.ranges);
    warnings.value = result.warnings;
    saved.value = true;
    await refreshNuxtData(['schedule-hours', 'professional-schedule']);
  } catch (cause) {
    error.value = problemMessage(cause);
  } finally {
    busy.value = false;
  }
}

async function saveTimezone() {
  if (
    busy.value ||
    timezone.value === user.value?.timezone ||
    rangeError(replacement.value) ||
    (!replacement.value.length && !clearAvailability.value)
  )
    return;
  busy.value = true;
  error.value = '';
  try {
    const result = await api('/api/v1/users/me/timezone', {
      method: 'patch',
      body: { timezone: timezone.value, ranges: copyRanges(replacement.value) },
    });
    if (user.value) user.value = { ...user.value, timezone: result.timezone };
    data.value = { timezone: result.timezone, ranges: result.ranges };
    applyRanges(result.ranges);
    warnings.value = result.warnings;
    saved.value = true;
    modalOpen.value = false;
    await refreshNuxtData(['schedule-hours', 'professional-schedule']);
  } catch (cause) {
    error.value = problemMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="hours-page">
    <header>
      <h1 class="text-2xl leading-8 font-bold lg:text-3xl lg:leading-10">
        Working hours
      </h1>
      <p
        class="mt-1 text-[13px] leading-[19px] text-muted lg:text-sm lg:leading-5"
      >
        <span class="lg:hidden"
          >50-minute sessions start every hour from each range’s start. Ranges
          are whole hours.</span
        >
        <span class="hidden max-w-[670px] lg:block"
          >Members can book 50-minute sessions starting every hour from the
          start of each range, with a 10-minute break between them. Each range
          must be a whole number of hours.</span
        >
      </p>
    </header>
    <div class="hours-zone">
      <UIcon
        name="i-lucide-globe"
        class="hidden size-5 shrink-0 text-secondary lg:block"
      />
      <div class="min-w-0 flex-1">
        <p class="text-xs leading-[18px] text-muted">Your time zone</p>
        <p class="text-sm font-semibold lg:text-base">
          {{ zone.city }} ({{ zone.offset }})<span class="hidden lg:inline">
            · all times below are in this zone</span
          >
        </p>
      </div>
      <UButton
        variant="outline"
        class="min-h-11 justify-center"
        :disabled="dirty || busy"
        aria-label="Change time zone"
        @click="openTimezone"
        ><span class="lg:hidden">Change</span
        ><span class="hidden lg:inline">Change time zone</span></UButton
      >
    </div>
    <p v-if="dirty" class="text-sm text-muted">
      Save or discard your changes before changing time zone.
    </p>
    <USkeleton v-if="status === 'pending'" class="h-80 rounded-xl" />
    <UAlert
      v-else-if="loadError"
      role="alert"
      color="error"
      title="We couldn't load working hours."
      ><template #actions
        ><UButton variant="outline" @click="refresh()"
          >Try again</UButton
        ></template
      ></UAlert
    >
    <template v-else>
      <UAlert
        v-if="saved && !warnings.length"
        role="status"
        color="success"
        title="Availability saved."
      />
      <UAlert
        v-if="error && !modalOpen"
        role="alert"
        color="error"
        :title="error"
      />
      <HoursKeptSessions :warnings="warnings" />
      <HoursEditor v-model="draft" :disabled="busy" />
      <UAlert v-if="invalid" role="alert" color="error" :title="invalid" />
      <p v-if="!draft.length" class="text-sm text-muted">
        Saving an empty week removes all availability. Existing sessions are
        kept.
      </p>
      <footer class="hours-footer">
        <p class="text-[13px] text-muted">
          Start times go in 15-minute steps. Saving replaces your whole week at
          once.
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            variant="outline"
            class="min-h-11 justify-center"
            :disabled="!dirty || busy"
            @click="discard"
            >Discard changes</UButton
          >
          <UButton
            class="min-h-11 justify-center font-bold"
            :disabled="!dirty || !!invalid || busy"
            :loading="busy"
            @click="save"
            >Save week</UButton
          >
        </div>
      </footer>
    </template>
    <UModal
      v-model:open="timezoneOpen"
      title="Change time zone and replace hours"
      description="Enter your complete working week in the new time zone. Hours are not converted, and ranges cannot cross midnight. Existing bookings keep their UTC times; blocked calendar dates stay unchanged."
      :fullscreen="!desktop"
      :dismissible="!busy"
      :close="busy ? false : { class: 'size-11' }"
      :ui="{ content: 'sm:max-w-4xl' }"
    >
      <template #body
        ><div class="space-y-6">
          <UFormField label="New city or time zone"
            ><AppTimezonePicker v-model="timezone"
          /></UFormField>
          <UAlert v-if="error" role="alert" color="error" :title="error" />
          <HoursEditor v-model="replacement" :disabled="busy" />
          <UAlert
            v-if="rangeError(replacement)"
            color="error"
            :title="rangeError(replacement)"
          />
          <UCheckbox
            v-if="!replacement.length"
            v-model="clearAvailability"
            label="I want no availability in the new time zone."
            :disabled="busy"
          /></div
      ></template>
      <template #footer
        ><UButton
          class="min-h-11"
          :loading="busy"
          :disabled="
            busy ||
            timezone === user?.timezone ||
            !!rangeError(replacement) ||
            (!replacement.length && !clearAvailability)
          "
          @click="saveTimezone"
          >Save time zone and replacement week</UButton
        ></template
      >
    </UModal>
  </section>
</template>

<style scoped>
.hours-page {
  display: grid;
  gap: 16px;
}
.hours-zone {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 12px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 15px;
  background: var(--brand-surface);
}
.hours-footer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
@media (min-width: 1024px) {
  .hours-page {
    gap: 20px;
    margin-right: -16px;
  }
  .hours-zone {
    padding: 14px 18px;
    min-height: 74px;
  }
  .hours-footer {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
