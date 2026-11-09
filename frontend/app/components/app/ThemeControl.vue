<script setup lang="ts">
const colorMode = useColorMode();
const isDark = computed(() => colorMode.preference === 'dark');

function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark';
}
</script>

<template>
  <UButton
    :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    color="primary"
    variant="ghost"
    class="size-11 justify-center"
    @click="toggleTheme"
  />
</template>
