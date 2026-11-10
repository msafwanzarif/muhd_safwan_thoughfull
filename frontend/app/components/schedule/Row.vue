<script setup lang="ts">
import type { Session } from '~/utils/schedule';
import { formatTime } from '~/utils/dates';
import { scheduleDate, scheduleInitials } from '~/utils/schedule-display';

const props = defineProps<{ session: Session; timezone: string }>();
const emit = defineEmits<{ cancel: [session: Session] }>();
const api = useApi();
const route = useRoute();
const now = useNow({ interval: 30000 });
const minutes = computed(() =>
  Math.ceil((Date.parse(props.session.startAt) - now.value.getTime()) / 60000),
);
const startsSoon = computed(
  () =>
    props.session.status === 'active' &&
    minutes.value > 0 &&
    minutes.value <= 60,
);
const original = props.session.rescheduledFromId
  ? useAsyncData(`schedule-origin-${props.session.rescheduledFromId}`, () =>
      api('/api/v1/sessions/{id}', {
        method: 'get',
        params: { id: props.session.rescheduledFromId! },
      }),
    )
  : undefined;
const metadata = computed(() =>
  props.session.rescheduledFromId
    ? `Rescheduled from ${original?.data.value ? scheduleDate(original.data.value.startAt, props.timezone, true) : 'another time'}`
    : `Booked ${scheduleDate(props.session.createdAt, props.timezone)}`,
);
</script>

<template>
  <article
    class="schedule-row"
    :class="session.status !== 'active' ? 'schedule-row-inactive' : ''"
    :aria-label="`Session with ${session.member.name}`"
  >
    <div class="hidden w-[130px] shrink-0 lg:block">
      <p class="schedule-time">
        {{ formatTime(session.startAt, timezone) }} –
        {{ formatTime(session.endAt, timezone) }}
      </p>
      <p class="text-xs leading-[18px] text-muted">50 min</p>
    </div>

    <UAvatar
      :alt="session.member.name"
      :text="scheduleInitials(session.member.name)"
      :ui="{
        root: 'size-10 shrink-0 bg-teal-brand-200 dark:bg-teal-brand-800',
        fallback: 'text-sm font-semibold text-primary dark:text-teal-brand-200',
      }"
    />

    <div class="min-w-0 flex-1">
      <p class="schedule-time lg:hidden">
        {{ formatTime(session.startAt, timezone) }} –
        {{ formatTime(session.endAt, timezone) }}
      </p>
      <h3 class="schedule-participant">{{ session.member.name }}</h3>
      <NuxtLink
        v-if="session.rescheduledFromId"
        :to="{
          path: route.path,
          query: { ...route.query, session: session.rescheduledFromId },
        }"
        class="hidden text-xs leading-[18px] text-muted hover:underline lg:block"
        >{{ metadata }}</NuxtLink
      >
      <p v-else class="hidden text-xs leading-[18px] text-muted lg:block">
        {{ metadata }}
      </p>
      <span v-if="startsSoon" class="schedule-soon mt-1 flex w-fit lg:hidden"
        >Starts in {{ minutes }} min</span
      >
      <p
        v-if="session.status !== 'active'"
        class="text-xs leading-[18px] text-muted"
      >
        {{ session.status === 'rescheduled' ? 'Rescheduled' : 'Cancelled'
        }}<span v-if="session.reason"> · {{ session.reason }}</span>
      </p>
    </div>

    <span v-if="startsSoon" class="schedule-soon hidden shrink-0 lg:inline-flex"
      >Starts in {{ minutes }} min</span
    >
    <UButton
      v-if="session.status === 'active'"
      variant="outline"
      class="schedule-cancel"
      :aria-label="`Cancel session with ${session.member.name}`"
      @click="emit('cancel', session)"
      >Cancel</UButton
    >
  </article>
</template>

<style scoped>
.schedule-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  border: 1px solid var(--ui-border);
  border-radius: 15px;
  background: var(--brand-surface);
}
.schedule-row-inactive {
  border-style: dashed;
  background: var(--ui-bg-muted);
}
.schedule-time {
  color: var(--ui-primary);
  font-size: 16px;
  font-family: var(--font-heading);
  font-weight: 700;
  line-height: 20px;
  white-space: nowrap;
}
.schedule-participant {
  color: var(--ui-text);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.schedule-soon {
  align-items: center;
  border-radius: 999px;
  background: var(--color-teal-brand-50);
  color: var(--color-teal-brand-600);
  padding: 2px 8px;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
}
.schedule-cancel {
  flex-shrink: 0;
  min-width: 78px;
  min-height: 44px;
  justify-content: center;
  padding: 10px 16px;
  width: 78px;
  border: 1px solid #c9d6dc;
  box-shadow: none;
}
:global(.dark) .schedule-soon {
  background: var(--color-teal-brand-900);
  color: var(--color-teal-brand-400);
}
:global(.dark) .schedule-cancel {
  border-color: var(--ui-border);
}
@media (min-width: 1024px) {
  .schedule-row {
    gap: 17px;
    padding: 14px 17px;
  }
  .schedule-participant {
    font-size: 16px;
    line-height: 22px;
  }
  .schedule-cancel {
    min-width: 86px;
    width: 86px;
  }
}
@media (max-width: 1023px) {
  .schedule-row:has(.schedule-soon) {
    min-height: 90px;
  }
  .schedule-cancel {
    padding-inline: 0;
  }
}
</style>
