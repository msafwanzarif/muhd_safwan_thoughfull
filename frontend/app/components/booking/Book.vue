<script setup lang="ts">
import type { components } from '~/types/api';
import {
  cancellationDeadline,
  formatDate,
  formatSession,
  formatTime,
  meetsNotice,
  within24Hours,
} from '~/utils/dates';
import { problemMessage } from '~/utils/problem';

const props = defineProps<{
  professionalId: string;
  professionalName: string;
}>();
const api = useApi();
const user = useCurrentUser();
const timezone = computed(() => user.value?.timezone ?? 'UTC');
const now = useNow({ interval: 30000 });
const selected = ref<components['schemas']['SlotResponseDto']>();
const picker = useTemplateRef('picker');
const open = ref(false);
const error = ref('');
const conflict = ref(false);
const booked = ref(false);
const action =
  useIdempotentAction<components['schemas']['BookingResponseDto']>();
const withinDay = computed(
  () =>
    !!selected.value &&
    within24Hours(selected.value.startAt, now.value.getTime()),
);

function continueBooking() {
  error.value = '';
  conflict.value = false;
  open.value = true;
}

async function submit() {
  if (
    !selected.value ||
    !meetsNotice(selected.value.startAt, now.value.getTime())
  ) {
    error.value =
      'This time is now less than two hours away. Please choose another time.';
    conflict.value = true;
    return;
  }
  const body = {
    professionalId: props.professionalId,
    startAt: selected.value.startAt,
  };
  error.value = '';
  try {
    await action.run(body, (key) =>
      api('/api/v1/sessions', { method: 'post', body, idempotencyKey: key }),
    );
    booked.value = true;
    open.value = false;
    selected.value = undefined;
    await picker.value?.refresh();
  } catch (cause) {
    error.value = problemMessage(cause);
    conflict.value = ['SLOT_TAKEN', 'MEMBER_OVERLAP', 'INVALID_SLOT'].includes(
      (cause as { code: string }).code,
    );
  }
}

async function chooseAnother() {
  open.value = false;
  selected.value = undefined;
  await picker.value?.refresh();
}
</script>

<template>
  <section
    class="min-w-0 space-y-5 rounded-2xl border border-default bg-(--brand-surface) p-4 sm:p-6"
  >
    <h2 class="text-xl font-bold">Book a 50-minute session</h2>
    <UAlert
      v-if="booked"
      role="status"
      color="success"
      variant="soft"
      title="Your session is booked."
    />
    <BookingPicker
      ref="picker"
      v-model="selected"
      :professional-id="professionalId"
    />
    <UButton
      block
      class="min-h-11"
      :disabled="!selected"
      @click="continueBooking"
      >Continue</UButton
    >
    <UModal
      v-model:open="open"
      :title="conflict ? 'That time is no longer free' : 'Confirm your booking'"
      :dismissible="!action.busy.value"
      :close="action.busy.value ? false : { class: 'size-11' }"
    >
      <template #body>
        <div class="space-y-5">
          <p v-if="selected" class="rounded-xl bg-muted p-4 font-semibold">
            {{ formatSession(selected.startAt, selected.endAt, timezone)
            }}<span class="mt-2 block text-sm font-normal"
              >50 minutes with {{ professionalName }}</span
            >
          </p>
          <UAlert
            v-if="error"
            role="alert"
            color="error"
            variant="soft"
            :title="error"
          />
          <template v-if="!conflict && selected">
            <UAlert
              v-if="withinDay"
              color="warning"
              variant="soft"
              title="This session starts in less than 24 hours."
              description="Once booked, you cannot cancel or reschedule it."
            />
            <UAlert
              v-else
              color="info"
              variant="soft"
              :title="`You can cancel or reschedule until ${formatDate(cancellationDeadline(selected.startAt), timezone)}, ${formatTime(cancellationDeadline(selected.startAt), timezone)}.`"
            />
            <p class="text-sm text-muted">
              Reminders appear in your notifications 24 hours and 1 hour before
              the session, when those times are still ahead.
            </p>
          </template>
        </div>
      </template>
      <template #footer>
        <UButton v-if="conflict" block class="min-h-11" @click="chooseAnother"
          >Choose another time</UButton
        >
        <template v-else
          ><UButton
            variant="outline"
            class="min-h-11"
            :disabled="action.busy.value"
            @click="open = false"
            >Back</UButton
          ><UButton
            class="min-h-11"
            :loading="action.busy.value"
            :disabled="action.busy.value"
            @click="submit"
            >{{ withinDay ? 'Book anyway' : 'Confirm booking' }}</UButton
          ></template
        >
      </template>
    </UModal>
  </section>
</template>
