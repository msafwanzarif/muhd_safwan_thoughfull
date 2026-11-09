<script setup lang="ts">
definePageMeta({ layout: 'professional' });
const user = useCurrentUser();
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold">Your schedule</h1>
    <p class="mt-3 text-muted">
      Welcome, {{ user?.name }}. Your professional account is ready.
    </p>
    <p class="mt-2 text-muted">
      Your session times will use {{ user?.timezone }}.
    </p>
  </div>
</template>
