<script setup lang="ts">
import type { components } from '~/types/api';
import type { WorkingRange } from '~/utils/schedule';
import { copyRanges, rangeError } from '~/utils/hours';
import { problemMessage } from '~/utils/problem';
import { timezoneLabel } from '~/utils/professionals';

definePageMeta({ layout: 'professional' });
useHead({ title: 'Working hours · ThoughtFull' });
const api = useApi();
const user = useCurrentUser();
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
  <section class="max-w-4xl space-y-6">
    <h1 class="text-3xl font-bold">Working hours</h1>
    <p class="text-muted">
      Times in {{ timezoneLabel(user?.timezone ?? 'UTC') }}. Use 15-minute
      starts and whole-hour lengths. Each hour contains a 50-minute session and
      a 10-minute gap.
    </p>
    <UButton
      variant="outline"
      class="min-h-11"
      :disabled="dirty || busy"
      @click="openTimezone"
      >Change time zone</UButton
    >
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
        v-if="saved"
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
      <div class="flex flex-wrap gap-3">
        <UButton
          class="min-h-11"
          :disabled="!dirty || !!invalid || busy"
          :loading="busy"
          @click="save"
          >Save week</UButton
        ><UButton
          variant="outline"
          class="min-h-11"
          :disabled="!dirty || busy"
          @click="discard"
          >Discard changes</UButton
        >
      </div>
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
