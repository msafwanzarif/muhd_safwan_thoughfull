<script setup lang="ts">
import {
  languageLabel,
  specialisationLabel,
  timezoneCity,
  type Professional,
} from '~/utils/professionals';

defineProps<{ professional: Professional; preview?: boolean }>();
</script>

<template>
  <article
    :class="preview ? 'gap-6 p-6' : ''"
    class="relative flex h-full flex-col gap-5 rounded-2xl border border-default bg-(--brand-surface) p-5 transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-primary"
  >
    <div class="flex items-start gap-3">
      <UAvatar
        :alt="professional.name"
        size="xl"
        :ui="{
          root: `${preview ? 'size-15' : ''} shrink-0 bg-teal-brand-200 dark:bg-teal-brand-800`,
          fallback: `${preview ? 'text-2xl' : ''} font-semibold text-indigo-brand-600 dark:text-teal-brand-200`,
        }"
      />
      <div class="min-w-0">
        <h2
          class="font-bold wrap-anywhere"
          :class="preview ? 'text-xl' : 'text-base'"
        >
          <span v-if="preview">{{ professional.name }}</span>
          <NuxtLink
            v-else
            :to="`/professionals/${professional.id}`"
            class="after:absolute after:inset-0 after:rounded-2xl"
            >{{ professional.name }}</NuxtLink
          >
        </h2>
        <p class="mt-1 text-sm text-muted">
          {{ professional.title || 'Professional' }} ·
          {{ timezoneCity(professional.timezone) }}
        </p>
      </div>
    </div>
    <p
      v-if="preview && professional.bio"
      class="whitespace-pre-line leading-relaxed wrap-anywhere"
    >
      {{ professional.bio }}
    </p>
    <div
      v-if="professional.specialisations.length"
      class="flex flex-wrap gap-2"
    >
      <UBadge
        v-for="code in professional.specialisations"
        :key="code"
        color="secondary"
        variant="soft"
        :ui="{
          base: 'bg-teal-brand-50 text-teal-brand-600 dark:bg-teal-brand-900 dark:text-teal-brand-400',
        }"
        class="rounded-full"
        >{{ specialisationLabel(code) }}</UBadge
      >
    </div>
    <p class="text-sm text-muted">
      {{
        professional.languages.length
          ? `Speaks ${professional.languages.map(languageLabel).join(', ')}`
          : 'Languages not listed'
      }}
    </p>
    <UBadge
      v-if="!professional.hasWorkingHours"
      color="neutral"
      variant="soft"
      :ui="{
        base: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      }"
      class="mt-auto self-start rounded-full"
      >No availability</UBadge
    >
  </article>
</template>
