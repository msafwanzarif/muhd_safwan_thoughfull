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
        <UAvatar :alt="user?.name" size="sm" />
        <span class="max-w-32 truncate">{{ user?.name }}</span>
        <UIcon name="i-lucide-chevron-down" />
      </UButton>
    </UDropdownMenu>
  </div>
</template>
