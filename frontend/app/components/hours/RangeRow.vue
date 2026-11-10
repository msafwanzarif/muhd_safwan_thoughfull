<script setup lang="ts">
import { Time } from '@internationalized/date';
import type { WorkingRange } from '~/utils/schedule';
import { minuteLabel } from '~/utils/hours';

const props = defineProps<{
  range: WorkingRange;
  disabled?: boolean;
  label: string;
}>();
const emit = defineEmits<{ change: [range: WorkingRange]; remove: [] }>();
const time = computed(() =>
  props.range.startMinute >= 0 && props.range.startMinute < 1440
    ? new Time(
        Math.floor(props.range.startMinute / 60),
        props.range.startMinute % 60,
      )
    : undefined,
);
const lengths = Array.from({ length: 24 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1} ${index ? 'hours' : 'hour'}`,
}));

function setTime(value: unknown) {
  emit('change', {
    ...props.range,
    startMinute:
      value && typeof value === 'object' && 'hour' in value && 'minute' in value
        ? Number(value.hour) * 60 + Number(value.minute)
        : -1,
  });
}
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <UFormField :label="`${label} start`"
      ><UInputTime
        :model-value="time"
        :hour-cycle="24"
        :step="{ minute: 15 }"
        granularity="minute"
        locale="en-GB"
        :disabled="disabled"
        :ui="{ base: 'min-h-11' }"
        @update:model-value="setTime"
    /></UFormField>
    <UFormField :label="`${label} length`"
      ><USelect
        :model-value="range.lengthHours"
        :items="lengths"
        :disabled="disabled"
        class="min-w-28"
        :ui="{ base: 'min-h-11' }"
        @update:model-value="
          emit('change', { ...range, lengthHours: $event ?? 1 })
        "
    /></UFormField>
    <UButton
      icon="i-lucide-trash-2"
      color="error"
      variant="ghost"
      :aria-label="`Remove ${label}`"
      :disabled="disabled"
      class="size-11 justify-center"
      @click="emit('remove')"
    />
    <p v-if="range.startMinute >= 0" class="w-full text-xs text-muted">
      Ends {{ minuteLabel(range.startMinute + range.lengthHours * 60) }} ·
      {{ range.lengthHours }} {{ range.lengthHours === 1 ? 'slot' : 'slots' }}
    </p>
  </div>
</template>
