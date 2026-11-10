<script setup lang="ts">
const user = useCurrentUser();
const { unread, refresh } = useNotifications();
const desktop = useMediaQuery('(min-width: 1024px)');
const open = ref(false);
const path = computed(() =>
  user.value?.role === 'professional' ? '/pro/notifications' : '/notifications',
);
watch(open, (value) => {
  if (value) void refresh();
});
</script>

<template>
  <UPopover v-if="desktop" v-model:open="open">
    <UButton
      icon="i-lucide-bell"
      variant="ghost"
      class="relative size-11 justify-center"
      :aria-label="`Notifications, ${unread} unread`"
      ><span
        v-if="unread"
        class="absolute -top-1 -right-1 rounded-full bg-primary px-1.5 text-xs text-inverted"
        >{{ unread > 99 ? '99+' : unread }}</span
      ></UButton
    >
    <template #content
      ><section
        class="max-h-[75dvh] w-96 max-w-[95vw] space-y-4 overflow-y-auto p-5"
      >
        <h2 class="text-lg font-bold">Notifications</h2>
        <NotificationsList compact /><UButton
          :to="path"
          block
          variant="outline"
          class="min-h-11"
          @click="open = false"
          >View all notifications</UButton
        >
      </section></template
    >
  </UPopover>
  <UButton
    v-else
    :to="path"
    icon="i-lucide-bell"
    variant="ghost"
    class="relative size-11 justify-center"
    :aria-label="`Notifications, ${unread} unread`"
    ><span
      v-if="unread"
      class="absolute -top-1 -right-1 rounded-full bg-primary px-1.5 text-xs text-inverted"
      >{{ unread > 99 ? '99+' : unread }}</span
    ></UButton
  >
</template>
