<script setup lang="ts">
import type { WorkingRange } from '~/utils/schedule';
import { minuteLabel } from '~/utils/hours';

const props = defineProps<{
  range: WorkingRange;
  disabled?: boolean;
  label: string;
}>();
const emit = defineEmits<{ change: [range: WorkingRange]; remove: [] }>();
const hours = computed(() =>
  Array.from({ length: 24 }, (_, value) => ({
    value,
    label: String(value).padStart(2, '0'),
  })).filter(
    ({ value }) =>
      value * 60 +
        (props.range.startMinute % 60) +
        props.range.lengthHours * 60 <=
      1440,
  ),
);
const minutes = computed(() =>
  [0, 15, 30, 45]
    .map((value) => ({
      value,
      label: String(value).padStart(2, '0'),
    }))
    .filter(
      ({ value }) =>
        Math.floor(props.range.startMinute / 60) * 60 +
          value +
          props.range.lengthHours * 60 <=
        1440,
    ),
);
const compact = useMediaQuery('(max-width: 767px)');
const lengths = computed(() =>
  Array.from(
    { length: Math.max(0, Math.floor((1440 - props.range.startMinute) / 60)) },
    (_, index) => ({
      value: index + 1,
      label: compact.value
        ? `${index + 1}h`
        : `${index + 1} ${index ? 'hours' : 'hour'}`,
    }),
  ),
);

function setStart(part: 'hour' | 'minute', value: number | undefined) {
  if (value === undefined) return;
  const current = Math.max(0, props.range.startMinute);
  const hour = part === 'hour' ? value : Math.floor(current / 60);
  const minute = part === 'minute' ? value : current % 60;
  emit('change', { ...props.range, startMinute: hour * 60 + minute });
}
</script>

<template>
  <div class="hours-range">
    <UFormField
      label="Start"
      class="hours-field"
      :ui="{ label: 'text-xs font-normal text-muted', container: 'mt-0' }"
      ><div class="start-selects">
        <USelect
          :model-value="Math.floor(range.startMinute / 60)"
          :items="hours"
          :disabled="disabled"
          :aria-label="`${label} start hour`"
          class="start-select"
          @update:model-value="setStart('hour', $event)"
        />
        <span aria-hidden="true" class="text-muted">:</span>
        <USelect
          :model-value="range.startMinute % 60"
          :items="minutes"
          :disabled="disabled"
          :aria-label="`${label} start minute`"
          class="start-select"
          @update:model-value="setStart('minute', $event)"
        /></div
    ></UFormField>
    <UFormField
      label="Length"
      class="hours-field hours-length"
      :ui="{ label: 'text-xs font-normal text-muted', container: 'mt-0' }"
      ><USelect
        :model-value="range.lengthHours"
        :items="lengths"
        :disabled="disabled"
        :aria-label="`${label} length`"
        class="w-full"
        :ui="{
          base: 'min-h-11 rounded-[10px] bg-(--brand-surface) ring-default text-sm',
        }"
        @update:model-value="
          emit('change', { ...range, lengthHours: $event ?? 1 })
        "
    /></UFormField>
    <UButton
      icon="i-lucide-trash-2"
      color="neutral"
      variant="ghost"
      :aria-label="`Remove ${label}`"
      :disabled="disabled"
      class="hours-remove size-11 justify-center text-muted"
      @click="emit('remove')"
    />
    <p v-if="range.startMinute >= 0" class="hours-summary text-xs text-muted">
      Ends {{ minuteLabel(range.startMinute + range.lengthHours * 60) }} ·
      {{ range.lengthHours }} {{ range.lengthHours === 1 ? 'slot' : 'slots' }}
      <span class="hidden xl:inline"
        >:
        {{
          Array.from({ length: range.lengthHours }, (_, index) =>
            minuteLabel(range.startMinute + index * 60),
          ).join(', ')
        }}</span
      >
    </p>
  </div>
</template>

<style scoped>
.start-selects {
  display: flex;
  align-items: center;
  gap: 4px;
}
.start-select {
  min-width: 0;
  flex: 1;
  height: 44px;
  padding-inline: 8px;
  background: var(--brand-surface);
}
.hours-range {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 76px 36px;
  gap: 6px 8px;
  align-items: end;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--ui-border);
}
.hours-summary {
  grid-column: 1 / -1;
  line-height: 18px;
}
.hours-field {
  min-width: 0;
}
.hours-field :deep([data-slot='container']) {
  min-width: 0;
}
.hours-field :deep(input),
.hours-field :deep(button) {
  border-radius: 10px;
}
@media (min-width: 1200px) {
  .hours-range {
    grid-column: 2;
    grid-template-columns: 195px 169px minmax(0, 1fr) 36px;
    align-items: center;
    gap: 10px;
    padding: 0;
    margin: 0;
    border: 0;
  }
  .hours-range:last-child {
    margin-bottom: 0;
  }
  .hours-field {
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .hours-field :deep(label) {
    margin: 0;
  }
  .hours-field :deep([data-slot='container']) {
    margin: 0;
    min-width: 0;
    flex: 1;
    width: 120px;
  }
  .hours-length :deep([data-slot='container']) {
    flex: 0 0 120px;
    width: 120px;
  }
  .hours-length :deep(button) {
    width: 120px;
  }
  .hours-summary {
    grid-column: 3;
    grid-row: 1;
    overflow-wrap: anywhere;
  }
  .hours-remove {
    grid-column: 4;
    grid-row: 1;
  }
}
</style>
