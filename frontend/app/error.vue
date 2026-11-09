<script setup lang="ts">
import type { NuxtError } from '#app';
defineProps<{ error: NuxtError }>();
</script>
<template>
  <UApp
    ><main class="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <AppBrand />
      <h1 class="mt-8 text-3xl font-bold">
        {{
          error.status === 404 ? 'Page not found' : 'Something went wrong'
        }}
      </h1>
      <p class="mt-4 text-muted">
        {{
          error.status === 404
            ? 'This page is unavailable. You can return home.'
            : 'Please try again in a moment.'
        }}
      </p>
      <UButton class="mt-8 self-start" @click="clearError({ redirect: '/' })"
        >Back to home</UButton
      >
    </main></UApp
  >
</template>
