<script setup lang="ts">
const model = defineModel<string>({ required: true });
const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const zones = [
  ...new Set([...Intl.supportedValuesOf('timeZone'), 'UTC', browserZone]),
];
const items = zones
  .map((value) => {
    const offset = new Intl.DateTimeFormat('en-GB', {
      timeZone: value,
      timeZoneName: 'longOffset',
    })
      .formatToParts()
      .find((part) => part.type === 'timeZoneName')?.value;
    return { value, label: `${value.replaceAll('_', ' ')} (${offset})` };
  })
  .sort((a, b) => a.label.localeCompare(b.label));
</script>

<template>
  <USelectMenu
    v-model="model"
    :items="items"
    value-key="value"
    :search-input="{ placeholder: 'Search city or time zone' }"
    placeholder="Choose your city or time zone"
    class="w-full"
  />
</template>
