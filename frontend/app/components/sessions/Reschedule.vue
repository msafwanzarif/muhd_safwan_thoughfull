<script setup lang="ts">
import type { components } from '~/types/api';
import { formatSession, meetsNotice, within24Hours } from '~/utils/dates';
import { problemMessage } from '~/utils/problem';

const props = defineProps<{
  session?: components['schemas']['SessionResponseDto'];
}>();
const open = defineModel<boolean>({ default: false });
const emit = defineEmits<{ changed: [] }>();
const api = useApi();
const user = useCurrentUser();
const selected = ref<components['schemas']['SlotResponseDto']>();
const confirm = ref(false);
const error = ref('');
const picker = useTemplateRef('picker');
const action =
  useIdempotentAction<components['schemas']['RescheduleSessionResponseDto']>();
watch(open, (value) => {
  if (value) {
    selected.value = undefined;
    confirm.value = false;
    error.value = '';
  }
});

async function submit() {
  if (!props.session || !selected.value) return;
  if (
    within24Hours(props.session.startAt) ||
    !meetsNotice(selected.value.startAt)
  ) {
    error.value =
      'The change deadline has passed, or the selected time is too close. Please refresh your sessions.';
    return;
  }
  const payload = { id: props.session.id, startAt: selected.value.startAt };
  try {
    await action.run(payload, (key) =>
      api('/api/v1/sessions/{id}/reschedule', {
        method: 'post',
        params: { id: payload.id },
        body: { startAt: payload.startAt },
        idempotencyKey: key,
      }),
    );
    open.value = false;
    emit('changed');
  } catch (cause) {
    error.value = problemMessage(cause);
    if (
      ['SLOT_TAKEN', 'MEMBER_OVERLAP'].includes(
        (cause as { code: string }).code,
      )
    ) {
      confirm.value = false;
      selected.value = undefined;
      await picker.value?.refresh();
    }
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Reschedule your session"
    description="Your original session stays booked until you confirm a new time."
    :dismissible="!action.busy.value"
    :close="action.busy.value ? false : { class: 'size-11' }"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body
      ><div v-if="session" class="space-y-6">
        <p class="rounded-xl bg-muted p-4">
          Current:
          {{
            formatSession(
              session.startAt,
              session.endAt,
              user?.timezone ?? 'UTC',
            )
          }}
          with {{ session.professional.name }}
        </p>
        <UAlert v-if="error" role="alert" color="error" :title="error" />
        <BookingPicker
          v-show="!confirm"
          ref="picker"
          v-model="selected"
          :professional-id="session.professional.id"
          :current-start="session.startAt"
        />
        <template v-if="confirm && selected">
          <h2 class="font-bold">Confirm your new time</h2>
          <p>
            {{
              formatSession(
                selected.startAt,
                selected.endAt,
                user?.timezone ?? 'UTC',
              )
            }}
          </p>
          <UAlert
            v-if="within24Hours(selected.startAt)"
            color="warning"
            title="The new session is less than 24 hours away."
            description="After rescheduling, you cannot change or cancel it."
          />
          <p class="text-sm text-muted">
            The original session will be replaced only after this change
            succeeds.
          </p>
        </template>
      </div></template
    >
    <template #footer>
      <UButton
        v-if="confirm"
        variant="outline"
        class="min-h-11"
        :disabled="action.busy.value"
        @click="confirm = false"
        >Back</UButton
      >
      <UButton
        v-if="!confirm"
        class="min-h-11"
        :disabled="!selected"
        @click="confirm = true"
        >Review new time</UButton
      >
      <UButton
        v-else
        class="min-h-11"
        :loading="action.busy.value"
        :disabled="action.busy.value"
        @click="submit"
        >Confirm reschedule</UButton
      >
    </template>
  </USlideover>
</template>
