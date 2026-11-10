<script setup lang="ts">
definePageMeta({ layout: 'member' });
useHead({ title: 'Notifications · ThoughtFull' });
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-6">
    <h1 class="text-3xl font-bold">Notifications</h1>
    <NotificationsList />
  </section>
</template>
