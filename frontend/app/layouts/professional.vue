<script setup lang="ts">
const { unread } = useNotifications();
const route = useRoute();
const items = computed(() => [
  { label: 'Schedule', to: '/pro/schedule', icon: 'i-lucide-calendar-days' },
  { label: 'Working hours', to: '/pro/hours', icon: 'i-lucide-clock' },
  {
    label: 'Blocked dates',
    to: '/pro/blocked-dates',
    icon: 'i-lucide-calendar-off',
  },
  { label: 'My profile', to: '/pro/profile', icon: 'i-lucide-user' },
  {
    label: 'Notifications',
    to: '/pro/notifications',
    icon: 'i-lucide-bell',
    badge: unread.value || undefined,
  },
]);
</script>
<template>
  <div class="min-h-dvh">
    <UDashboardGroup
      unit="px"
      storage-key="professional-layout"
      :persistent="false"
    >
      <UDashboardSidebar
        :default-size="240"
        :min-size="240"
        :max-size="240"
        :ui="{
          root: 'bg-(--brand-surface)',
          header: 'h-[72px] px-6',
          body: 'gap-0 px-3 py-0',
          footer: 'block px-3 pt-0 pb-4',
        }"
      >
        <template #header>
          <AppBrand />
          <AppThemeControl class="ml-auto" />
        </template>

        <nav aria-label="Professional navigation" class="space-y-1">
          <NuxtLink
            v-for="item in items"
            :key="item.to"
            :to="item.to"
            :aria-current="route.path === item.to ? 'page' : undefined"
            class="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium"
            :class="
              route.path === item.to
                ? 'bg-muted text-primary'
                : 'text-default hover:bg-muted/50'
            "
          >
            <UIcon :name="item.icon" class="size-[18px] shrink-0" />
            <span>{{ item.label }}</span>
            <span
              v-if="item.badge"
              class="ml-auto flex size-[22px] items-center justify-center rounded-full bg-[#b42318] text-xs font-semibold text-white"
              >{{ item.badge }}</span
            >
          </NuxtLink>
        </nav>

        <template #footer>
          <AppProfessionalAccount />
        </template>
      </UDashboardSidebar>

      <UDashboardPanel :ui="{ body: 'block p-0 sm:p-0' }">
        <template #header>
          <UDashboardNavbar
            class="h-14 bg-(--brand-surface) lg:hidden"
            :toggle="{
              class: 'size-8 min-h-0 justify-center p-0',
              ui: { leadingIcon: 'size-[18px]' },
            }"
            :ui="{ root: 'pl-4 pr-2 sm:pl-4 sm:pr-2', left: 'gap-2' }"
          >
            <template #title><AppBrand class="mobile-brand" /></template>
            <template #right>
              <AppThemeControl />
              <NotificationsBell compact />
            </template>
          </UDashboardNavbar>
        </template>

        <template #body>
          <main id="main-content" class="professional-main">
            <AppTimezoneBanner />
            <slot />
          </main>
        </template>
      </UDashboardPanel>
    </UDashboardGroup>
    <AppIdleWarning />
  </div>
</template>

<style scoped>
.professional-main {
  min-height: 100%;
  padding: 24px 16px;
}
.mobile-brand {
  font-size: 18px;
}
@media (min-width: 1024px) {
  .professional-main {
    padding: 32px 56px 20px 40px;
  }
}
</style>
