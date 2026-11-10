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
const title = computed(
  () =>
    ({
      reminder_24h: 'Your session is in 24 hours',
      reminder_1h: 'Your session is in 1 hour',
      session_cancelled: 'Session cancelled',
      session_rescheduled: 'Session rescheduled',
      session_booked: 'Session booked',
    })[props.notification.type],
);

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
    class="rounded-xl border border-default p-4"
    :class="notification.readAt ? 'bg-(--brand-surface)' : 'bg-muted'"
  >
    <div class="flex items-start gap-3">
      <UIcon
        :name="
          notification.type === 'session_booked'
            ? 'i-lucide-calendar-check'
            : notification.type.startsWith('reminder')
              ? 'i-lucide-bell'
              : 'i-lucide-calendar-clock'
        "
        class="mt-1 size-5 shrink-0 text-primary"
      />
      <div class="min-w-0 flex-1 space-y-2">
        <h3 class="font-semibold">
          {{ title
          }}<span
            v-if="!notification.readAt"
            class="ml-2 inline-block size-2 rounded-full bg-primary"
            aria-label="Unread"
          />
        </h3>
        <p v-if="notification.data.participantName" class="text-sm">
          With {{ notification.data.participantName }}
        </p>
        <p v-if="notification.data.startAt" class="text-sm">
          {{ formatDate(notification.data.startAt, timezone) }},
          {{ formatTime(notification.data.startAt, timezone) }}
        </p>
        <p v-if="notification.data.reason" class="text-sm">
          Reason: {{ notification.data.reason }}
        </p>
        <p class="text-xs text-muted">
          <time
            :datetime="notification.createdAt"
            :title="formatDate(notification.createdAt, timezone)"
            >{{ relative }}</time
          >
        </p>
        <UButton
          variant="link"
          class="min-h-11 p-0"
          :disabled="notifications.saving.value"
          @click="openSession"
          >View session</UButton
        >
      </div>
    </div>
  </article>
</template>
