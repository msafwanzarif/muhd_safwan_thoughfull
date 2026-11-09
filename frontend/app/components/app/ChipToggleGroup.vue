<script setup lang="ts" generic="T extends string">
const model = defineModel<T[]>({ required: true });
defineProps<{ items: readonly { value: T; label: string }[] }>();

function toggle(value: T) {
  model.value = model.value.includes(value)
    ? model.value.filter((item) => item !== value)
    : [...model.value, value];
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <UButton
      v-for="item in items"
      :key="item.value"
      type="button"
      :aria-pressed="model.includes(item.value)"
      :variant="model.includes(item.value) ? 'solid' : 'outline'"
      @click="toggle(item.value)"
      >{{ item.label }}</UButton
    >
  </div>
</template>
