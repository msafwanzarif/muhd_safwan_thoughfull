<script setup lang="ts">
defineProps<{ compact?: boolean; title?: string }>();
const {
  items,
  unread,
  cursor,
  loading,
  saving,
  error,
  refresh,
  more,
  markAll,
} = useNotifications();
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1
        v-if="title"
        class="text-2xl leading-8 font-bold lg:text-3xl lg:leading-10"
      >
        {{ title }}
      </h1>
      <p role="status" class="sr-only">{{ unread }} unread</p>
      <UButton
        variant="outline"
        class="ml-auto min-h-11 justify-center"
        :disabled="!unread || saving"
        :loading="saving"
        @click="markAll"
        >Mark all as read</UButton
      >
    </div>
    <UAlert
      v-if="error"
      role="alert"
      color="error"
      title="Couldn't update notifications"
      :description="error"
      ><template #actions
        ><UButton variant="outline" class="min-h-11" @click="refresh"
          >Try again</UButton
        ></template
      ></UAlert
    >
    <USkeleton
      v-if="loading && !items.length"
      class="h-40 rounded-xl"
      aria-label="Loading notifications"
    />
    <div
      v-if="items.length"
      class="overflow-hidden rounded-2xl border border-default"
    >
      <NotificationsItem
        v-for="item in compact ? items.slice(0, 3) : items"
        :key="item.id"
        :notification="item"
      />
    </div>
    <UEmpty
      v-if="!loading && !error && !items.length"
      icon="i-lucide-bell"
      title="You're all caught up"
      description="Reminders and session updates will appear here."
    />
    <UButton
      v-if="!compact && cursor"
      block
      variant="outline"
      class="mx-auto min-h-11 justify-center lg:w-auto"
      :loading="loading"
      :disabled="loading"
      @click="more"
      >Load more</UButton
    >
  </div>
</template>
