<script setup lang="ts">
import type { WorkingRange } from '~/utils/schedule';

const ranges = defineModel<WorkingRange[]>({ required: true });
defineProps<{ disabled?: boolean }>();
const days = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

function add(weekday: number) {
  const last = ranges.value.filter((range) => range.weekday === weekday).at(-1);
  const end = last ? last.startMinute + last.lengthHours * 60 : 540;
  ranges.value = [
    ...ranges.value,
    { weekday, startMinute: Math.min(end, 1380), lengthHours: 1 },
  ];
}

function update(index: number, value: WorkingRange) {
  ranges.value = ranges.value.map((range, current) =>
    current === index ? value : range,
  );
}

function remove(index: number) {
  ranges.value = ranges.value.filter((_, current) => current !== index);
}
</script>

<template>
  <div class="space-y-4">
    <section
      v-for="day in days"
      :key="day.value"
      class="space-y-4 rounded-xl border border-default bg-(--brand-surface) p-4"
    >
      <div class="flex items-center justify-between gap-3">
        <h3 class="font-semibold">{{ day.label }}</h3>
        <UButton
          variant="outline"
          class="min-h-11"
          :disabled="disabled || ranges.length >= 168"
          @click="add(day.value)"
          >Add {{ day.label }} range</UButton
        >
      </div>
      <p
        v-if="!ranges.some((range) => range.weekday === day.value)"
        class="text-sm text-muted"
      >
        Not available
      </p>
      <template v-for="(range, index) in ranges" :key="index"
        ><HoursRangeRow
          v-if="range.weekday === day.value"
          :range="range"
          :label="`${day.label} range ${ranges.slice(0, index + 1).filter((item) => item.weekday === day.value).length}`"
          :disabled="disabled"
          @change="update(index, $event)"
          @remove="remove(index)"
      /></template>
    </section>
  </div>
</template>
