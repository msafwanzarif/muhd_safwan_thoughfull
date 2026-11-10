<script setup lang="ts">
import type { FormError } from '@nuxt/ui';
import type { components } from '~/types/api';
import { specialisations, languages } from '~/utils/auth';
import { timezoneCity } from '~/utils/professionals';
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
  <section class="profile-page">
    <header>
      <h1 class="text-2xl leading-8 font-bold lg:text-3xl lg:leading-10">
        My profile
      </h1>
      <p
        class="mt-1 text-[13px] leading-[19px] text-muted lg:text-sm lg:leading-5"
      >
        Members see this when they choose who to book with.
      </p>
    </header>
    <UAlert
      v-if="success"
      role="status"
      color="success"
      title="Profile updated."
    />
    <UAlert v-if="error" role="alert" color="error" :title="error" />
    <div class="profile-layout">
      <UForm
        :state="state"
        :validate="validate"
        class="profile-form space-y-5"
        @submit="save"
      >
        <fieldset :disabled="busy" class="profile-fields">
          <UFormField name="name" label="Full name" required
            ><UInput
              v-model="state.name"
              maxlength="100"
              autocomplete="name"
              class="w-full"
              :ui="{
                base: 'min-h-11 rounded-[10px] bg-(--brand-surface) ring-default',
              }"
          /></UFormField>
          <UFormField name="title" label="Title" required
            ><UInput
              v-model="state.title"
              maxlength="100"
              class="w-full"
              :ui="{
                base: 'min-h-11 rounded-[10px] bg-(--brand-surface) ring-default',
              }"
          /></UFormField>
          <div class="profile-wide">
            <UFormField label="Based in"
              ><UInput
                :model-value="timezoneCity(user?.timezone ?? 'UTC')"
                readonly
                class="w-full"
                :ui="{
                  base: 'min-h-11 rounded-[10px] bg-(--brand-surface) ring-default',
                }"
            /></UFormField>
            <p class="mt-1.5 text-xs text-muted">
              Your city follows your time zone, set on
              <NuxtLink to="/pro/hours" class="text-primary underline"
                >Working hours</NuxtLink
              >.
            </p>
          </div>
          <UFormField name="bio" label="Short bio" class="profile-wide" required
            ><UTextarea
              v-model="state.bio"
              maxlength="2000"
              :rows="4"
              :ui="{ base: 'rounded-[10px] bg-(--brand-surface) ring-default' }"
              class="w-full"
          /></UFormField>
          <fieldset class="profile-wide">
            <legend class="mb-2 text-sm">Specialisations</legend>
            <AppChipToggleGroup
              v-model="state.specialisations"
              :items="specialisations"
            />
          </fieldset>
          <fieldset>
            <legend class="mb-3 font-semibold">
              Languages you offer sessions in
            </legend>
            <AppChipToggleGroup v-model="state.languages" :items="languages" />
          </fieldset>
        </fieldset>
        <div class="profile-actions">
          <UButton
            type="submit"
            class="profile-save min-h-11 justify-center font-bold"
            :loading="busy"
            :disabled="busy || !dirty"
            >Save profile</UButton
          ><UButton
            variant="outline"
            class="profile-discard min-h-11 justify-center"
            :disabled="busy || !dirty"
            @click="user && apply(user)"
            >Discard changes</UButton
          >
        </div>
      </UForm>
      <aside class="profile-preview space-y-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">
          How members see you
        </h2>
        <ProfessionalsCard :professional="preview" preview />

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

<style scoped>
.profile-page {
  display: grid;
  gap: 16px;
}
.profile-layout {
  display: grid;
  gap: 16px;
  align-items: start;
}
.profile-form {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--brand-surface);
}
.profile-fields {
  display: grid;
  gap: 16px;
}
.profile-preview {
  min-width: 0;
  grid-row: 1;
}
.profile-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.profile-discard {
  order: 2;
}
.profile-form :deep([aria-pressed]) {
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid #c9d6dc;
  box-shadow: none;
  background: var(--brand-surface);
  color: var(--ui-text);
}
.profile-form :deep([aria-pressed='true']) {
  border-color: var(--ui-primary);
  background: var(--ui-bg-muted);
  color: var(--ui-primary);
}
@media (min-width: 1024px) {
  .profile-page {
    gap: 20px;
    margin-right: -16px;
  }
  .profile-layout {
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 20px;
  }
  .profile-form {
    padding: 24px;
  }
  .profile-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px 16px;
  }
  .profile-wide {
    grid-column: 1 / -1;
  }
  .profile-preview {
    grid-row: auto;
  }
  .profile-actions {
    flex-direction: row;
    justify-content: flex-end;
    border-top: 1px solid var(--ui-border);
    padding-top: 18px;
  }
  .profile-discard {
    order: 0;
  }
  .profile-save {
    order: 1;
  }
}
</style>
