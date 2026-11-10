<script setup lang="ts">
defineProps<{ page: number; total: number; pageSize: number }>();
const emit = defineEmits<{ change: [page: number] }>();
</script>

<template>
  <nav
    v-if="total > pageSize || page > 1"
    aria-label="Results pages"
    class="mt-8 flex justify-center"
  >
    <UPagination
      :page="page"
      :total="total"
      :items-per-page="pageSize"
      :sibling-count="1"
      :show-edges="false"
      :ui="{
        first: 'hidden',
        last: 'hidden',
        prev: 'size-11 justify-center',
        next: 'size-11 justify-center',
        item: 'min-h-11 min-w-11 justify-center',
      }"
      @update:page="emit('change', $event)"
    />
  </nav>
</template>
