<script setup lang="ts">
import type { components } from '~/types/api';
import { formatSession, within24Hours } from '~/utils/dates';
import { problemMessage } from '~/utils/problem';

const props = defineProps<{
  session?: components['schemas']['SessionResponseDto'];
  professional?: boolean;
}>();
const open = defineModel<boolean>({ default: false });
const emit = defineEmits<{ changed: [] }>();
const api = useApi();
const user = useCurrentUser();
const reason = ref('');
const error = ref('');
const action =
  useIdempotentAction<components['schemas']['CancelSessionResponseDto']>();
watch(open, (value) => {
  if (value) {
    reason.value = '';
    error.value = '';
  }
});

async function submit() {
  if (!props.session) return;
  if (!props.professional && within24Hours(props.session.startAt)) {
    error.value =
      'This session is now less than 24 hours away and cannot be cancelled.';
    return;
  }
  const payload = { id: props.session.id, reason: reason.value.trim() };
  try {
    await action.run(payload, (key) =>
      api('/api/v1/sessions/{id}/cancel', {
        method: 'post',
        params: { id: payload.id },
        body: { reason: payload.reason || undefined },
        idempotencyKey: key,
      }),
    );
    open.value = false;
    emit('changed');
  } catch (cause) {
    error.value = problemMessage(cause);
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Cancel this session?"
    :dismissible="!action.busy.value"
    :close="action.busy.value ? false : { class: 'size-11' }"
  >
    <template #body
      ><div class="space-y-5">
        <p v-if="session" class="rounded-xl bg-muted p-4">
          {{
            formatSession(
              session.startAt,
              session.endAt,
              user?.timezone ?? 'UTC',
            )
          }}
        </p>
        <p>
          {{
            professional
              ? 'You can cancel at any time. The member will be notified and can see your reason.'
              : 'The professional will be notified. This action cannot be undone.'
          }}
        </p>
        <UAlert v-if="error" role="alert" color="error" :title="error" />
        <UFormField label="Reason (optional)"
          ><UTextarea
            v-model="reason"
            :disabled="action.busy.value"
            maxlength="1000"
            class="w-full"
            :rows="3"
        /></UFormField></div
    ></template>
    <template #footer
      ><UButton
        variant="outline"
        class="min-h-11"
        :disabled="action.busy.value"
        @click="open = false"
        >Keep session</UButton
      ><UButton
        color="error"
        class="min-h-11"
        :loading="action.busy.value"
        :disabled="action.busy.value"
        @click="submit"
        >Yes, cancel session</UButton
      ></template
    >
  </UModal>
</template>
