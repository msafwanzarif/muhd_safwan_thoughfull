<script setup lang="ts">
const props = defineProps<{
  page: number;
  pageSize: number;
  total: number;
  period: 'upcoming' | 'past';
  includingCancelled?: boolean;
}>();
const emit = defineEmits<{ change: [page: number] }>();
const pages = computed(() =>
  Math.max(1, Math.ceil(props.total / props.pageSize)),
);
const first = computed(() =>
  props.total ? (props.page - 1) * props.pageSize + 1 : 0,
);
const last = computed(() => Math.min(props.page * props.pageSize, props.total));
const numbers = computed(() => {
  const values = [
    ...new Set([1, props.page - 1, props.page, props.page + 1, pages.value]),
  ]
    .filter((value) => value >= 1 && value <= pages.value)
    .sort((a, b) => a - b);
  const result: (number | string)[] = [];
  for (const value of values) {
    const previous = result.at(-1);
    if (typeof previous === 'number' && value - previous > 1)
      result.push(`gap-${value}`);
    result.push(value);
  }
  return result;
});
</script>

<template>
  <footer v-if="total || page > 1" class="schedule-pagination">
    <p class="hidden text-[13px] leading-5 text-muted lg:block">
      Showing {{ first }}–{{ last }} of {{ total }} {{ period }} sessions<span
        v-if="includingCancelled"
        >, including cancelled</span
      >
    </p>
    <nav
      aria-label="Schedule pages"
      class="flex w-full items-center justify-between gap-2 lg:w-auto lg:justify-end"
    >
      <UButton
        variant="outline"
        class="schedule-page"
        :disabled="page <= 1"
        aria-label="Previous page"
        @click="emit('change', page - 1)"
        >Previous</UButton
      >
      <p class="text-[13px] text-muted lg:hidden">
        Page {{ page }} of {{ pages }}
      </p>
      <template v-for="number in numbers" :key="number"
        ><UButton
          v-if="typeof number === 'number'"
          :variant="number === page ? 'solid' : 'outline'"
          :aria-label="`Page ${number}`"
          :aria-current="number === page ? 'page' : undefined"
          class="schedule-page schedule-page-number hidden justify-center lg:inline-flex"
          @click="emit('change', number)"
          >{{ number }}</UButton
        ><span v-else class="hidden text-muted lg:inline">…</span></template
      >
      <UButton
        variant="outline"
        class="schedule-page"
        :disabled="page >= pages"
        aria-label="Next page"
        @click="emit('change', page + 1)"
        >Next</UButton
      >
    </nav>
  </footer>
</template>

<style scoped>
.schedule-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
}
.schedule-page {
  height: 44px;
  border-radius: 999px;
  padding: 10px 18px;
  border: 1px solid #c9d6dc;
  box-shadow: none;
}
.schedule-page[aria-current='page'] {
  border-color: var(--ui-primary);
}
.schedule-page-number {
  width: 44px;
  padding: 0;
}
.schedule-page:disabled {
  opacity: 0.5;
}
:global(.dark) .schedule-page {
  border-color: var(--ui-border);
}
@media (min-width: 1024px) {
  .schedule-pagination {
    margin-top: 28px;
  }
}
</style>
