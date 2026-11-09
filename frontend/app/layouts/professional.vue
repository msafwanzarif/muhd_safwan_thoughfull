<script setup lang="ts">
const items = [
  { label: 'Schedule', to: '/pro/schedule', icon: 'i-lucide-calendar-days' },
  { label: 'Working hours', to: '/pro/hours', icon: 'i-lucide-clock' },
  {
    label: 'Blocked dates',
    to: '/pro/blocked-dates',
    icon: 'i-lucide-calendar-off',
  },
  { label: 'My profile', to: '/pro/profile', icon: 'i-lucide-user' },
  { label: 'Notifications', to: '/pro/notifications', icon: 'i-lucide-bell' },
];
</script>
<template>
  <UDashboardGroup
    ><UDashboardSidebar collapsible resizable
      ><template #header><AppBrand /></template
      ><UNavigationMenu :items="items" orientation="vertical" /><template
        #footer
        ><AppUserMenu /></template></UDashboardSidebar
    ><UDashboardPanel
      ><template #header
        ><UDashboardNavbar title="ThoughtFull"
          ><template #leading
            ><UDashboardSidebarCollapse /></template></UDashboardNavbar></template
      ><template #body
        ><main id="main-content"><slot /></main></template></UDashboardPanel
  ></UDashboardGroup>
</template>
