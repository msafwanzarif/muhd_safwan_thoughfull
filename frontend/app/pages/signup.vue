<script setup lang="ts">
import type { FormError } from '@nuxt/ui';
import {
  authMessage,
  languages,
  specialisations,
  type Signup,
} from '~/utils/auth';

definePageMeta({ layout: 'auth' });
useHead({ title: 'Create an account · ThoughtFull' });
const api = useApi();
const router = useRouter();
const state = reactive({
  name: '',
  email: '',
  password: '',
  role: 'member' as Signup['role'],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  title: '',
  bio: '',
  specialisations: [] as NonNullable<Signup['specialisations']>,
  languages: [] as NonNullable<Signup['languages']>,
});
const busy = ref(false);
const error = ref('');
let previousBody = '';
let key = '';

function validate(): FormError[] {
  const errors: FormError[] = [];
  if (!state.name.trim())
    errors.push({ name: 'name', message: 'Enter your full name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim()))
    errors.push({ name: 'email', message: 'Enter a valid email address.' });
  if (state.password.length < 15 || state.password.length > 128)
    errors.push({
      name: 'password',
      message: 'Use between 15 and 128 characters.',
    });
  if (!state.timezone)
    errors.push({ name: 'timezone', message: 'Choose a time zone.' });
  if (state.role === 'professional') {
    if (!state.title.trim())
      errors.push({ name: 'title', message: 'Enter your professional title.' });
    if (!state.bio.trim())
      errors.push({ name: 'bio', message: 'Tell members about yourself.' });
  }
  return errors;
}

async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  const body: Signup = {
    name: state.name.trim(),
    email: state.email.trim(),
    password: state.password,
    role: state.role,
    timezone: state.timezone,
    ...(state.role === 'professional'
      ? {
          title: state.title.trim(),
          bio: state.bio.trim(),
          specialisations: [...state.specialisations],
          languages: [...state.languages],
        }
      : {}),
  };
  const serialized = JSON.stringify(body);
  if (serialized !== previousBody) {
    previousBody = serialized;
    key = crypto.randomUUID();
  }

  const send = () =>
    api('/api/v1/auth/sign-up', {
      method: 'post',
      body,
      idempotencyKey: key,
      redirectOnUnauthorized: false,
    });
  try {
    try {
      await send();
    } catch (cause) {
      if ((cause as { code?: string }).code !== 'REQUEST_IN_PROGRESS')
        throw cause;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await send();
    }
    state.password = '';
    previousBody = '';
    key = '';
    await router.replace('/login?registered=1');
  } catch (cause) {
    error.value = authMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <h2 class="text-3xl font-bold">Create your account</h2>
    <p class="mt-3 text-muted">A little space for a better you.</p>
    <UForm
      :state="state"
      :validate="validate"
      class="mt-8 space-y-5"
      @submit="submit"
    >
      <UAlert
        v-if="error"
        role="alert"
        color="error"
        variant="soft"
        :title="error"
      />
      <fieldset :disabled="busy" class="space-y-5">
        <legend class="mb-2 text-sm font-semibold">I am joining as a</legend>
        <div class="flex gap-3">
          <UButton
            v-for="role in ['member', 'professional'] as const"
            :key="role"
            type="button"
            :aria-pressed="state.role === role"
            :variant="state.role === role ? 'solid' : 'outline'"
            @click="state.role = role"
            >{{ role === 'member' ? 'Member' : 'Professional' }}</UButton
          >
        </div>
        <UFormField label="Full name" name="name" required
          ><UInput
            v-model="state.name"
            autocomplete="name"
            maxlength="100"
            class="w-full"
            size="lg"
        /></UFormField>
        <UFormField label="Email" name="email" required
          ><UInput
            v-model="state.email"
            type="email"
            autocomplete="username"
            maxlength="254"
            class="w-full"
            size="lg"
        /></UFormField>
        <UFormField
          label="Password"
          name="password"
          hint="15–128 characters"
          required
          ><UInput
            v-model="state.password"
            type="password"
            autocomplete="new-password"
            maxlength="128"
            class="w-full"
            size="lg"
        /></UFormField>
        <UFormField
          label="City or time zone"
          name="timezone"
          description="Session times will use this time zone."
          required
          ><AppTimezonePicker v-model="state.timezone"
        /></UFormField>
        <template v-if="state.role === 'professional'">
          <UFormField label="Professional title" name="title" required
            ><UInput
              v-model="state.title"
              maxlength="100"
              placeholder="e.g. Counsellor"
              class="w-full"
              size="lg"
          /></UFormField>
          <UFormField label="About you" name="bio" required
            ><UTextarea
              v-model="state.bio"
              maxlength="2000"
              :rows="4"
              class="w-full"
          /></UFormField>
          <fieldset>
            <legend class="mb-2 text-sm font-semibold">Specialisations</legend>
            <AppChipToggleGroup
              v-model="state.specialisations"
              :items="specialisations"
            />
          </fieldset>
          <fieldset>
            <legend class="mb-2 text-sm font-semibold">Languages</legend>
            <AppChipToggleGroup v-model="state.languages" :items="languages" />
          </fieldset>
        </template>
      </fieldset>
      <UButton type="submit" block size="lg" :loading="busy" :disabled="busy"
        >Create account</UButton
      >
    </UForm>
    <p class="mt-6 text-center text-sm text-muted">
      Already have an account?
      <NuxtLink to="/login" class="font-semibold text-primary underline"
        >Log in</NuxtLink
      >
    </p>
  </div>
</template>
