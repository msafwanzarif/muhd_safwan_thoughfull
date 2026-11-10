<script setup lang="ts">
import type { components } from '~/types/api';
import { formatDate, formatTime } from '~/utils/dates';

const props = defineProps<{
  notification: components['schemas']['NotificationResponseDto'];
}>();
const notifications = useNotifications();
const user = useCurrentUser();
const router = useRouter();
const relative = useTimeAgo(() => props.notification.createdAt);
const timezone = computed(() => user.value?.timezone ?? 'UTC');
const title = computed(() => {
  const name = props.notification.data.participantName;
  switch (props.notification.type) {
    case 'reminder_24h':
      return 'Your session starts in 24 hours';
    case 'reminder_1h':
      return 'Your session starts in 1 hour';
    case 'session_cancelled':
      return name ? name + ' cancelled their session' : 'Session cancelled';
    case 'session_rescheduled':
      return name ? name + ' rescheduled their session' : 'Session rescheduled';
    default:
      return 'Session booked' + (name ? ' with ' + name : '');
  }
});
const icon = computed(
  () =>
    ({
      reminder_24h: 'i-lucide-clock',
      reminder_1h: 'i-lucide-clock',
      session_cancelled: 'i-lucide-circle-x',
      session_rescheduled: 'i-lucide-arrow-right-left',
      session_booked: 'i-lucide-calendar-check',
    })[props.notification.type],
);
function sessionTime(value: string) {
  return (
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone.value,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
      .format(new Date(value))
      .replace(',', '') +
    ', ' +
    formatTime(value, timezone.value)
  );
}

async function openSession() {
  try {
    await notifications.markRead(props.notification);
    await router.push({
      path: user.value?.role === 'professional' ? '/pro/schedule' : '/sessions',
      query: { session: props.notification.sessionId },
    });
  } catch {
    /* The shared list displays the retryable error. */
  }
}
</script>

<template>
  <article
    class="notification-row"
    :class="{ 'notification-unread': !notification.readAt }"
  >
    <span
      class="notification-icon"
      :class="
        notification.type === 'session_cancelled'
          ? 'notification-cancelled'
          : notification.type === 'session_rescheduled'
            ? 'notification-rescheduled'
            : ''
      "
      ><UIcon :name="icon" class="size-4"
    /></span>
    <div class="min-w-0 flex-1">
      <h3 class="notification-title">{{ title }}</h3>
      <p v-if="notification.data.startAt" class="notification-detail">
        <template v-if="notification.data.previousStartAt"
          >{{ sessionTime(notification.data.previousStartAt) }} → </template
        >{{ sessionTime(notification.data.startAt)
        }}<span
          v-if="
            notification.type.startsWith('reminder') &&
            notification.data.participantName
          "
        >
          with {{ notification.data.participantName }}</span
        ><span v-if="notification.type === 'session_cancelled'">
          · {{ notification.data.reason || 'No reason given' }}</span
        >
      </p>
      <p class="mt-0.5 text-xs leading-[18px] text-muted">
        <time
          :datetime="notification.createdAt"
          :title="formatDate(notification.createdAt, timezone)"
          >{{ relative }}</time
        >
      </p>
    </div>
    <span
      v-if="!notification.readAt"
      class="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary"
      aria-label="Unread"
    />
    <button
      type="button"
      aria-label="View session"
      class="absolute inset-0 cursor-pointer rounded-none disabled:cursor-wait"
      :disabled="notifications.saving.value"
      @click="openSession"
    >
      <span class="sr-only">{{ title }}</span>
    </button>
  </article>
</template>
<style scoped>
.notification-row {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--ui-border);
  background: var(--brand-surface);
}
.notification-row:last-child {
  border-bottom: 0;
}
.notification-unread {
  background: #f1f6fc;
}
:global(.dark) .notification-unread {
  background: var(--ui-bg-muted);
}
.notification-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-teal-brand-50);
  color: var(--color-teal-brand-600);
}
.notification-cancelled {
  background: #fff2f2;
  color: #cf1515;
}
.notification-rescheduled {
  background: var(--ui-bg-muted);
  color: var(--ui-primary);
}
.notification-title {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
}
.notification-detail {
  margin-top: 2px;
  font-size: 13px;
  line-height: 19px;
  color: var(--ui-text-muted);
  overflow-wrap: anywhere;
}
@media (min-width: 1024px) {
  .notification-row {
    gap: 14px;
    padding: 16px 20px;
    min-height: 95px;
  }
  .notification-icon {
    width: 36px;
    height: 36px;
  }
  .notification-title {
    font-size: 16px;
    line-height: 24px;
  }
  .notification-detail {
    font-size: 14px;
    line-height: 20px;
  }
}
</style>
