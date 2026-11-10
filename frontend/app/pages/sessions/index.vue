<script setup lang="ts">
import { useRouteQuery } from '@vueuse/router';
import type { components } from '~/types/api';

definePageMeta({ layout: 'member' });
useHead({ title: 'My sessions · ThoughtFull' });
const api = useApi();
const user = useCurrentUser();
const route = useRoute();
const tabQuery = useRouteQuery<string>('tab', '', { mode: 'push' });
const cancelledQuery = useRouteQuery<string>('cancelled', '', { mode: 'push' });
const pageQuery = useRouteQuery<string>('page', '', { mode: 'push' });
const period = computed<'past' | 'upcoming'>(() =>
  tabQuery.value === 'past' ? 'past' : 'upcoming',
);
const cancelled = computed(() => cancelledQuery.value === '1');
const page = computed(() =>
  /^\d+$/.test(pageQuery.value)
    ? Math.min(1000000, Math.max(1, Number(pageQuery.value)))
    : 1,
);
const query = computed(() => ({
  page: page.value,
  pageSize: 12,
  period: period.value,
  status: cancelled.value ? undefined : ('active' as const),
}));
const { data, status, error, refresh } = useAsyncData(
  'member-sessions',
  () => api('/api/v1/sessions', { method: 'get', query: query.value }),
  { watch: [query] },
);
const selected = ref<components['schemas']['SessionResponseDto']>();
const cancelOpen = ref(false);
const rescheduleOpen = ref(false);
const toast = useToast();

function setPeriod(value: string | number) {
  tabQuery.value = value === 'past' ? 'past' : '';
  pageQuery.value = '';
}

function setCancelled(value: boolean) {
  cancelledQuery.value = value ? '1' : '';
  pageQuery.value = '';
}

function cancel(session: components['schemas']['SessionResponseDto']) {
  selected.value = session;
  cancelOpen.value = true;
}

function reschedule(session: components['schemas']['SessionResponseDto']) {
  selected.value = session;
  rescheduleOpen.value = true;
}

async function changed() {
  toast.add({ title: 'Your session has been updated.', color: 'success' });
  await refresh();
}
</script>

<template>
  <section class="space-y-6">
    <h1 class="text-3xl font-bold">My sessions</h1>
    <p class="text-muted">
      Times in {{ user?.timezone }}. Sessions last 50 minutes.
    </p>
    <SessionsDetail
      v-if="typeof route.query.session === 'string'"
      :id="route.query.session"
      @changed="refresh()"
    />
    <div class="flex flex-wrap items-center justify-between gap-4">
      <UTabs
        :model-value="period"
        :items="[
          { label: 'Upcoming', value: 'upcoming' },
          { label: 'Past', value: 'past' },
        ]"
        :content="false"
        @update:model-value="setPeriod"
      />
      <USwitch
        :model-value="cancelled"
        label="Show cancelled"
        @update:model-value="setCancelled"
      />
    </div>
    <USkeleton
      v-if="status === 'pending'"
      class="h-52 rounded-2xl"
      aria-label="Loading sessions"
    />
    <UAlert
      v-else-if="error"
      role="alert"
      color="error"
      title="We couldn't load sessions."
      ><template #actions
        ><UButton variant="outline" class="min-h-11" @click="refresh()"
          >Try again</UButton
        ></template
      ></UAlert
    >
    <template v-else-if="data">
      <div v-if="data.items.length" class="space-y-5">
        <SessionsCard
          v-for="session in data.items"
          :key="session.id"
          :session="session"
          @cancel="cancel"
          @reschedule="reschedule"
        />
      </div>
      <UEmpty
        v-else
        icon="i-lucide-calendar"
        title="No sessions to show"
        :description="
          period === 'upcoming'
            ? 'Find a professional and choose a time that works for you.'
            : 'Your session history will appear here.'
        "
        ><template #actions
          ><UButton
            v-if="period === 'upcoming'"
            to="/professionals"
            class="min-h-11"
            >Find a professional</UButton
          ><UButton
            v-if="page > 1"
            variant="outline"
            class="min-h-11"
            @click="pageQuery = ''"
            >Go to first page</UButton
          ></template
        ></UEmpty
      >
      <AppPagination
        :page="page"
        :total="data.total"
        :page-size="12"
        @change="pageQuery = $event === 1 ? '' : String($event)"
      />
    </template>
    <SessionsCancelModal
      v-model="cancelOpen"
      :session="selected"
      @changed="changed"
    />
    <SessionsReschedule
      v-model="rescheduleOpen"
      :session="selected"
      @changed="changed"
    />
  </section>
</template>
