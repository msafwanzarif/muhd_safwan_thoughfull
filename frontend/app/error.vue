<script setup lang="ts">
import type { NuxtError } from '#app';
const props = defineProps<{ error: NuxtError }>();
const code = computed(() => props.error.statusCode ?? 500);
const title = computed(() =>
  code.value === 404
    ? 'Page not found'
    : code.value === 503
      ? 'Unable to connect'
      : 'Something went wrong',
);
useHead({ title: computed(() => `${title.value} · ThoughtFull`) });

function retry() {
  window.location.reload();
}
</script>
<template>
  <UApp>
    <main class="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <AppBrand />
      <h1 class="mt-8 text-3xl font-bold">
        {{ title }}
      </h1>
      <p class="mt-4 text-muted">
        {{
          code === 404
            ? 'This page is unavailable. You can return home.'
            : 'We could not load this page. Check your connection and try again.'
        }}
      </p>
      <div class="mt-8 flex flex-wrap gap-3">
        <UButton v-if="code !== 404" class="min-h-11" @click="retry"
          >Try again</UButton
        >
        <UButton
          variant="outline"
          class="min-h-11"
          @click="clearError({ redirect: '/' })"
          >Back to home</UButton
        >
      </div>
    </main>
  </UApp>
</template>
