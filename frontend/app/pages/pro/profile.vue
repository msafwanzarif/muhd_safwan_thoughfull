<script setup lang="ts">
import type { FormError } from '@nuxt/ui';
import type { components } from '~/types/api';
import { specialisations, languages } from '~/utils/auth';
import { timezoneLabel } from '~/utils/professionals';
import { problemMessage } from '~/utils/problem';

definePageMeta({ layout: 'professional' });
useHead({ title: 'My profile · ThoughtFull' });
const api = useApi();
const user = useCurrentUser();
const state = reactive({
  name: user.value?.name ?? '',
  title: user.value?.title ?? '',
  bio: user.value?.bio ?? '',
  specialisations: [...(user.value?.specialisations ?? [])],
  languages: [...(user.value?.languages ?? [])],
});
const baseline = ref(JSON.stringify(state));
const dirty = computed(() => JSON.stringify(state) !== baseline.value);
const busy = ref(false);
const error = ref('');
const success = ref(false);
const hours = await useAsyncData('profile-working-hours', () =>
  api('/api/v1/working-hours', { method: 'get' }),
);
const preview = computed(() => ({
  id: user.value?.id ?? '',
  name: state.name || 'Your name',
  timezone: user.value?.timezone ?? 'UTC',
  title: state.title,
  bio: state.bio,
  specialisations: state.specialisations,
  languages: state.languages,
  hasWorkingHours: hours.error.value ? true : !!hours.data.value?.ranges.length,
}));
useUnsavedChanges(dirty);

function validate(): FormError[] {
  return (['name', 'title', 'bio'] as const)
    .filter((key) => !state[key].trim())
    .map((key) => ({
      name: key,
      message: `Enter your ${key === 'bio' ? 'bio' : key}.`,
    }));
}

function apply(account: components['schemas']['AccountResponseDto']) {
  Object.assign(state, {
    name: account.name,
    title: account.title ?? '',
    bio: account.bio ?? '',
    specialisations: [...account.specialisations],
    languages: [...account.languages],
  });
  baseline.value = JSON.stringify(state);
}

async function save() {
  if (busy.value || validate().length) return;
  busy.value = true;
  error.value = '';
  success.value = false;
  try {
    const result = await api('/api/v1/users/me', {
      method: 'patch',
      body: {
        ...state,
        name: state.name.trim(),
        title: state.title.trim(),
        bio: state.bio.trim(),
      },
    });
    user.value = result;
    apply(result);
    success.value = true;
  } catch (cause) {
    error.value = problemMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <h1 class="text-3xl font-bold">My profile</h1>
    <p class="text-muted">
      Based in {{ timezoneLabel(user?.timezone ?? 'UTC') }}. Your city comes
      from your saved time zone.
    </p>
    <UButton to="/pro/hours" variant="outline" class="min-h-11"
      >Change time zone and hours</UButton
    >
    <UAlert
      v-if="success"
      role="status"
      color="success"
      title="Profile updated."
    />
    <UAlert v-if="error" role="alert" color="error" :title="error" />
    <div class="grid items-start gap-6 xl:grid-cols-2">
      <UForm
        :state="state"
        :validate="validate"
        class="space-y-6 rounded-2xl border border-default bg-(--brand-surface) p-6"
        @submit="save"
      >
        <fieldset :disabled="busy" class="space-y-6">
          <UFormField name="name" label="Full name" required
            ><UInput
              v-model="state.name"
              maxlength="100"
              autocomplete="name"
              class="w-full"
              :ui="{ base: 'min-h-11' }"
          /></UFormField>
          <UFormField name="title" label="Professional title" required
            ><UInput
              v-model="state.title"
              maxlength="100"
              class="w-full"
              :ui="{ base: 'min-h-11' }"
          /></UFormField>
          <UFormField name="bio" label="About you" required
            ><UTextarea
              v-model="state.bio"
              maxlength="2000"
              :rows="6"
              class="w-full"
          /></UFormField>
          <fieldset>
            <legend class="mb-3 font-semibold">Specialisations</legend>
            <AppChipToggleGroup
              v-model="state.specialisations"
              :items="specialisations"
            />
          </fieldset>
          <fieldset>
            <legend class="mb-3 font-semibold">Languages</legend>
            <AppChipToggleGroup v-model="state.languages" :items="languages" />
          </fieldset>
        </fieldset>
        <div class="flex flex-wrap gap-3">
          <UButton
            type="submit"
            class="min-h-11"
            :loading="busy"
            :disabled="busy || !dirty"
            >Save profile</UButton
          ><UButton
            variant="outline"
            class="min-h-11"
            :disabled="busy || !dirty"
            @click="user && apply(user)"
            >Discard changes</UButton
          >
        </div>
      </UForm>
      <aside class="space-y-4">
        <h2 class="text-lg font-bold">How members see you</h2>
        <ProfessionalsCard :professional="preview" preview />
        <p class="whitespace-pre-line text-muted">{{ state.bio }}</p>
        <UAlert
          v-if="hours.error.value"
          color="warning"
          title="Availability status couldn't be loaded."
          ><template #actions
            ><UButton variant="outline" @click="hours.refresh()"
              >Try again</UButton
            ></template
          ></UAlert
        >
      </aside>
    </div>
  </section>
</template>
