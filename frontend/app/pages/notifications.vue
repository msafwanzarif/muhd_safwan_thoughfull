<script setup lang="ts">
definePageMeta({ layout: 'member' });
useHead({ title: 'Notifications · ThoughtFull' });
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-6">
    <NotificationsList title="Notifications" />
  </section>
</template>
