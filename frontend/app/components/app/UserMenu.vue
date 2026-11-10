<script setup lang="ts">
import { authMessage } from '~/utils/auth';

const user = useCurrentUser();
const auth = useAuth();
const toast = useToast();
const busy = ref(false);

async function logout() {
  if (busy.value) return;
  busy.value = true;
  try {
    await auth.logout();
  } catch (error) {
    toast.add({
      title: 'Could not log out',
      description: authMessage(error),
      color: 'error',
    });
  } finally {
    busy.value = false;
  }
}

const items = computed(() => [
  { label: user.value?.name ?? 'Your account', type: 'label' as const },
  {
    label: user.value?.role === 'member' ? 'Account' : 'My profile',
    icon: 'i-lucide-user',
    to: user.value?.role === 'member' ? '/account' : '/pro/profile',
  },
  {
    label: 'Log out',
    icon: 'i-lucide-log-out',
    disabled: busy.value,
    onSelect: logout,
  },
]);
</script>

<template>
  <div class="flex items-center gap-2">
    <AppThemeControl />
    <UDropdownMenu :items="items">
      <UButton variant="ghost" aria-label="Open account menu" :loading="busy">
        <UAvatar
          :alt="user?.name"
          size="sm"
          :ui="{
            root: 'bg-teal-brand-200 dark:bg-teal-brand-800',
            fallback:
              'font-semibold text-indigo-brand-600 dark:text-teal-brand-200',
          }"
        />
        <span class="hidden max-w-32 truncate sm:inline">{{ user?.name }}</span>
        <UIcon name="i-lucide-chevron-down" />
      </UButton>
    </UDropdownMenu>
  </div>
</template>
