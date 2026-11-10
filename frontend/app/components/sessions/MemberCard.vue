<script setup lang="ts">
import type { components } from '~/types/api';
import { cancellationDeadline, formatTime, within24Hours } from '~/utils/dates';
import { scheduleDate, scheduleInitials } from '~/utils/schedule-display';
type Session = components['schemas']['SessionResponseDto'];
const props = defineProps<{ session: Session }>();
const emit = defineEmits<{
  cancel: [session: Session];
  reschedule: [session: Session];
}>();
const user = useCurrentUser();
const route = useRoute();
const now = useNow({ interval: 30000 });
const timezone = computed(() => user.value?.timezone ?? 'UTC');
const active = computed(() => props.session.status === 'active');
const future = computed(
  () => Date.parse(props.session.endAt) > now.value.getTime(),
);
const locked = computed(() =>
  within24Hours(props.session.startAt, now.value.getTime()),
);
const minutes = computed(() =>
  Math.ceil((Date.parse(props.session.startAt) - now.value.getTime()) / 60000),
);
const status = computed(() => {
  if (props.session.status === 'cancelled')
    return props.session.cancelledBy === props.session.professional.id
      ? `Cancelled by ${props.session.professional.name}`
      : `Cancelled by ${props.session.member.name}`;
  if (props.session.status === 'rescheduled') return 'Rescheduled';
  if (!future.value) return 'Ended';
  return minutes.value <= 0 ? 'In progress' : '';
});
function dateTime(value: string) {
  return (
    scheduleDate(value, timezone.value, true) +
    ', ' +
    formatTime(value, timezone.value)
  );
}
</script>
<template>
  <article
    :id="'session-' + session.id"
    class="member-session"
    :class="{ 'member-session-inactive': !active }"
  >
    <div class="flex items-start gap-3">
      <UAvatar
        :alt="session.professional.name"
        :text="scheduleInitials(session.professional.name)"
        :ui="{
          root: 'size-10 shrink-0 bg-teal-brand-200 dark:bg-teal-brand-800',
          fallback: 'text-xs font-semibold text-primary',
        }"
      />
      <div class="min-w-0 flex-1">
        <h2 class="session-date" :class="{ 'line-through': !active }">
          {{ dateTime(session.startAt) }} –
          {{ formatTime(session.endAt, timezone) }}
        </h2>
        <p class="mt-0.5 text-[15px] leading-[22px] text-muted">
          {{ session.professional.name }}
        </p>
      </div>
      <span v-if="status" class="session-status">{{ status }}</span>
    </div>
    <div v-if="active && future && locked" class="session-warning" role="note">
      <UIcon name="i-lucide-lock-keyhole" class="mt-0.5 size-4 shrink-0" />
      <p>
        <strong>{{
          minutes > 0 && minutes <= 60
            ? 'Starts in ' + minutes + ' minutes.'
            : minutes <= 0
              ? 'Session in progress.'
              : 'Less than 24 hours away.'
        }}</strong>
        Sessions can't be cancelled or rescheduled within 24 hours of the start.
      </p>
    </div>
    <div v-else-if="active && future" class="session-footer">
      <div class="min-w-0 flex-1 text-sm leading-5 text-muted">
        <p v-if="session.rescheduledFromId">
          Rescheduled from an earlier session.
          <NuxtLink
            :to="{
              path: route.path,
              query: { ...route.query, session: session.rescheduledFromId },
            }"
            class="text-primary underline"
            >View original session</NuxtLink
          >
        </p>
        <p>
          You can change this until
          {{ dateTime(cancellationDeadline(session.startAt)) }}.
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          variant="outline"
          class="min-h-11 justify-center"
          @click="emit('reschedule', session)"
          >Reschedule</UButton
        ><UButton
          variant="outline"
          aria-label="Cancel session"
          class="min-h-11 justify-center"
          @click="emit('cancel', session)"
          >Cancel</UButton
        >
      </div>
    </div>
    <div v-else-if="!active" class="session-footer">
      <div class="min-w-0 flex-1 text-sm leading-5 text-muted">
        <p v-if="session.reason">Cancellation reason: {{ session.reason }}</p>
        <p v-else-if="session.status === 'cancelled'">No reason given</p>
        <p v-if="session.rescheduledToId">Moved to a new time.</p>
      </div>
      <NuxtLink
        v-if="session.rescheduledToId"
        :to="{
          path: route.path,
          query: { ...route.query, session: session.rescheduledToId },
        }"
        class="min-h-11 content-center text-sm font-semibold text-primary underline"
        >See the new time</NuxtLink
      >
      <UButton
        v-else
        :to="'/professionals/' + session.professional.id"
        variant="outline"
        class="min-h-11 justify-center"
        >Book again</UButton
      >
    </div>
  </article>
</template>
<style scoped>
.member-session {
  padding: 16px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--brand-surface);
}
.member-session-inactive {
  background: var(--ui-bg);
}
.member-session-inactive .session-date {
  color: var(--ui-text-muted);
}
.member-session-inactive :deep([data-slot='root']) {
  filter: saturate(0.35);
}
.session-date {
  color: var(--ui-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 22px;
  overflow-wrap: anywhere;
}
.session-status {
  flex-shrink: 0;
  max-width: 100px;
  padding: 3px 7px;
  border-radius: 6px;
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}
.session-footer {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
}
.session-warning {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding: 10px;
  border: 1px solid #ffbe45;
  border-radius: 10px;
  background: color-mix(in srgb, var(--ui-bg) 90%, var(--ui-warning) 10%);
  color: var(--ui-warning);
  font-size: 14px;
  line-height: 20px;
}
@media (min-width: 640px) {
  .member-session {
    padding: 18px 20px;
  }
  .session-footer {
    flex-direction: row;
    align-items: center;
  }
  .session-date {
    font-size: 18px;
    line-height: 26px;
  }
  .session-status {
    max-width: none;
  }
}
</style>
