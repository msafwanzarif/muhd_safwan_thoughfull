<script setup lang="ts">
import type { components } from '~/types/api';
import { scheduleDate } from '~/utils/schedule-display';
import { formatTime } from '~/utils/dates';
const props = defineProps<{
  warnings: components['schemas']['AffectedSessionDto'][];
}>();
const user = useCurrentUser();
const api = useApi();
const names = ref<Record<string, string>>({});
watch(
  () => props.warnings,
  async (warnings) => {
    const entries = await Promise.all(
      warnings.map(async (session) => {
        try {
          const detail = await api('/api/v1/sessions/{id}', {
            method: 'get',
            params: { id: session.id },
          });
          return [session.id, detail.member.name] as const;
        } catch {
          return [session.id, ''] as const;
        }
      }),
    );
    names.value = Object.fromEntries(entries);
  },
  { immediate: true },
);
</script>
<template>
  <aside v-if="warnings.length" role="status" class="hours-warning">
    <UIcon
      name="i-lucide-triangle-alert"
      class="hidden size-5 shrink-0 lg:block"
    />
    <div>
      <h2 class="text-sm leading-[18px] font-bold text-inherit">
        Saved. {{ warnings.length }} booked
        {{ warnings.length === 1 ? 'session is' : 'sessions are' }} now outside
        your hours.
      </h2>
      <ul class="my-1 text-[13px] leading-[19px] lg:flex lg:flex-wrap">
        <li v-for="(session, index) in warnings" :key="session.id">
          <span v-if="index" class="hidden lg:inline"> · </span
          >{{ scheduleDate(session.startAt, user?.timezone ?? 'UTC', true) }},
          {{ formatTime(session.startAt, user?.timezone ?? 'UTC')
          }}<span v-if="names[session.id]"> – {{ names[session.id] }}</span>
        </li>
      </ul>
      <p class="text-[13px] leading-[19px]">
        <span class="lg:hidden">They're kept. Cancel them from your </span
        ><span class="hidden lg:inline"
          >These sessions are kept. If you can't make them, cancel them from
          your </span
        ><NuxtLink to="/pro/schedule" class="font-semibold underline"
          >schedule</NuxtLink
        ><span class="lg:hidden"> if you can't make them.</span
        ><span class="hidden lg:inline"> so the members are notified.</span>
      </p>
    </div>
  </aside>
</template>
<style scoped>
.hours-warning {
  display: flex;
  gap: 12px;
  padding: 14px;
  border: 1px solid #ffbe45;
  border-radius: 15px;
  color: #923209;
  background: #fffaeb;
}
:global(.dark) .hours-warning {
  color: var(--ui-warning);
  background: var(--ui-bg-elevated);
}
@media (min-width: 1024px) {
  .hours-warning {
    padding: 16px 18px;
  }
}
</style>
