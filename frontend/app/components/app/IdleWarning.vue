<script setup lang="ts">
import { idleStage } from '~/utils/activity';
import { problemMessage } from '~/utils/problem';

const auth = useAuth();
const activity = useHumanActivity();
const user = useCurrentUser();
const router = useRouter();
const busy = ref(false);
const error = ref('');
watch(activity.warning, () => {
  error.value = '';
});

async function stay() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await activity.check();
    if (!user.value) return;
    await auth.load(true);
    if (!user.value) {
      await router.replace('/login');
      return;
    }
    if (
      user.value &&
      idleStage(activity.lastActive.value, Date.now()) !== 'expired'
    )
      activity.reset();
    else await activity.check();
  } catch (cause) {
    error.value = problemMessage(cause);
  } finally {
    busy.value = false;
  }
}

async function logout() {
  busy.value = true;
  try {
    await auth.logout();
  } catch (cause) {
    error.value = problemMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UModal
    :open="activity.warning.value"
    title="Still there?"
    description="You have been inactive for 28 minutes. For your privacy, you will be signed out after 30 minutes."
    :dismissible="false"
    :close="false"
  >
    <template #body
      ><p role="timer">
        Signing out in {{ activity.remaining.value }} seconds.
      </p>
      <UAlert
        v-if="error"
        role="alert"
        color="error"
        class="mt-4"
        :title="error"
    /></template>
    <template #footer
      ><UButton
        variant="outline"
        class="min-h-11"
        :disabled="busy"
        @click="logout"
        >Log out</UButton
      ><UButton class="min-h-11" :loading="busy" :disabled="busy" @click="stay"
        >Stay signed in</UButton
      ></template
    >
  </UModal>
</template>
