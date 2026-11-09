<script setup lang="ts">
definePageMeta({ layout: 'auth' });
</script>
<template>
  <section>
    <p class="text-sm font-semibold tracking-widest text-primary uppercase">
      ThoughtFull Booking
    </p>
    <h2 class="mt-4 text-3xl leading-tight font-bold">
      Make space for<br />your wellbeing.
    </h2>
    <p class="mt-5 text-base leading-7 text-muted">
      Find a counsellor or coach, choose a time that works for you, and take the
      next step at your own pace.
    </p>
    <div class="mt-8 space-y-4 border-y border-default py-6">
      <div class="flex items-center gap-3">
        <UIcon name="i-lucide-globe-2" class="size-5 text-primary" /><span
          >Times that fit your timezone</span
        >
      </div>
      <div class="flex items-center gap-3">
        <UIcon
          name="i-lucide-calendar-check"
          class="size-5 text-primary"
        /><span>A dedicated 50-minute session</span>
      </div>
      <div class="flex items-center gap-3">
        <UIcon
          name="i-lucide-heart-handshake"
          class="size-5 text-primary"
        /><span>Counsellors and coaches who listen</span>
      </div>
    </div>
  </section>
</template>
