<script setup lang="ts">
import { scheduleInitials, scheduleTimezone } from '~/utils/schedule-display';
import { problemMessage } from '~/utils/problem';

const user = useCurrentUser();
const auth = useAuth();
const toast = useToast();
const busy = ref(false);
const zone = computed(() => scheduleTimezone(user.value?.timezone ?? 'UTC'));
const menu = computed(() => [
  { label: 'My profile', icon: 'i-lucide-user', to: '/pro/profile' },
  {
    label: 'Log out',
    icon: 'i-lucide-log-out',
    disabled: busy.value,
    onSelect: logout,
  },
]);

async function logout() {
  if (busy.value) return;
  busy.value = true;
  try {
    await auth.logout();
  } catch (error) {
    toast.add({
      title: 'Could not log out',
      description: problemMessage(error),
      color: 'error',
    });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="w-full border-t border-default px-3 pt-4">
    <UDropdownMenu :items="menu">
      <button
        type="button"
        aria-label="Open account menu"
        class="flex min-h-11 w-full items-center gap-3 text-left"
      >
        <UAvatar
          :alt="user?.name"
          :text="scheduleInitials(user?.name ?? '')"
          :ui="{
            root: 'size-9 bg-teal-brand-200 dark:bg-teal-brand-800',
            fallback:
              'text-sm font-semibold text-primary dark:text-teal-brand-200',
          }"
        />
        <span class="min-w-0"
          ><span class="block truncate text-xs leading-[18px]">{{
            user?.name
          }}</span
          ><span class="block truncate text-xs leading-[18px] text-muted"
            >{{ zone.city }} · {{ zone.offset }}</span
          ></span
        >
      </button>
    </UDropdownMenu>
    <UButton
      block
      variant="outline"
      :loading="busy"
      :disabled="busy"
      class="mt-2 min-h-11 justify-center border border-[#c9d6dc] font-semibold ring-0 dark:border-default"
      @click="logout"
      >Log out</UButton
    >
  </div>
</template>
