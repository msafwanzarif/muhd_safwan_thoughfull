<script setup lang="ts">
import type { FormError } from '@nuxt/ui';
import { authMessage } from '~/utils/auth';

definePageMeta({ layout: 'auth' });
useHead({ title: 'Log in · ThoughtFull' });
const auth = useAuth();
const sessionNotice = useState<'' | 'idle' | 'expired'>(
  'session-notice',
  () => '',
);
const route = useRoute();
const state = reactive({ email: '', password: '' });
const busy = ref(false);
const error = ref('');
const showPassword = ref(false);

function validate(): FormError[] {
  const errors: FormError[] = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim()))
    errors.push({ name: 'email', message: 'Enter a valid email address.' });
  if (!state.password)
    errors.push({ name: 'password', message: 'Enter your password.' });
  return errors;
}

async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await auth.login(
      { email: state.email.trim(), password: state.password },
      route.query.redirect,
    );
    state.password = '';
  } catch (cause) {
    error.value = authMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <h2 class="text-3xl font-bold">Welcome back</h2>
    <p class="mt-3 text-muted">Log in to see your sessions.</p>
    <UAlert
      v-if="sessionNotice"
      color="info"
      variant="soft"
      class="mt-6"
      :title="
        sessionNotice === 'idle'
          ? 'Signed out after 30 minutes without activity. Please log in again.'
          : 'Your session has ended. Please log in again.'
      "
    />
    <UAlert
      v-if="route.query.registered === '1'"
      class="mt-6"
      color="success"
      variant="soft"
      title="Your account is ready. Please log in."
    />
    <UForm
      :state="state"
      :validate="validate"
      class="mt-8 space-y-6"
      @submit="submit"
    >
      <UAlert
        v-if="error"
        role="alert"
        color="error"
        variant="soft"
        :title="error"
      />
      <UFormField label="Email" name="email" required>
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="username"
          maxlength="254"
          class="w-full"
          size="lg"
        />
      </UFormField>
      <UFormField label="Password" name="password" required>
        <UInput
          v-model="state.password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          maxlength="128"
          class="w-full"
          size="lg"
        >
          <template #trailing>
            <UButton
              :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              variant="ghost"
              size="xs"
              type="button"
              @click="showPassword = !showPassword"
            />
          </template>
        </UInput>
      </UFormField>
      <UButton type="submit" block size="lg" :loading="busy" :disabled="busy"
        >Log in</UButton
      >
    </UForm>
    <p class="mt-6 text-center text-sm text-muted">
      New to ThoughtFull?
      <NuxtLink to="/signup" class="font-semibold text-primary underline"
        >Create an account</NuxtLink
      >
    </p>
  </div>
</template>
