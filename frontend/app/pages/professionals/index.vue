<script setup lang="ts">
definePageMeta({ layout: 'member' });
const user = useCurrentUser();
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold">Welcome, {{ user?.name }}</h1>
    <p class="mt-3 text-muted">
      Your member account is ready. Your session times will use
      {{ user?.timezone }}.
    </p>
  </div>
</template>
