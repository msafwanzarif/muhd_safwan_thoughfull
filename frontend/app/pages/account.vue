<script setup lang="ts">
import type { FormError } from '@nuxt/ui';
import { problemMessage } from '~/utils/problem';

definePageMeta({ layout: 'member' });
useHead({ title: 'My account · ThoughtFull' });
const api = useApi();
const user = useCurrentUser();
const state = reactive({
  name: user.value?.name ?? '',
  timezone: user.value?.timezone ?? 'UTC',
});
const savedName = ref(state.name);
const savedTimezone = ref(state.timezone);
const dirty = computed(
  () =>
    state.name !== savedName.value || state.timezone !== savedTimezone.value,
);
const busy = ref(false);
const error = ref('');
const success = ref(false);
useUnsavedChanges(dirty);

function validate(): FormError[] {
  return state.name.trim()
    ? []
    : [{ name: 'name', message: 'Enter your name.' }];
}

function discard() {
  state.name = savedName.value;
  state.timezone = savedTimezone.value;
  error.value = '';
}

async function save() {
  if (busy.value || validate().length) return;
  busy.value = true;
  error.value = '';
  success.value = false;
  let nameSaved = false;
  try {
    if (state.name.trim() !== savedName.value) {
      const result = await api('/api/v1/users/me', {
        method: 'patch',
        body: { name: state.name.trim() },
      });
      user.value = result;
      state.name = result.name;
      savedName.value = result.name;
      nameSaved = true;
    }
    if (state.timezone !== savedTimezone.value) {
      const result = await api('/api/v1/users/me/timezone', {
        method: 'patch',
        body: { timezone: state.timezone },
      });
      if (user.value) user.value = { ...user.value, timezone: result.timezone };
      state.timezone = result.timezone;
      savedTimezone.value = result.timezone;
      await refreshNuxtData(['member-sessions', 'professionals-directory']);
    }
    state.name = savedName.value;
    success.value = true;
  } catch (cause) {
    error.value = `${nameSaved ? 'Your name was saved. ' : ''}${problemMessage(cause)}`;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="mx-auto max-w-2xl space-y-5">
    <header>
      <h1 class="text-3xl font-bold">My account</h1>
      <p class="mt-1 text-[13px] leading-5 text-muted lg:text-sm">
        Your saved time zone is used for session times. Changing it keeps every
        booking at the same instant.
      </p>
    </header>
    <UAlert
      v-if="success"
      role="status"
      color="success"
      title="Account updated."
    />
    <UAlert v-if="error" role="alert" color="error" :title="error" />
    <UForm
      :state="state"
      :validate="validate"
      class="space-y-6 rounded-2xl border border-default bg-(--brand-surface) p-4 sm:p-6"
      @submit="save"
    >
      <UFormField name="name" label="Name" required
        ><UInput
          v-model="state.name"
          autocomplete="name"
          maxlength="100"
          :disabled="busy"
          class="w-full"
          :ui="{ base: 'min-h-11' }"
      /></UFormField>
      <UFormField name="timezone" label="City or time zone" required
        ><AppTimezonePicker v-model="state.timezone" :disabled="busy"
      /></UFormField>
      <div
        class="flex flex-col gap-2 border-t border-default pt-5 sm:flex-row sm:justify-end"
      >
        <UButton
          type="submit"
          class="min-h-11 justify-center"
          :disabled="busy || !dirty"
          :loading="busy"
          >Save account</UButton
        ><UButton
          variant="outline"
          class="min-h-11 justify-center"
          :disabled="busy || !dirty"
          @click="discard"
          >Discard changes</UButton
        >
      </div>
    </UForm>
  </section>
</template>
