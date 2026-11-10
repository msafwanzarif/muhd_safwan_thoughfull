<script setup lang="ts">
import type { components } from '~/types/api';
import { formatSession } from '~/utils/dates';
defineProps<{ warnings: components['schemas']['AffectedSessionDto'][] }>();
const user = useCurrentUser();
</script>

<template>
  <UAlert
    v-if="warnings.length"
    color="warning"
    variant="soft"
    title="Existing sessions have been kept."
    description="These bookings fall outside your new availability. Review your schedule if you need to cancel them."
  >
    <template #description
      ><ul class="mt-3 space-y-2">
        <li v-for="session in warnings" :key="session.id">
          <NuxtLink
            :to="{ path: '/pro/schedule', query: { session: session.id } }"
            class="underline"
            >{{
              formatSession(
                session.startAt,
                session.endAt,
                user?.timezone ?? 'UTC',
              )
            }}</NuxtLink
          >
        </li>
      </ul></template
    >
  </UAlert>
</template>
