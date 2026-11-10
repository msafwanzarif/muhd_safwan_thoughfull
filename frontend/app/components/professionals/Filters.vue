<script setup lang="ts">
import { languages, specialisations } from '~/utils/auth';

defineProps<{
  specialisation: string;
  language: string;
  date: string;
  minDate: string;
  maxDate: string;
  timezone: string;
}>();
const emit = defineEmits<{
  change: [key: 'spec' | 'lang' | 'date', value: string];
}>();
const specs = [
  { value: 'all', label: 'Any specialisation' },
  ...specialisations,
];
const langs = [{ value: 'all', label: 'Any language' }, ...languages];
</script>

<template>
  <UFormField label="Specialisation" class="min-w-0">
    <USelect
      :model-value="specialisation || 'all'"
      :items="specs"
      value-key="value"
      class="w-full"
      :ui="{ base: 'min-h-11', item: 'min-h-11' }"
      @update:model-value="
        emit('change', 'spec', $event === 'all' ? '' : ($event ?? ''))
      "
    />
  </UFormField>
  <UFormField label="Language" class="min-w-0">
    <USelect
      :model-value="language || 'all'"
      :items="langs"
      value-key="value"
      class="w-full"
      :ui="{ base: 'min-h-11', item: 'min-h-11' }"
      @update:model-value="
        emit('change', 'lang', $event === 'all' ? '' : ($event ?? ''))
      "
    />
  </UFormField>
  <UFormField
    label="Free on"
    :help="`In ${timezone}. Up to 28 days ahead.`"
    class="min-w-0"
  >
    <UInput
      :model-value="date"
      type="date"
      :min="minDate"
      :max="maxDate"
      class="w-full"
      :ui="{ base: 'min-h-11' }"
      @update:model-value="emit('change', 'date', String($event))"
    />
  </UFormField>
</template>
