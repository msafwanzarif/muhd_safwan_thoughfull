<script setup lang="ts">
import type { components } from '~/types/api';
import { formatDate, formatSession, within24Hours } from '~/utils/dates';

type Session = components['schemas']['SessionResponseDto'];
const props = defineProps<{ session: Session; professional?: boolean }>();
const emit = defineEmits<{
  cancel: [session: Session];
  reschedule: [session: Session];
}>();
const user = useCurrentUser();
const route = useRoute();
const now = useNow({ interval: 30000 });
const timezone = computed(() => user.value?.timezone ?? 'UTC');
const participant = computed(() =>
  props.professional ? props.session.member : props.session.professional,
);
const future = computed(
  () => Date.parse(props.session.endAt) > now.value.getTime(),
);
const locked = computed(() =>
  within24Hours(props.session.startAt, now.value.getTime()),
);
const label = computed(() =>
  props.session.status !== 'active'
    ? props.session.status
    : future.value
      ? 'Upcoming'
      : 'Completed',
);
</script>

<template>
  <article
    :id="`session-${session.id}`"
    class="space-y-4 rounded-2xl border p-5"
    :class="
      session.status === 'active'
        ? 'border-default bg-(--brand-surface)'
        : 'border-dashed border-muted bg-muted'
    "
  >
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <UAvatar :alt="participant.name" size="lg" />
        <div>
          <h2 class="font-bold">{{ participant.name }}</h2>
          <p class="mt-1 text-sm">
            {{ formatSession(session.startAt, session.endAt, timezone) }}
          </p>
        </div>
      </div>
      <UBadge color="neutral" variant="soft" class="capitalize">{{
        label
      }}</UBadge>
    </div>
    <p v-if="session.reason" class="text-sm">
      Cancellation reason: {{ session.reason }}
    </p>
    <p v-if="session.cancelledAt" class="text-sm text-muted">
      Cancelled {{ formatDate(session.cancelledAt, timezone) }} by
      {{
        session.cancelledBy === session.professional.id
          ? 'the professional'
          : 'the member'
      }}.
    </p>
    <div class="flex flex-wrap gap-4 text-sm">
      <NuxtLink
        v-if="session.rescheduledToId"
        :to="{
          path: route.path,
          query: { ...route.query, session: session.rescheduledToId },
        }"
        class="text-primary underline"
        >View replacement session</NuxtLink
      >
      <NuxtLink
        v-if="session.rescheduledFromId"
        :to="{
          path: route.path,
          query: { ...route.query, session: session.rescheduledFromId },
        }"
        class="text-primary underline"
        >View original session</NuxtLink
      >
    </div>
    <UAlert
      v-if="!professional && session.status === 'active' && future && locked"
      color="warning"
      variant="soft"
      title="Less than 24 hours away"
      description="This session can no longer be cancelled or rescheduled."
    />
    <div
      v-if="
        session.status === 'active' && (professional || (future && !locked))
      "
      class="flex flex-wrap gap-3"
    >
      <UButton
        v-if="!professional"
        variant="outline"
        class="min-h-11"
        @click="emit('reschedule', session)"
        >Reschedule</UButton
      >
      <UButton
        color="error"
        variant="outline"
        class="min-h-11"
        @click="emit('cancel', session)"
        >Cancel session</UButton
      >
    </div>
  </article>
</template>
