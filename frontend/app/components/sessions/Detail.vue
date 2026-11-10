<script setup lang="ts">
const props = defineProps<{ id: string; professional?: boolean }>();
const emit = defineEmits<{ changed: [] }>();
const api = useApi();
const { data, error, status, refresh } = useAsyncData(
  () => `session-${props.id}`,
  () =>
    api('/api/v1/sessions/{id}', { method: 'get', params: { id: props.id } }),
);
const cancel = ref(false);
const reschedule = ref(false);

async function changed() {
  await refresh();
  emit('changed');
}
</script>

<template>
  <section class="mb-8 space-y-4" aria-label="Selected session">
    <h2 class="text-xl font-bold">Session details</h2>
    <USkeleton v-if="status === 'pending'" class="h-40" />
    <UAlert
      v-else-if="error"
      role="alert"
      color="error"
      title="Session unavailable"
      description="It may no longer exist, or you may not have access."
      ><template #actions
        ><UButton variant="outline" @click="refresh()"
          >Try again</UButton
        ></template
      ></UAlert
    >
    <SessionsCard
      v-else-if="data"
      :session="data"
      :professional="professional"
      @cancel="cancel = true"
      @reschedule="reschedule = true"
    />
    <SessionsCancelModal
      v-model="cancel"
      :session="data ?? undefined"
      :professional="professional"
      @changed="changed"
    />
    <SessionsReschedule
      v-if="!professional"
      v-model="reschedule"
      :session="data ?? undefined"
      @changed="changed"
    />
  </section>
</template>
