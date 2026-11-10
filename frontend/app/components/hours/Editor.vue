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
  <div class="hours-editor">
    <section v-for="day in days" :key="day.value" class="hours-day">
      <div class="hours-day-heading">
        <h3 class="font-semibold">{{ day.label }}</h3>
        <UButton
          variant="outline"
          class="hours-add min-h-11 justify-center border border-[#c9d6dc] ring-0"
          icon="i-lucide-plus"
          :aria-label="`Add ${day.label} range`"
          :disabled="disabled || ranges.length >= 168"
          @click="add(day.value)"
          >Add range</UButton
        >
      </div>
      <p
        v-if="!ranges.some((range) => range.weekday === day.value)"
        class="text-sm text-muted"
      >
        Not working
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

<style scoped>
.hours-editor {
  display: grid;
  gap: 16px;
}
.hours-day {
  position: relative;
  padding: 14px;
  border: 1px solid var(--ui-border);
  border-radius: 15px;
  background: var(--brand-surface);
}
.hours-day-heading {
  margin-bottom: 8px;
}
.hours-add {
  width: 100%;
  margin-top: 10px;
}
.hours-day-heading {
  display: contents;
}
.hours-day h3 {
  margin-bottom: 8px;
  font-size: 16px;
  line-height: 24px;
}
.hours-add {
  position: absolute;
  bottom: 14px;
  left: 14px;
  width: calc(100% - 28px);
}
.hours-day {
  padding-bottom: 56px;
}
@media (max-width: 1199px) {
  .hours-day > p {
    margin-bottom: 14px;
  }
}
@media (min-width: 1200px) {
  .hours-editor {
    gap: 0;
    border: 1px solid var(--ui-border);
    border-radius: 15px;
    overflow: hidden;
    background: var(--brand-surface);
  }
  .hours-day {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    column-gap: 10px;
    row-gap: 10px;
    min-height: 77px;
    padding: 16px 170px 16px 20px;
    border: 0;
    border-bottom: 1px solid var(--ui-border);
    border-radius: 0;
  }
  .hours-day:last-child {
    border-bottom: 0;
  }
  .hours-day h3 {
    grid-column: 1;
    grid-row: 1;
    margin: 10px 0 0;
  }
  .hours-day > p {
    grid-column: 2;
    align-self: center;
  }
  .hours-add {
    top: 16px;
    bottom: auto;
    right: 20px;
    left: auto;
    width: 132px;
    margin: 0;
  }
}
</style>
